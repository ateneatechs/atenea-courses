import { Request, Response } from 'express';
import { query } from '../config/database';
import {
  getTenantAccessToken,
  createPreference,
  getPayment,
  getTenantWebhookSecret,
  verifyMpWebhookSignature,
} from '../services/mercadopago';
import { sendOrderConfirmationEmail } from '../services/email';

const FRONTEND_URL = () => process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_PUBLIC_URL = () => process.env.BACKEND_PUBLIC_URL || 'http://localhost:3000';

/** TEST- tokens must use the sandbox checkout URL. */
const pickCheckoutUrl = (token: string, pref: { init_point: string; sandbox_init_point: string }) =>
  token.startsWith('TEST-') ? pref.sandbox_init_point : pref.init_point;

// ─────────────────────────────────────────────────────────────
// Create checkout for a single course purchase
// ─────────────────────────────────────────────────────────────
export const createCourseCheckout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.body;
    const userId = req.user!.userId;
    const tenantId = req.tenantId!;

    const token = await getTenantAccessToken(tenantId);
    if (!token) {
      res.status(503).json({ message: 'Los pagos no están configurados para esta academia.' });
      return;
    }

    const courseResult = await query(
      'SELECT * FROM courses WHERE id = $1 AND tenant_id = $2 AND is_published = true',
      [courseId, tenantId]
    );
    if (courseResult.rows.length === 0) {
      res.status(404).json({ message: 'Curso no encontrado' });
      return;
    }
    const course = courseResult.rows[0];

    if (course.is_membership_exclusive || course.price == null || Number(course.price) <= 0) {
      res.status(400).json({ message: 'Este curso no está disponible para compra individual.' });
      return;
    }

    const existing = await query(
      'SELECT id FROM course_purchases WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    );
    if (existing.rows.length > 0) {
      res.status(400).json({ message: 'Ya tienes acceso a este curso.' });
      return;
    }

    const amount = Number(course.price);
    const payment = await query(
      `INSERT INTO payments (tenant_id, user_id, type, course_id, amount, status)
       VALUES ($1, $2, 'course', $3, $4, 'pending') RETURNING id`,
      [tenantId, userId, courseId, amount]
    );
    const paymentRowId = payment.rows[0].id;

    const pref = await createPreference({
      accessToken: token,
      item: { title: course.title, quantity: 1, unit_price: amount },
      externalReference: paymentRowId,
      notificationUrl: `${BACKEND_PUBLIC_URL()}/api/payments/webhook?tenant=${tenantId}`,
      backUrls: {
        success: `${FRONTEND_URL()}/payment/result`,
        failure: `${FRONTEND_URL()}/payment/result`,
        pending: `${FRONTEND_URL()}/payment/result`,
      },
      payerEmail: req.user!.email,
    });

    await query('UPDATE payments SET mp_preference_id = $1 WHERE id = $2', [pref.id, paymentRowId]);

    res.json({ checkoutUrl: pickCheckoutUrl(token, pref), preferenceId: pref.id });
  } catch (error) {
    console.error('createCourseCheckout error:', error);
    res.status(500).json({ message: 'No se pudo iniciar el pago.' });
  }
};

