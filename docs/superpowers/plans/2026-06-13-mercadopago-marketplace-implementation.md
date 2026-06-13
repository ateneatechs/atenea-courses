# Mercado Pago Marketplace Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each tenant (barber academy) connect their own Mercado Pago account via OAuth and receive real payments for individual course purchases, with Atenea Courses automatically taking a configurable commission per transaction via `marketplace_fee`.

**Architecture:** Backend adds a `mercadopago` service module (OAuth token exchange/refresh, Checkout Pro preference creation, payment lookup, webhook signature verification) used by a new `mercadopagoController` (admin connect/status/disconnect + public OAuth callback + public webhook) and by `courseController.createCheckout`. `course_purchases` gains `payment_status`, and `checkAccess` now requires `payment_status = 'approved'`. Frontend adds an Admin "Pagos" tab to connect/disconnect MP, a "Comprar" button on `CourseDetail` that redirects to MP Checkout Pro, payment-result banners, and a Super Admin field for the global commission percentage.

**Tech Stack:** Express + TypeScript + `pg` (existing). Native `fetch` (Node v25) for all Mercado Pago REST calls — no new dependencies. React 18 + TS + React Router v6 (existing).

---

## File Map

**New files:**
- `database/06-mercadopago.sql` — migration: MP OAuth columns on `tenants`, `platform_settings` table, payment columns on `course_purchases`.
- `backend/src/services/mercadopago.ts` — MP REST API client: OAuth URL, token exchange/refresh, platform (client-credentials) token, Checkout Pro preference creation, payment lookup, webhook signature verification, signed OAuth `state` helpers.
- `backend/src/utils/tenantUrl.ts` — builds the tenant's public frontend URL (subdomain in prod, `FRONTEND_URL` in dev).
- `backend/src/controllers/mercadopagoController.ts` — connect/status/disconnect (admin) + OAuth callback + webhook (public) handlers.
- `backend/src/routes/mercadopago.ts` — routes for the above.
- `frontend/src/pages/Admin/PaymentsTab.tsx` — "Pagos" tab UI (connection status, connect/disconnect buttons).

**Modified files:**
- `backend/.env` — add `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_REDIRECT_URI`, `MP_WEBHOOK_SECRET`, `BACKEND_URL`.
- `backend/src/app.ts` — mount `mercadopago` routes.
- `backend/src/controllers/courseController.ts` — `checkAccess` requires `payment_status = 'approved'`; `purchaseCourse` restricted to free courses with explicit `payment_status='approved'`; new `createCheckout`.
- `backend/src/routes/courses.ts` — add `POST /:id/checkout`.
- `backend/src/controllers/settingsController.ts` — `getPublicSettings` returns `mp_connected`.
- `backend/src/controllers/superAdminController.ts` — add `getPlatformSettings` / `updatePlatformSettings`.
- `backend/src/routes/superAdmin.ts` — add `GET/PUT /settings`.
- `frontend/src/types/index.ts` — `AdminTab += 'payments'`, add `MercadoPagoStatus` type.
- `frontend/src/contexts/TenantContext.tsx` — expose `mpConnected`.
- `frontend/src/pages/Admin/AdminDashboard.tsx` — "Pagos" nav item + tab section + `?mp=connected|error` toast.
- `frontend/src/pages/CourseDetail/CourseDetail.tsx` — checkout button calls `/courses/:id/checkout`; `?payment=` banners + polling.
- `frontend/src/pages/CourseDetail/CourseDetail.css` — banner styles.
- `frontend/src/pages/SuperAdmin/SuperAdminDashboard.tsx` — "Comisión de la plataforma (%)" field.

---

### Task 1: Database migration + environment variables

**Files:**
- Create: `database/06-mercadopago.sql`
- Modify: `backend/.env`

- [ ] **Step 1: Write the migration**

Create `database/06-mercadopago.sql`:

```sql
-- database/06-mercadopago.sql
-- Mercado Pago Marketplace integration: OAuth credentials per tenant,
-- global platform settings, and payment tracking on course_purchases.
-- Run AFTER 04-multitenant.sql.

-- OAuth credentials per tenant
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS mp_access_token  TEXT,
  ADD COLUMN IF NOT EXISTS mp_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS mp_user_id       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS mp_connected_at  TIMESTAMPTZ;

-- Global (non-tenant) platform configuration
CREATE TABLE IF NOT EXISTS platform_settings (
  key   VARCHAR(100) PRIMARY KEY,
  value TEXT
);
INSERT INTO platform_settings (key, value) VALUES ('platform_fee_percent', '10')
  ON CONFLICT (key) DO NOTHING;

-- Payment tracking on course_purchases
ALTER TABLE course_purchases
  ADD COLUMN IF NOT EXISTS mp_preference_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS mp_payment_id    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_status   VARCHAR(20) NOT NULL DEFAULT 'approved';

-- Existing rows (manually-granted demo purchases) stay 'approved'.
-- New purchases created via checkout will explicitly set 'pending'.
ALTER TABLE course_purchases ALTER COLUMN payment_status SET DEFAULT 'pending';
```

