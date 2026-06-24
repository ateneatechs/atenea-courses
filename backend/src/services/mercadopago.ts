// Mercado Pago integration via the public REST API (no SDK dependency).
// Docs: https://www.mercadopago.com.ar/developers/es/reference
import crypto from 'crypto';
import { query } from '../config/database';

const MP_API = 'https://api.mercadopago.com';

/**
 * Resolve the Mercado Pago access token for a tenant.
 * Order: per-tenant token stored in site_settings → global env fallback.
 * Returns null when payments are not configured for the tenant.
 */
export const getTenantAccessToken = async (tenantId: string): Promise<string | null> => {
  const result = await query(
    `SELECT key, value FROM site_settings
     WHERE tenant_id = $1 AND key IN ('mp_enabled', 'mp_access_token')`,
    [tenantId]
  );
  const settings: Record<string, string | null> = {};
  result.rows.forEach((r: { key: string; value: string | null }) => { settings[r.key] = r.value; });

  const enabled = settings.mp_enabled === 'true';
  const token = (settings.mp_access_token || '').trim() || (process.env.MP_ACCESS_TOKEN || '').trim();

  if (!enabled || !token) return null;
  return token;
};

/** True when the tenant has Mercado Pago configured and enabled. */
export const isPaymentsEnabled = async (tenantId: string): Promise<boolean> => {
  return (await getTenantAccessToken(tenantId)) !== null;
};

/**
 * Resolve the per-tenant Mercado Pago webhook signing secret (used to verify
 * the `x-signature` header). Returns null when not configured — callers must
 * decide how to handle that (the webhook still re-verifies payment state via
 * the MP API regardless, so this is a defense-in-depth check, not the only one).
 */
export const getTenantWebhookSecret = async (tenantId: string): Promise<string | null> => {
  const result = await query(
    `SELECT value FROM site_settings WHERE tenant_id = $1 AND key = 'mp_webhook_secret'`,
    [tenantId]
  );
  const secret = (result.rows[0]?.value || '').trim();
  return secret || null;
};

/**
 * Verify MP's `x-signature` header (docs: "Verificar firma de notificaciones webhook").
 * Header format: `ts=<unix_ts>,v1=<hex_hmac>`. The manifest hashed is
 * `id:<dataId>;request-id:<x-request-id>;ts:<ts>;` (request-id may be absent for older notifications).
 */
export const verifyMpWebhookSignature = (args: {
  signatureHeader: string | undefined;
  requestId: string | undefined;
  dataId: string;
  secret: string;
}): boolean => {
  if (!args.signatureHeader) return false;

  const parts: Record<string, string> = {};
  for (const segment of args.signatureHeader.split(',')) {
    const [key, value] = segment.split('=').map(s => s.trim());
    if (key && value) parts[key] = value;
  }
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${args.dataId.toLowerCase()};${args.requestId ? `request-id:${args.requestId};` : ''}ts:${ts};`;
  const expected = crypto.createHmac('sha256', args.secret).update(manifest).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
  } catch {
    return false;
  }
};

export interface PreferenceItem {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: string;
}

export interface CreatePreferenceArgs {
  accessToken: string;
  item: PreferenceItem;
  externalReference: string;
  notificationUrl: string;
  backUrls: { success: string; failure: string; pending: string };
  payerEmail?: string;
}

export interface PreferenceResult {
  id: string;
  init_point: string;
  sandbox_init_point: string;
}

/** Create a Checkout Pro preference and return the redirect URLs. */
export const createPreference = async (args: CreatePreferenceArgs): Promise<PreferenceResult> => {
  const body = {
    items: [{
      title: args.item.title,
      quantity: args.item.quantity,
      unit_price: args.item.unit_price,
      currency_id: args.item.currency_id || 'ARS',
    }],
    external_reference: args.externalReference,
    notification_url: args.notificationUrl,
    back_urls: args.backUrls,
    auto_return: 'approved',
    ...(args.payerEmail ? { payer: { email: args.payerEmail } } : {}),
  };

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${args.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Mercado Pago preference error (${res.status}): ${detail}`);
  }
  return res.json() as Promise<PreferenceResult>;
};

export interface MpPayment {
  id: number;
  status: string;            // approved | pending | rejected | ...
  external_reference: string | null;
  transaction_amount: number | null;
}

/** Fetch a payment by id to verify its real status (never trust the webhook body alone). */
export const getPayment = async (accessToken: string, paymentId: string): Promise<MpPayment> => {
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Mercado Pago get payment error (${res.status}): ${detail}`);
  }
  return res.json() as Promise<MpPayment>;
};