// ─────────────────────────────────────────────────────────────
// Create checkout for a membership subscription (monthly / annual)
// ─────────────────────────────────────────────────────────────
export const createSubscriptionCheckout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { plan = 'monthly' } = req.body as { plan?: 'monthly' | 'annual' };
    const userId = req.user!.userId;
    const tenantId = req.tenantId!;

    if (plan !== 'monthly' && plan !== 'annual') {
      res.status(400).json({ message: 'Plan inválido.' });
      return;
    }

    const token = await getTenantAccessToken(tenantId);
    if (!token) {
      res.status(503).json({ message: 'Los pagos no están configurados para esta academia.' });
      return;
    }

    const settingsResult = await query(
      `SELECT key, value FROM site_settings WHERE tenant_id = $1 AND key IN
        ('membership_enabled', 'membership_monthly_price', 'membership_annual_price')`,
      [tenantId]
    );
    const settings: Record<string, string | null> = {
      membership_enabled: 'true',
      membership_monthly_price: '15000',
      membership_annual_price: '150000',
    };
    settingsResult.rows.forEach((r: { key: string; value: string | null }) => { settings[r.key] = r.value; });

    if (settings.membership_enabled !== 'true') {
      res.status(400).json({ message: 'Las membresías no están disponibles en esta academia.' });
      return;
    }

    const amount = plan === 'annual'
      ? Number(settings.membership_annual_price)
      : Number(settings.membership_monthly_price);

    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ message: 'Precio de membresía inválido.' });
      return;
    }

    const payment = await query(
      `INSERT INTO payments (tenant_id, user_id, type, plan, amount, status)
       VALUES ($1, $2, 'subscription', $3, $4, 'pending') RETURNING id`,
      [tenantId, userId, plan, amount]
    );
    const paymentRowId = payment.rows[0].id;

    const pref = await createPreference({
      accessToken: token,
      item: {
        title: plan === 'annual' ? 'Membresía Anual' : 'Membresía Mensual',
        quantity: 1,
        unit_price: amount,
      },
      externalReference: paymentRowId,
      notificationUrl: `${BACKEND_PUBLIC_URL()}/api/payments/webhook?tenant=${tenantId}`,
      backUrls: {
        success: `${FRONTEND_URL()}/payment/result`,
        failure: `${FRONTEND_URL()}/payment/result`,
        pending: `${FRONTEND_URL()}/payment/result`,
      },
      payerEmail: req.user!.email,
    });

    await query('UPDATE payments SET mp_preference_id = $1 WHERE id = $2', [pref.id, paymentRowId]);

    res.json({ checkoutUrl: pickCheckoutUrl(token, pref), preferenceId: pref.id });
  } catch (error) {
    console.error('createSubscriptionCheckout error:', error);
    res.status(500).json({ message: 'No se pudo iniciar el pago.' });
  }
};

// ─────────────────────────────────────────────────────────────
// Shared: verify an MP payment and grant access (idempotent)
// ─────────────────────────────────────────────────────────────
const processMpPayment = async (
  accessToken: string,
  mpPaymentId: string,
  tenantId: string
): Promise<'approved' | 'pending' | 'rejected'> => {
  const mp = await getPayment(accessToken, mpPaymentId);
  const paymentRowId = mp.external_reference;
  if (!paymentRowId) return 'rejected';

  const rowResult = await query(
    'SELECT * FROM payments WHERE id = $1 AND tenant_id = $2',
    [paymentRowId, tenantId]
  );
  const row = rowResult.rows[0];
  if (!row) return 'rejected';

  // Idempotent: already granted
  if (row.status === 'approved') return 'approved';

  if (mp.status !== 'approved') {
    const newStatus = mp.status === 'rejected' || mp.status === 'cancelled' ? mp.status : 'pending';
    await query('UPDATE payments SET status = $1, mp_payment_id = $2 WHERE id = $3',
      [newStatus, String(mp.id), paymentRowId]);
    return mp.status === 'rejected' ? 'rejected' : 'pending';
  }

  // Anti-tamper: amount paid must match what we recorded
  if (mp.transaction_amount != null && Math.abs(Number(mp.transaction_amount) - Number(row.amount)) > 0.5) {
    await query('UPDATE payments SET status = $1, mp_payment_id = $2 WHERE id = $3',
      ['rejected', String(mp.id), paymentRowId]);
    return 'rejected';
  }

  // Grant access
  let itemTitle = row.type === 'subscription'
    ? (row.plan === 'annual' ? 'Membresía Anual' : 'Membresía Mensual')
    : '';

  if (row.type === 'course') {
    await query(
      `INSERT INTO course_purchases (user_id, course_id, tenant_id, amount)
       VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, course_id) DO NOTHING`,
      [row.user_id, row.course_id, tenantId, row.amount]
    );
    const courseResult = await query('SELECT title FROM courses WHERE id = $1', [row.course_id]);
    itemTitle = courseResult.rows[0]?.title || 'Curso';
  } else if (row.type === 'subscription') {
    await query(
      `UPDATE subscriptions SET status = 'cancelled'
       WHERE user_id = $1 AND tenant_id = $2 AND status = 'active'`,
      [row.user_id, tenantId]
    );
    const startsAt = new Date();
    const endsAt = new Date();
    if (row.plan === 'annual') endsAt.setFullYear(endsAt.getFullYear() + 1);
    else endsAt.setMonth(endsAt.getMonth() + 1);
    await query(
      `INSERT INTO subscriptions (user_id, tenant_id, plan, status, starts_at, ends_at)
       VALUES ($1, $2, $3, 'active', $4, $5)`,
      [row.user_id, tenantId, row.plan, startsAt, endsAt]
    );
  }

  await query(
    `UPDATE payments SET status = 'approved', mp_payment_id = $1, processed_at = NOW() WHERE id = $2`,
    [String(mp.id), paymentRowId]
  );

  const [userResult, tenantResult] = await Promise.all([
    query('SELECT email, name FROM users WHERE id = $1', [row.user_id]),
    query('SELECT name FROM tenants WHERE id = $1', [tenantId]),
  ]);
  const buyer = userResult.rows[0];
  if (buyer) {
    void sendOrderConfirmationEmail({
      to: buyer.email,
      userName: buyer.name,
      tenantName: tenantResult.rows[0]?.name || 'Atenea',
      itemTitle,
      amount: Number(row.amount),
      paymentId: String(mp.id),
      purchasedAt: new Date(),
    });
  }

  return 'approved';
};