- [ ] **Step 2: Apply the migration**

Run:
```bash
psql "$DATABASE_URL" -f database/06-mercadopago.sql
```
Expected output: a series of `ALTER TABLE` / `CREATE TABLE` / `INSERT 0 1` (or `INSERT 0 0` if the row already exists) lines, no errors.

- [ ] **Step 3: Verify the migration**

Run:
```bash
psql "$DATABASE_URL" -c "\d tenants" -c "\d course_purchases" -c "SELECT * FROM platform_settings"
```
Expected: `tenants` has `mp_access_token, mp_refresh_token, mp_user_id, mp_connected_at`; `course_purchases` has `mp_preference_id, mp_payment_id, payment_status`; `platform_settings` has one row `platform_fee_percent | 10`.

- [ ] **Step 4: Add new environment variables**

Edit `backend/.env` (append):

```
MP_CLIENT_ID=
MP_CLIENT_SECRET=
MP_REDIRECT_URI=http://localhost:3000/api/mercadopago/callback
MP_WEBHOOK_SECRET=
BACKEND_URL=http://localhost:3000
```

These are left empty for now — the project owner fills `MP_CLIENT_ID`/`MP_CLIENT_SECRET`/`MP_WEBHOOK_SECRET` with values from their Mercado Pago Developer application (`developers.mercadopago.com`) before testing OAuth/webhooks end-to-end. `MP_REDIRECT_URI` must match the "Redirect URI" configured on that application.

- [ ] **Step 5: Commit**

```bash
git add database/06-mercadopago.sql backend/.env
git commit -m "feat(db): add Mercado Pago OAuth columns and platform_settings table"
```

---

### Task 2: Mercado Pago service module

**Files:**
- Create: `backend/src/services/mercadopago.ts`

- [ ] **Step 1: Write the service**

Create `backend/src/services/mercadopago.ts`:

```ts
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
  return res.json();
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
  return res.json();
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
  const data = await res.json();
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
  return res.json();
};

export const getPayment = async (paymentId: string, accessToken: string): Promise<Record<string, unknown>> => {
  const res = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`MP get payment failed: ${res.status} ${await res.text()}`);
  return res.json();
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
```

- [ ] **Step 2: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/mercadopago.ts
git commit -m "feat(backend): add Mercado Pago REST API service module"
```

---

### Task 3: Tenant frontend URL utility

**Files:**
- Create: `backend/src/utils/tenantUrl.ts`

- [ ] **Step 1: Write the utility**

Create `backend/src/utils/tenantUrl.ts`:

```ts
// Builds the public frontend URL for a tenant. In production each tenant
// has its own subdomain; in development the SPA is served from a single
// FRONTEND_URL and the tenant is selected via VITE_DEV_TENANT.
export const getTenantFrontendUrl = (slug: string): string => {
  if (process.env.NODE_ENV === 'production') {
    return `https://${slug}.atenea-courses.com`;
  }
  return process.env.FRONTEND_URL || 'http://localhost:5173';
};
```

- [ ] **Step 2: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/utils/tenantUrl.ts
git commit -m "feat(backend): add tenant frontend URL helper"
```

---

### Task 4: Mercado Pago controller, routes, and app mount

**Files:**
- Create: `backend/src/controllers/mercadopagoController.ts`
- Create: `backend/src/routes/mercadopago.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Write the controller**

Create `backend/src/controllers/mercadopagoController.ts`:

```ts
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
```

- [ ] **Step 2: Write the routes**

Create `backend/src/routes/mercadopago.ts`:

```ts
import { Router } from 'express';
import { authenticate, requireAdmin, requireSameTenant } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import {
  connectMercadoPago,
  getMercadoPagoStatus,
  disconnectMercadoPago,
  mercadopagoCallback,
  handleWebhook,
} from '../controllers/mercadopagoController';

const router = Router();

