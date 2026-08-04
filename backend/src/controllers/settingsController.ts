import { Request, Response } from 'express';
import { query } from '../config/database';
import { isPaymentsEnabled } from '../services/mercadopago';

const MEMBERSHIP_DEFAULTS: Record<string, string> = {
  membership_enabled: 'true',
  membership_monthly_price: '15000',
  membership_annual_price: '150000',
};

export const getPublicSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT key, value FROM site_settings WHERE tenant_id = $1 AND key IN
        ('logo_url', 'site_name', 'membership_enabled', 'membership_monthly_price', 'membership_annual_price')`,
      [req.tenantId!]
    );
    const raw: Record<string, string | null> = {
      logo_url: null,
      site_name: 'Atenea Courses',
      ...MEMBERSHIP_DEFAULTS,
    };
    result.rows.forEach((r: { key: string; value: string | null }) => {
      raw[r.key] = r.value;
    });
    res.json({
      logo_url: raw.logo_url,
      site_name: raw.site_name,
      membership_enabled: raw.membership_enabled === 'true',
      membership_monthly_price: Number(raw.membership_monthly_price),
      membership_annual_price: Number(raw.membership_annual_price),
      payments_enabled: await isPaymentsEnabled(req.tenantId!),
    });
  } catch (error) {
    console.error('GetPublicSettings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const uploadLogo = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    await query(
      `INSERT INTO site_settings (tenant_id, key, value) VALUES ($1, 'logo_url', $2)
       ON CONFLICT (tenant_id, key) DO UPDATE SET value = $2`,
      [req.tenantId!, logoUrl]
    );
    res.json({ logo_url: logoUrl });
  } catch (error) {
    console.error('UploadLogo error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getMembershipSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT key, value FROM site_settings WHERE tenant_id = $1 AND key IN
        ('membership_enabled', 'membership_monthly_price', 'membership_annual_price')`,
      [req.tenantId!]
    );
    const raw: Record<string, string | null> = { ...MEMBERSHIP_DEFAULTS };
    result.rows.forEach((r: { key: string; value: string | null }) => {
      raw[r.key] = r.value;
    });
    res.json({
      enabled: raw.membership_enabled === 'true',
      monthly_price: Number(raw.membership_monthly_price),
      annual_price: Number(raw.membership_annual_price),
    });
  } catch (error) {
    console.error('GetMembershipSettings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateMembershipSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { enabled, monthly_price, annual_price } = req.body;
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ message: 'enabled debe ser un valor booleano' });
      return;
    }
    if (
      typeof monthly_price !== 'number' || !Number.isFinite(monthly_price) || monthly_price < 0 ||
      typeof annual_price !== 'number' || !Number.isFinite(annual_price) || annual_price < 0
    ) {
      res.status(400).json({ message: 'Los precios deben ser números mayores o iguales a 0' });
      return;
    }

    const entries: [string, string][] = [
      ['membership_enabled', enabled ? 'true' : 'false'],
      ['membership_monthly_price', String(monthly_price)],
      ['membership_annual_price', String(annual_price)],
    ];
    for (const [key, value] of entries) {
      await query(
        `INSERT INTO site_settings (tenant_id, key, value) VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, key) DO UPDATE SET value = $3`,
        [req.tenantId!, key, value]
      );
    }
    res.json({ enabled, monthly_price, annual_price });
  } catch (error) {
    console.error('UpdateMembershipSettings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Mercado Pago gateway settings (admin) ───────────────────────────
// The access token is never returned to the client; we only report
// whether one is configured.
export const getPaymentSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT key, value FROM site_settings WHERE tenant_id = $1 AND key IN ('mp_enabled', 'mp_access_token', 'mp_webhook_secret')`,
      [req.tenantId!]
    );
    const settings: Record<string, string | null> = {};
    result.rows.forEach((r: { key: string; value: string | null }) => { settings[r.key] = r.value; });
    res.json({
      enabled: settings.mp_enabled === 'true',
      has_token: !!(settings.mp_access_token && settings.mp_access_token.trim()),
      has_webhook_secret: !!(settings.mp_webhook_secret && settings.mp_webhook_secret.trim()),
    });
  } catch (error) {
    console.error('GetPaymentSettings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updatePaymentSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { enabled, access_token, webhook_secret } = req.body as {
      enabled?: boolean; access_token?: string; webhook_secret?: string;
    };
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ message: 'enabled debe ser un valor booleano' });
      return;
    }

    // Activar MP sin un secreto de firma deja /api/payments/webhook aceptando
    // notificaciones sin firmar de cualquiera que adivine el UUID del tenant.
    if (enabled) {
      const hasNewSecret = typeof webhook_secret === 'string' && webhook_secret.trim().length > 0;
      if (!hasNewSecret) {
        const existing = await query(
          `SELECT value FROM site_settings WHERE tenant_id = $1 AND key = 'mp_webhook_secret'`,
          [req.tenantId!]
        );
        const hasExistingSecret = !!(existing.rows[0]?.value && existing.rows[0].value.trim());
        if (!hasExistingSecret) {
          res.status(400).json({
            message: 'Para activar Mercado Pago primero tenés que configurar el "Secreto de firma" del webhook (Mercado Pago → Tu negocio → Configuración → Webhooks).',
          });
          return;
        }
      }
    }

    await query(
      `INSERT INTO site_settings (tenant_id, key, value) VALUES ($1, 'mp_enabled', $2)
       ON CONFLICT (tenant_id, key) DO UPDATE SET value = $2`,
      [req.tenantId!, enabled ? 'true' : 'false']
    );

    // Only overwrite the token/secret when a non-empty value is provided, so the
    // admin can toggle "enabled" without re-typing them every time.
    if (typeof access_token === 'string' && access_token.trim()) {
      await query(
        `INSERT INTO site_settings (tenant_id, key, value) VALUES ($1, 'mp_access_token', $2)
         ON CONFLICT (tenant_id, key) DO UPDATE SET value = $2`,
        [req.tenantId!, access_token.trim()]
      );
    }
    if (typeof webhook_secret === 'string' && webhook_secret.trim()) {
      await query(
        `INSERT INTO site_settings (tenant_id, key, value) VALUES ($1, 'mp_webhook_secret', $2)
         ON CONFLICT (tenant_id, key) DO UPDATE SET value = $2`,
        [req.tenantId!, webhook_secret.trim()]
      );
    }

    const result = await query(
      `SELECT key, value FROM site_settings WHERE tenant_id = $1 AND key IN ('mp_access_token', 'mp_webhook_secret')`,
      [req.tenantId!]
    );
    const values: Record<string, string | null> = {};
    result.rows.forEach((r: { key: string; value: string | null }) => { values[r.key] = r.value; });
    res.json({
      enabled,
      has_token: !!(values.mp_access_token && values.mp_access_token.trim()),
      has_webhook_secret: !!(values.mp_webhook_secret && values.mp_webhook_secret.trim()),
    });
  } catch (error) {
    console.error('UpdatePaymentSettings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
