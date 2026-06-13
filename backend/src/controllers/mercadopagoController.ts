import { Request, Response } from 'express';
import { query } from '../config/database';
import {
  getOAuthUrl,
  exchangeCodeForToken,
  signState,
  verifyState,
  verifyWebhookSignature,
  getPayment,
  getPlatformAccessToken,
} from '../services/mercadopago';
import { getTenantFrontendUrl } from '../utils/tenantUrl';

export const connectMercadoPago = async (req: Request, res: Response): Promise<void> => {
  try {
    const state = signState(req.tenantId!);
    res.json({ url: getOAuthUrl(state) });
  } catch (error) {
    console.error('ConnectMercadoPago error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getMercadoPagoStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      'SELECT mp_access_token, mp_user_id FROM tenants WHERE id = $1',
      [req.tenantId!]
    );
    const tenant = result.rows[0];
    res.json({ connected: !!tenant?.mp_access_token, mpUserId: tenant?.mp_user_id || null });
  } catch (error) {
    console.error('GetMercadoPagoStatus error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const disconnectMercadoPago = async (req: Request, res: Response): Promise<void> => {
  try {
    await query(
      `UPDATE tenants SET mp_access_token = NULL, mp_refresh_token = NULL, mp_user_id = NULL, mp_connected_at = NULL WHERE id = $1`,
      [req.tenantId!]
    );
    res.json({ message: 'Mercado Pago desconectado' });
  } catch (error) {
    console.error('DisconnectMercadoPago error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Public route — Mercado Pago redirects here after the admin authorizes the app.
export const mercadopagoCallback = async (req: Request, res: Response): Promise<void> => {
  const frontendFallback = process.env.FRONTEND_URL || 'http://localhost:5173';
  try {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) {
      res.redirect(`${frontendFallback}/admin?mp=error`);
      return;
    }

    const tenantId = verifyState(state);
    if (!tenantId) {
      res.redirect(`${frontendFallback}/admin?mp=error`);
      return;
    }

    const tenantResult = await query('SELECT slug FROM tenants WHERE id = $1', [tenantId]);
    const tenant = tenantResult.rows[0];
    if (!tenant) {
      res.redirect(`${frontendFallback}/admin?mp=error`);
      return;
    }

    const tokens = await exchangeCodeForToken(code);
    await query(
      `UPDATE tenants SET mp_access_token = $1, mp_refresh_token = $2, mp_user_id = $3, mp_connected_at = NOW() WHERE id = $4`,
      [tokens.access_token, tokens.refresh_token, String(tokens.user_id), tenantId]
    );

    res.redirect(`${getTenantFrontendUrl(tenant.slug)}/admin?mp=connected`);
  } catch (error) {
    console.error('MercadoPagoCallback error:', error);
    res.redirect(`${frontendFallback}/admin?mp=error`);
  }
};

// Public route — Mercado Pago notifies payment events here.
export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const dataId = (req.query['data.id'] as string) || req.body?.data?.id;
    if (!dataId) {
      res.sendStatus(200);
      return;
    }

    const signature = req.headers['x-signature'] as string | undefined;
    const requestId = req.headers['x-request-id'] as string | undefined;
    if (!verifyWebhookSignature(signature, requestId, String(dataId))) {
      res.sendStatus(401);
      return;
    }

    const platformToken = await getPlatformAccessToken();
    const payment = await getPayment(String(dataId), platformToken);
    const externalReference = payment.external_reference as string | undefined;
    if (!externalReference) {
      res.sendStatus(200);
      return;
    }

    const purchaseResult = await query(
      `SELECT cp.id, t.mp_user_id
       FROM course_purchases cp
       JOIN tenants t ON t.id = cp.tenant_id
       WHERE cp.id = $1`,
      [externalReference]
    );
    const purchase = purchaseResult.rows[0];
    if (!purchase) {
      res.sendStatus(200);
      return;
    }

    if (purchase.mp_user_id && String(payment.collector_id) !== String(purchase.mp_user_id)) {
      console.error('Webhook collector mismatch for purchase', externalReference);
      res.sendStatus(200);
      return;
    }

    const statusMap: Record<string, string> = {
      approved: 'approved',
      rejected: 'rejected',
      cancelled: 'rejected',
      refunded: 'rejected',
      charged_back: 'rejected',
      in_process: 'pending',
      pending: 'pending',
    };
    const paymentStatus = statusMap[payment.status as string] || 'pending';

    await query(
      `UPDATE course_purchases SET payment_status = $1, mp_payment_id = $2 WHERE id = $3`,
      [paymentStatus, String(payment.id), externalReference]
    );

    res.sendStatus(200);
  } catch (error) {
    console.error('HandleWebhook error:', error);
    res.sendStatus(200);
  }
};
