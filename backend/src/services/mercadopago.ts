// Mercado Pago integration via the public REST API (no SDK dependency).
// Docs: https://www.mercadopago.com.ar/developers/es/reference
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
