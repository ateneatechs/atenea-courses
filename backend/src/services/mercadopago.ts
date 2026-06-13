import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';

const MP_API_BASE = 'https://api.mercadopago.com';

interface MpTokenResponse {
  access_token: string;
  refresh_token: string;
  user_id: number;
  expires_in: number;
}

export const getOAuthUrl = (state: string): string => {
  const params = new URLSearchParams({
    client_id: process.env.MP_CLIENT_ID || '',
    response_type: 'code',
    platform_id: 'mp',
    redirect_uri: process.env.MP_REDIRECT_URI || '',
    state,
  });
  return `https://auth.mercadopago.com/authorization?${params.toString()}`;
};

export const exchangeCodeForToken = async (code: string): Promise<MpTokenResponse> => {
  const res = await fetch(`${MP_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.MP_REDIRECT_URI,
    }),
  });
  if (!res.ok) throw new Error(`MP token exchange failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<MpTokenResponse>;
};

export const refreshAccessToken = async (refreshToken: string): Promise<MpTokenResponse> => {
  const res = await fetch(`${MP_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`MP token refresh failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<MpTokenResponse>;
};

interface TenantMpRow {
  id: string;
  mp_access_token: string | null;
  mp_refresh_token: string | null;
  mp_connected_at: string | null;
}

// MP access tokens expire ~6h. Refresh proactively if connected/refreshed more than 5h ago.
export const getValidAccessToken = async (tenant: TenantMpRow): Promise<string> => {
  if (!tenant.mp_access_token || !tenant.mp_refresh_token) {
    throw new Error('Tenant has no Mercado Pago connection');
  }
  const connectedAt = tenant.mp_connected_at ? new Date(tenant.mp_connected_at).getTime() : 0;
  const fiveHoursMs = 5 * 60 * 60 * 1000;
  if (Date.now() - connectedAt < fiveHoursMs) {
    return tenant.mp_access_token;
  }
  const refreshed = await refreshAccessToken(tenant.mp_refresh_token);
  await query(
    `UPDATE tenants SET mp_access_token = $1, mp_refresh_token = $2, mp_connected_at = NOW() WHERE id = $3`,
    [refreshed.access_token, refreshed.refresh_token, tenant.id]
  );
  return refreshed.access_token;
};

// App-level token (client_credentials grant) used to read payment details
// from the webhook, regardless of which connected tenant collected it.
let cachedPlatformToken: { token: string; expiresAt: number } | null = null;

export const getPlatformAccessToken = async (): Promise<string> => {
  if (cachedPlatformToken && cachedPlatformToken.expiresAt > Date.now()) {
    return cachedPlatformToken.token;
  }
  const res = await fetch(`${MP_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) throw new Error(`MP platform token failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedPlatformToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedPlatformToken.token;
};

interface PreferenceParams {
  accessToken: string;
  title: string;
  price: number;
  marketplaceFee: number;
  externalReference: string;
  backUrls: { success: string; failure: string; pending: string };
  notificationUrl: string;
}

export const createPreference = async (
  params: PreferenceParams
): Promise<{ id: string; init_point: string }> => {
  const res = await fetch(`${MP_API_BASE}/checkout/preferences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({
      items: [{ title: params.title, quantity: 1, unit_price: params.price, currency_id: 'ARS' }],
      marketplace_fee: params.marketplaceFee,
      external_reference: params.externalReference,
      back_urls: params.backUrls,
      auto_return: 'approved',
      notification_url: params.notificationUrl,
    }),
  });
  if (!res.ok) throw new Error(`MP create preference failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ id: string; init_point: string }>;
};

export const getPayment = async (paymentId: string, accessToken: string): Promise<Record<string, unknown>> => {
  const res = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`MP get payment failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<Record<string, unknown>>;
};

// MP signature header format: "ts=<unix_ts>,v1=<hex hmac>"
// Manifest to hash: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
export const verifyWebhookSignature = (
  signatureHeader: string | undefined,
  requestId: string | undefined,
  dataId: string
): boolean => {
  if (!signatureHeader || !requestId) return false;

  const parts: Record<string, string> = {};
  signatureHeader.split(',').forEach(p => {
    const [k, v] = p.split('=');
    if (k && v) parts[k.trim()] = v.trim();
  });
  const { ts, v1 } = parts;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = crypto
    .createHmac('sha256', process.env.MP_WEBHOOK_SECRET || '')
    .update(manifest)
    .digest('hex');

  if (expected.length !== v1.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
};

export const signState = (tenantId: string): string => {
  return jwt.sign({ tenantId }, process.env.JWT_SECRET || 'fallback', { expiresIn: '1h' });
};

export const verifyState = (state: string): string | null => {
  try {
    const decoded = jwt.verify(state, process.env.JWT_SECRET || 'fallback') as { tenantId: string };
    return decoded.tenantId;
  } catch {
    return null;
  }
};