// ─────────────────────────────────────────────────────────────
// Webhook (called by Mercado Pago servers — no auth, tenant via query)
// ─────────────────────────────────────────────────────────────
export const webhook = async (req: Request, res: Response): Promise<void> => {
  // Always ack quickly so MP doesn't retry forever.
  res.status(200).json({ received: true });

  try {
    const tenantId = (req.query.tenant as string) || '';
    const type = (req.query.type as string) || (req.body?.type as string) || (req.query.topic as string);
    if (type && type !== 'payment') return;

    const mpPaymentId =
      (req.query['data.id'] as string) ||
      (req.body?.data?.id as string) ||
      (req.query.id as string);

    if (!tenantId || !mpPaymentId) return;

    // If the tenant configured a webhook secret (Mercado Pago dashboard → Webhooks →
    // "Firma secreta"), require a valid x-signature. Tenants without one configured
    // still go through processMpPayment's own re-verification against MP's API below —
    // this header check is defense-in-depth, not the only gate.
    const webhookSecret = await getTenantWebhookSecret(tenantId);
    if (webhookSecret) {
      const valid = verifyMpWebhookSignature({
        signatureHeader: req.headers['x-signature'] as string | undefined,
        requestId: req.headers['x-request-id'] as string | undefined,
        dataId: String(mpPaymentId),
        secret: webhookSecret,
      });
      if (!valid) return;
    }

    const token = await getTenantAccessToken(tenantId);
    if (!token) return;

    await processMpPayment(token, String(mpPaymentId), tenantId);
  } catch (error) {
    console.error('MP webhook error:', error);
  }
};

// ─────────────────────────────────────────────────────────────
// Verify (called by the frontend result page after redirect back)
// ─────────────────────────────────────────────────────────────
export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const mpPaymentId = (req.query.payment_id as string) || (req.query.collection_id as string);

    if (!mpPaymentId) {
      res.status(400).json({ status: 'unknown', message: 'Falta el identificador de pago.' });
      return;
    }

    const token = await getTenantAccessToken(tenantId);
    if (!token) {
      res.status(503).json({ status: 'unknown', message: 'Pagos no configurados.' });
      return;
    }

    const status = await processMpPayment(token, String(mpPaymentId), tenantId);
    res.json({ status });
  } catch (error) {
    console.error('verifyPayment error:', error);
    res.status(500).json({ status: 'unknown', message: 'No se pudo verificar el pago.' });
  }
};