router.get(
  '/admin/mercadopago/connect',
  resolveTenant, authenticate, requireAdmin, requireSameTenant,
  connectMercadoPago
);
router.get(
  '/admin/mercadopago/status',
  resolveTenant, authenticate, requireAdmin, requireSameTenant,
  getMercadoPagoStatus
);
router.delete(
  '/admin/mercadopago/disconnect',
  resolveTenant, authenticate, requireAdmin, requireSameTenant,
  disconnectMercadoPago
);

// Public — no tenant header available on these requests
router.get('/mercadopago/callback', mercadopagoCallback);
router.post('/payments/webhook', handleWebhook);

export default router;
```

- [ ] **Step 3: Mount the routes**

In `backend/src/app.ts`, add the import and `app.use`:

```ts
import mercadopagoRoutes from './routes/mercadopago';
```

```ts
app.use('/api', mercadopagoRoutes);
```

Place it alongside the other `app.use('/api/...')` lines (after `superAdminRoutes`).

- [ ] **Step 4: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/mercadopagoController.ts backend/src/routes/mercadopago.ts backend/src/app.ts
git commit -m "feat(backend): add Mercado Pago connect/status/disconnect/callback/webhook endpoints"
```

---

### Task 5: Checkout endpoint and `checkAccess` update

**Files:**
- Modify: `backend/src/controllers/courseController.ts`
- Modify: `backend/src/routes/courses.ts`

- [ ] **Step 1: Update `checkAccess` to require an approved payment**

In `backend/src/controllers/courseController.ts`, replace the `checkAccess` function (lines 4-19):

```ts
const checkAccess = async (
  userId: string,
  courseId: string,
  tenantId: string,
  role?: string
): Promise<boolean> => {
  if (role === 'admin' || role === 'super_admin') return true;
  const [sub, purchase] = await Promise.all([
    query(
      `SELECT id FROM subscriptions WHERE user_id = $1 AND tenant_id = $2 AND status = 'active' AND ends_at > NOW()`,
      [userId, tenantId]
    ),
    query(
      `SELECT id FROM course_purchases WHERE user_id = $1 AND course_id = $2 AND payment_status = 'approved'`,
      [userId, courseId]
    ),
  ]);
  return sub.rows.length > 0 || purchase.rows.length > 0;
};
```

(Only the second query in `Promise.all` changes — it now filters on `payment_status = 'approved'`.)

- [ ] **Step 2: Restrict `purchaseCourse` to free courses**

Replace the `purchaseCourse` function (currently lines 177-210):

```ts
export const purchaseCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.body;
    const userId = req.user!.userId;

    const courseResult = await query(
      'SELECT * FROM courses WHERE id = $1 AND tenant_id = $2 AND is_published = true',
      [courseId, req.tenantId!]
    );
    if (courseResult.rows.length === 0) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }
    const course = courseResult.rows[0];
    if (course.price) {
      res.status(400).json({ message: 'Este curso requiere pago. Usa el checkout.' });
      return;
    }

    const existing = await query(
      'SELECT id FROM course_purchases WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    );
    if (existing.rows.length > 0) {
      res.status(400).json({ message: 'Course already purchased' });
      return;
    }

    const result = await query(
      `INSERT INTO course_purchases (user_id, course_id, tenant_id, amount, payment_status)
       VALUES ($1, $2, $3, $4, 'approved') RETURNING *`,
      [userId, courseId, req.tenantId!, course.price]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('PurchaseCourse error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
```

- [ ] **Step 3: Add `createCheckout`**

Add the following import at the top of `backend/src/controllers/courseController.ts`:

```ts
import { getValidAccessToken, createPreference } from '../services/mercadopago';
import { getTenantFrontendUrl } from '../utils/tenantUrl';
```

Add this new exported function at the end of the file:

```ts
export const createCheckout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const courseResult = await query(
      'SELECT * FROM courses WHERE id = $1 AND tenant_id = $2 AND is_published = true',
      [id, req.tenantId!]
    );
    const course = courseResult.rows[0];
    if (!course) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }
    if (!course.price) {
      res.status(400).json({ message: 'Este curso es gratuito' });
      return;
    }

    const existingResult = await query(
      'SELECT * FROM course_purchases WHERE user_id = $1 AND course_id = $2',
      [userId, id]
    );
    const existing = existingResult.rows[0];
    if (existing?.payment_status === 'approved') {
      res.status(400).json({ message: 'Ya tienes acceso a este curso' });
      return;
    }

    const tenantResult = await query(
      'SELECT id, slug, mp_access_token, mp_refresh_token, mp_connected_at FROM tenants WHERE id = $1',
      [req.tenantId!]
    );
    const tenant = tenantResult.rows[0];
    if (!tenant?.mp_access_token) {
      res.status(400).json({ message: 'Esta academia no tiene pagos configurados' });
      return;
    }

    const settingsResult = await query(
      `SELECT value FROM platform_settings WHERE key = 'platform_fee_percent'`
    );
    const feePercent = Number(settingsResult.rows[0]?.value || '10');
    const price = Number(course.price);
    const marketplaceFee = Math.round(price * feePercent) / 100;

    let purchaseId: string;
    if (existing) {
      purchaseId = existing.id;
      await query(
        `UPDATE course_purchases SET payment_status = 'pending', amount = $1 WHERE id = $2`,
        [price, purchaseId]
      );
    } else {
      const inserted = await query(
        `INSERT INTO course_purchases (user_id, course_id, tenant_id, amount, payment_status)
         VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
        [userId, id, req.tenantId!, price]
      );
      purchaseId = inserted.rows[0].id;
    }

    const accessToken = await getValidAccessToken(tenant);
    const courseUrl = `${getTenantFrontendUrl(tenant.slug)}/courses/${id}`;

    const preference = await createPreference({
      accessToken,
      title: course.title,
      price,
      marketplaceFee,
      externalReference: purchaseId,
      backUrls: {
        success: `${courseUrl}?payment=success`,
        failure: `${courseUrl}?payment=failure`,
        pending: `${courseUrl}?payment=pending`,
      },
      notificationUrl: `${process.env.BACKEND_URL}/api/payments/webhook`,
    });

    await query('UPDATE course_purchases SET mp_preference_id = $1 WHERE id = $2', [preference.id, purchaseId]);

    res.json({ init_point: preference.init_point });
  } catch (error) {
    console.error('CreateCheckout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
```

- [ ] **Step 4: Add the route**

In `backend/src/routes/courses.ts`, add the import and route:

```ts
import {
  getCourses, getCourseById, getCategories, getInstructors,
  createSubscription, purchaseCourse, createCheckout,
  getLessonById, updateLessonProgress,
} from '../controllers/courseController';
```

```ts
router.post('/:id/checkout', authenticate, requireSameTenant, createCheckout);
```

Add it next to the other authenticated course routes (after `router.post('/purchase', ...)`).

- [ ] **Step 5: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/courseController.ts backend/src/routes/courses.ts
git commit -m "feat(backend): add course checkout via Mercado Pago and require approved payment for access"
```

---

### Task 6: Expose Mercado Pago connection status on public settings

**Files:**
- Modify: `backend/src/controllers/settingsController.ts`

- [ ] **Step 1: Add `mp_connected` to `getPublicSettings`**

In `backend/src/controllers/settingsController.ts`, replace `getPublicSettings`:

```ts
export const getPublicSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const [settingsResult, tenantResult] = await Promise.all([
      query(
        `SELECT key, value FROM site_settings WHERE tenant_id = $1 AND key IN ('logo_url', 'site_name')`,
        [req.tenantId!]
      ),
      query('SELECT mp_access_token FROM tenants WHERE id = $1', [req.tenantId!]),
    ]);
    const settings: Record<string, string | boolean | null> = { logo_url: null, site_name: 'Atenea Courses' };
    settingsResult.rows.forEach((r: { key: string; value: string | null }) => {
      settings[r.key] = r.value;
    });
    settings.mp_connected = !!tenantResult.rows[0]?.mp_access_token;
    res.json(settings);
  } catch (error) {
    console.error('GetPublicSettings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
```

- [ ] **Step 2: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/settingsController.ts
git commit -m "feat(backend): expose Mercado Pago connection status on public settings"
```

---

### Task 7: Super Admin platform fee settings

**Files:**
- Modify: `backend/src/controllers/superAdminController.ts`
- Modify: `backend/src/routes/superAdmin.ts`

- [ ] **Step 1: Add the controller functions**

Append to `backend/src/controllers/superAdminController.ts`:

```ts
export const getPlatformSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(`SELECT value FROM platform_settings WHERE key = 'platform_fee_percent'`);
    res.json({ platformFeePercent: Number(result.rows[0]?.value ?? '10') });
  } catch (error) {
    console.error('GetPlatformSettings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updatePlatformSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { platformFeePercent } = req.body;
    if (typeof platformFeePercent !== 'number' || platformFeePercent < 0 || platformFeePercent > 100) {
      res.status(400).json({ message: 'platformFeePercent must be a number between 0 and 100' });
      return;
    }
    await query(
      `INSERT INTO platform_settings (key, value) VALUES ('platform_fee_percent', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [String(platformFeePercent)]
    );
    res.json({ platformFeePercent });
  } catch (error) {
    console.error('UpdatePlatformSettings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
```

- [ ] **Step 2: Add the routes**

In `backend/src/routes/superAdmin.ts`:

```ts
import { listTenants, createTenant, getTenant, assignAdmin, getPlatformSettings, updatePlatformSettings } from '../controllers/superAdminController';
```

```ts
router.get('/settings', getPlatformSettings);
router.put('/settings', updatePlatformSettings);
```

- [ ] **Step 3: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/superAdminController.ts backend/src/routes/superAdmin.ts
git commit -m "feat(backend): add super-admin endpoints for platform commission percentage"
```

---

### Task 8: Frontend types and TenantContext

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/contexts/TenantContext.tsx`

- [ ] **Step 1: Update `AdminTab` and add `MercadoPagoStatus`**

In `frontend/src/types/index.ts`, change:

```ts
export type AdminTab = 'overview' | 'courses' | 'users' | 'branding';
```
to:
```ts
export type AdminTab = 'overview' | 'courses' | 'users' | 'branding' | 'payments';
```

Add a new interface (anywhere after `AdminStats`):

```ts
export interface MercadoPagoStatus {
  connected: boolean;
  mpUserId: string | null;
}
```

- [ ] **Step 2: Expose `mpConnected` from `TenantContext`**

In `frontend/src/contexts/TenantContext.tsx`, update the `TenantSettings` interface:

```ts
interface TenantSettings {
  tenantSlug: string;
  tenantName: string;
  logoUrl: string | null;
  mpConnected: boolean;
  notFound: boolean;
  refreshSettings: () => Promise<void>;
}
```

Add state and update `refreshSettings` and the provider value:

```ts
export const TenantProvider: React.FC<{
  tenantSlug: string;
  children: React.ReactNode;
}> = ({ tenantSlug, children }) => {
  const [tenantName, setTenantName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [mpConnected, setMpConnected] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const refreshSettings = useCallback(async () => {
    try {
      const { data } = await api.get<{ site_name: string; logo_url: string | null; mp_connected: boolean }>(
        '/settings/public'
      );
      setTenantName(data.site_name || tenantSlug);
      setLogoUrl(data.logo_url);
      setMpConnected(!!data.mp_connected);
      setNotFound(false);
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } }).response?.status === 404) {
        setNotFound(true);
      }
    }
  }, [tenantSlug]);

  useEffect(() => { refreshSettings(); }, [refreshSettings]);

  return (
    <TenantContext.Provider value={{ tenantSlug, tenantName, logoUrl, mpConnected, notFound, refreshSettings }}>
      {children}
    </TenantContext.Provider>
  );
};
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/contexts/TenantContext.tsx
git commit -m "feat(frontend): add payments admin tab type and expose Mercado Pago connection status"
```

---

### Task 9: Admin "Pagos" tab

**Files:**
- Create: `frontend/src/pages/Admin/PaymentsTab.tsx`
- Modify: `frontend/src/pages/Admin/AdminDashboard.tsx`

- [ ] **Step 1: Write `PaymentsTab`**

Create `frontend/src/pages/Admin/PaymentsTab.tsx`:

```tsx
import React, { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { MercadoPagoStatus } from '../../types';

const PaymentsTab: React.FC = () => {
  const [status, setStatus] = useState<MercadoPagoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<MercadoPagoStatus>('/admin/mercadopago/status');
      setStatus(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data } = await api.get<{ url: string }>('/admin/mercadopago/connect');
      window.location.href = data.url;
    } catch {
      alert('Error al iniciar la conexión con Mercado Pago.');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('¿Desconectar Mercado Pago? Dejarás de recibir pagos hasta volver a conectar.')) return;
    setDisconnecting(true);
    try {
      await api.delete('/admin/mercadopago/disconnect');
      await loadStatus();
    } catch {
      alert('Error al desconectar.');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return <p style={{ color: 'var(--color-on-surface-variant)' }}>Cargando...</p>;
  }

  return (
    <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-headline-sm)', color: 'var(--color-on-surface)', marginBottom: 8 }}>
          Mercado Pago
        </h3>
        <p style={{ color: 'var(--color-on-surface-variant)', fontSize: 'var(--text-body-md)' }}>
          Conecta tu cuenta de Mercado Pago para recibir pagos de los cursos de tu academia.
          Atenea Courses cobra una comisión automática por cada venta.
        </p>
      </div>

      <div style={{
        padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--color-surface-container)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span className="material-symbols-outlined" style={{ color: status?.connected ? 'var(--color-success)' : 'var(--color-on-surface-variant)' }}>
          {status?.connected ? 'check_circle' : 'cancel'}
        </span>
        <span style={{ fontWeight: 600, color: 'var(--color-on-surface)' }}>
          {status?.connected ? 'Conectado' : 'No conectado'}
        </span>
      </div>

      {status?.connected ? (
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          style={{
            padding: '12px 28px', background: 'transparent', color: 'var(--color-error)',
            border: '1px solid var(--color-error)', borderRadius: 'var(--radius-full)',
            fontWeight: 700, cursor: disconnecting ? 'not-allowed' : 'pointer',
            opacity: disconnecting ? 0.7 : 1, alignSelf: 'flex-start',
          }}
        >
          {disconnecting ? 'Desconectando...' : 'Desconectar'}
        </button>
      ) : (
        <button
          onClick={handleConnect}
          disabled={connecting}
          style={{
            padding: '12px 28px', background: 'var(--color-primary)', color: 'var(--color-on-primary)',
            border: 'none', borderRadius: 'var(--radius-full)', fontWeight: 700,
            cursor: connecting ? 'not-allowed' : 'pointer', opacity: connecting ? 0.7 : 1, alignSelf: 'flex-start',
          }}
        >
          {connecting ? 'Conectando...' : 'Conectar con Mercado Pago'}
        </button>
      )}
    </div>
  );
};

export default PaymentsTab;
```

- [ ] **Step 2: Wire it into `AdminDashboard`**

In `frontend/src/pages/Admin/AdminDashboard.tsx`, add the import near the top (with the other imports):

```ts
import PaymentsTab from './PaymentsTab';
```

Add `'payments'` to the `navItems` array (after `branding`):

```ts
const navItems: { id: AdminTab; icon: string; label: string }[] = [
  { id: 'overview', icon: 'dashboard', label: 'Resumen' },
  { id: 'courses', icon: 'play_circle', label: 'Cursos' },
  { id: 'users', icon: 'group', label: 'Usuarios' },
  { id: 'branding', icon: 'palette', label: 'Personalización' },
  { id: 'payments', icon: 'payments', label: 'Pagos' },
];
```

Add the tab section right after the `{/* ── BRANDING ── */}` block (around line 604, before the closing `</main>`):

```tsx
{/* ── PAYMENTS ── */}
{tab === 'payments' && (
  <>
    <h1 className="admin-page-title">Pagos</h1>
    <p className="admin-page-subtitle">Conecta Mercado Pago para cobrar tus cursos.</p>
    <PaymentsTab />
  </>
)}
```

- [ ] **Step 3: Add `?mp=connected|error` toast handling**

In `AdminDashboard.tsx`, add a new state near the other `useState` declarations (e.g. right after `const [categories, setCategories] = useState<Category[]>([]);`):

```ts
const [mpToast, setMpToast] = useState<string | null>(null);
```

Add a new `useEffect` near the existing effects (after the `useEffect` that loads categories/stats/courses):

```ts
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const mp = params.get('mp');
  if (mp === 'connected') {
    setMpToast('Mercado Pago conectado correctamente.');
    setTab('payments');
  } else if (mp === 'error') {
    setMpToast('No se pudo conectar Mercado Pago. Intenta nuevamente.');
  }
  if (mp) {
    params.delete('mp');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }
}, []);
```

Render the toast at the top of `<main className="admin-main">`, right after the opening tag:

```tsx
<main className="admin-main">
  {mpToast && (
    <div
      style={{
        padding: '12px 20px', marginBottom: 24, borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface-container)', color: 'var(--color-on-surface)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}
    >
      <span>{mpToast}</span>
      <button onClick={() => setMpToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
      </button>
    </div>
  )}
```

(Keep the rest of `<main>`'s existing content below this block.)

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Admin/PaymentsTab.tsx frontend/src/pages/Admin/AdminDashboard.tsx
git commit -m "feat(frontend): add admin Pagos tab to connect/disconnect Mercado Pago"
```

---

### Task 10: Course checkout button and payment banners

**Files:**
- Modify: `frontend/src/pages/CourseDetail/CourseDetail.tsx`
- Modify: `frontend/src/pages/CourseDetail/CourseDetail.css`

- [ ] **Step 1: Add `useSearchParams` and `useTenant` imports**

In `frontend/src/pages/CourseDetail/CourseDetail.tsx`, change:

```ts
import { useParams, Link, useNavigate } from 'react-router-dom';
```
to:
```ts
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
```

Add, alongside the `useAuth` import:

```ts
import { useTenant } from '../../contexts/TenantContext';
```

- [ ] **Step 2: Read the `payment` query param and tenant MP status**

Inside the component, after `const navigate = useNavigate();`, add:

```ts
const [searchParams] = useSearchParams();
const paymentParam = searchParams.get('payment');
const { mpConnected } = useTenant();
```

- [ ] **Step 3: Poll for access after a successful payment**

Add a new `useEffect` after the existing course-loading `useEffect` (still before the early `return`s, so it runs on every render but the hook itself is unconditional):

```ts
useEffect(() => {
  if (paymentParam !== 'success' || !id) return;
  let attempts = 0;
  const interval = setInterval(async () => {
    attempts += 1;
    const { data } = await api.get<Course>(`/courses/${id}`);
    setCourse(data);
    if (data.hasAccess || attempts >= 3) {
      clearInterval(interval);
    }
  }, 2000);
  return () => clearInterval(interval);
}, [paymentParam, id]);
```

- [ ] **Step 4: Render payment banners**

Inside `<section className="course-main">`, right after the closing `</nav>` of the breadcrumb, add:

```tsx
{paymentParam === 'success' && (
  <div className="payment-banner payment-banner-success">
    ¡Pago recibido! Activando tu acceso...
  </div>
)}
{paymentParam === 'pending' && (
  <div className="payment-banner payment-banner-pending">
    Tu pago está siendo procesado.
  </div>
)}
{paymentParam === 'failure' && (
  <div className="payment-banner payment-banner-failure">
    El pago no se pudo procesar. Intentá nuevamente.
  </div>
)}
```

- [ ] **Step 5: Replace the "Comprar" button to use checkout**

Replace the existing purchase button (currently lines 134-146):

```tsx
{!course.is_membership_exclusive && course.price && isAuthenticated && (
  <button
    className="btn-outline"
    disabled={!mpConnected}
    title={!mpConnected ? 'No disponible por el momento' : undefined}
    onClick={async () => {
      try {
        const { data } = await api.post<{ init_point: string }>(`/courses/${course.id}/checkout`);
        window.location.href = data.init_point;
      } catch (err: unknown) {
        const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
        alert(message || 'Error al iniciar el pago. Por favor intenta de nuevo.');
      }
    }}
  >
    Comprar por ${course.price}
  </button>
)}
```

- [ ] **Step 6: Add banner styles**

In `frontend/src/pages/CourseDetail/CourseDetail.css`, add at the end of the file:

```css
/* Payment result banners */
.payment-banner {
  padding: 12px 20px;
  border-radius: var(--radius-md);
  margin-bottom: 24px;
  font-weight: 600;
}
.payment-banner-success {
  background: color-mix(in srgb, var(--color-success) 16%, transparent);
  color: var(--color-success);
}
.payment-banner-pending {
  background: color-mix(in srgb, var(--color-primary) 16%, transparent);
  color: var(--color-primary);
}
.payment-banner-failure {
  background: color-mix(in srgb, var(--color-error) 16%, transparent);
  color: var(--color-error);
}
```

- [ ] **Step 7: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/CourseDetail/CourseDetail.tsx frontend/src/pages/CourseDetail/CourseDetail.css
git commit -m "feat(frontend): add Mercado Pago checkout button and payment result banners to course detail"
```

---

### Task 11: Super Admin platform commission field

**Files:**
- Modify: `frontend/src/pages/SuperAdmin/SuperAdminDashboard.tsx`

- [ ] **Step 1: Load and display the platform fee**

In `frontend/src/pages/SuperAdmin/SuperAdminDashboard.tsx`, add state near the other `useState` declarations:

```ts
const [platformFee, setPlatformFee] = useState<number>(10);
const [feeInput, setFeeInput] = useState('10');
const [savingFee, setSavingFee] = useState(false);
const [feeSaved, setFeeSaved] = useState(false);
```

Update the `load` function to also fetch settings:

```ts
const load = async () => {
  const [{ data: tenantsData }, { data: settingsData }] = await Promise.all([
    api.get<Tenant[]>('/super-admin/tenants'),
    api.get<{ platformFeePercent: number }>('/super-admin/settings'),
  ]);
  setTenants(tenantsData);
  setPlatformFee(settingsData.platformFeePercent);
  setFeeInput(String(settingsData.platformFeePercent));
};
```

- [ ] **Step 2: Add the save handler**

```ts
const handleSaveFee = async () => {
  const value = Number(feeInput);
  if (Number.isNaN(value) || value < 0 || value > 100) {
    alert('La comisión debe ser un número entre 0 y 100.');
    return;
  }
  setSavingFee(true);
  setFeeSaved(false);
  try {
    await api.put('/super-admin/settings', { platformFeePercent: value });
    setPlatformFee(value);
    setFeeSaved(true);
  } catch {
    alert('Error al guardar la comisión.');
  } finally {
    setSavingFee(false);
  }
};
```

- [ ] **Step 3: Render the field**

In the JSX, add a new section right after the closing `</header>` and before `<div className="super-admin-table-wrap">`:

```tsx
<div className="super-admin-table-wrap" style={{ padding: 24, marginBottom: 24 }}>
  <h2 className="super-admin-title" style={{ fontSize: '1.1rem', marginBottom: 12 }}>
    Comisión de la plataforma (%)
  </h2>
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <input
      type="number"
      min={0}
      max={100}
      step="0.1"
      value={feeInput}
      onChange={e => setFeeInput(e.target.value)}
      className="super-admin-input"
      style={{ maxWidth: 120 }}
    />
    <button className="super-admin-btn-primary" onClick={handleSaveFee} disabled={savingFee}>
      {savingFee ? 'Guardando...' : 'Guardar'}
    </button>
    {feeSaved && <span style={{ color: 'var(--color-success)' }}>Guardado</span>}
  </div>
  <p style={{ color: 'var(--color-on-surface-variant)', marginTop: 8, fontSize: '0.85rem' }}>
    Actual: {platformFee}% sobre cada venta de curso.
  </p>
</div>
```

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/SuperAdmin/SuperAdminDashboard.tsx
git commit -m "feat(frontend): add platform commission percentage field to super admin dashboard"
```

---

### Task 12: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start backend and frontend**

```bash
cd backend && npm run dev
```
```bash
cd frontend && npm run dev
```
Expected: backend logs `Server running on port 3000` (or similar) after `SELECT 1` succeeds; frontend serves on `http://localhost:5173`.

- [ ] **Step 2: Fill in real Mercado Pago test credentials**

In `backend/.env`, set `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_WEBHOOK_SECRET` from a Mercado Pago **test** application at developers.mercadopago.com, and restart the backend. `MP_REDIRECT_URI` should be `http://localhost:3000/api/mercadopago/callback` (must match the app's configured redirect URI).

- [ ] **Step 3: Connect a test tenant to Mercado Pago**

1. Log in to `http://localhost:5173` as an admin of a test tenant (set `VITE_DEV_TENANT` to that tenant's slug if needed).
2. Go to Admin → Pagos.
3. Expected: status shows "No conectado" and a "Conectar con Mercado Pago" button.
4. Click it, log in with a Mercado Pago **test seller** account, and authorize.
5. Expected: redirected back to `/admin?mp=connected`, toast "Mercado Pago conectado correctamente.", status now shows "Conectado".

- [ ] **Step 4: Buy a course with a test buyer**

1. As a different user (test buyer), open a priced course's detail page.
2. Expected: "Comprar por $X" button is enabled (tenant is MP-connected).
3. Click it — expected redirect to Mercado Pago Checkout Pro.
4. Pay using a Mercado Pago **test card** (test buyer credentials).
5. Expected: redirected back to `/courses/:id?payment=success`, banner "¡Pago recibido! Activando tu acceso...", and within ~6 seconds (webhook + poll) the video player unlocks (`hasAccess: true`).

- [ ] **Step 5: Verify the database state**

```bash
psql "$DATABASE_URL" -c "SELECT id, user_id, course_id, payment_status, mp_preference_id, mp_payment_id FROM course_purchases ORDER BY id DESC LIMIT 1"
```
Expected: the most recent row has `payment_status = 'approved'` and both `mp_preference_id` and `mp_payment_id` set.

- [ ] **Step 6: Verify disconnect and re-connect**

1. In Admin → Pagos, click "Desconectar" and confirm.
2. Expected: status returns to "No conectado".
3. Reload a priced course page as the buyer — expected the "Comprar" button is now disabled with the tooltip "No disponible por el momento".
4. Reconnect MP (Step 3) to leave the tenant in a working state.

- [ ] **Step 7: Verify the super-admin commission field**

1. Log in as `super_admin` and open the Super Admin dashboard.
2. Expected: "Comisión de la plataforma (%)" shows `10`.
3. Change it to `15` and click "Guardar" — expected "Guardado" appears.
4. Repeat Step 4 with a new course purchase and confirm (via Mercado Pago's dashboard for the test seller, or the preference's `marketplace_fee` in the MP API response logged during development) that the fee charged is now 15% of the price.

---

## Out of Scope (unchanged from spec)

- Recurring subscriptions/memberships via Mercado Pago.
- Per-tenant commission rates.
- Token encryption at rest.
