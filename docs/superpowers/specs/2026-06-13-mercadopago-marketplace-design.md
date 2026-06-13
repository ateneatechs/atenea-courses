# Mercado Pago Marketplace Integration — Design Spec

**Date:** 2026-06-13
**Status:** Approved, ready for implementation plan

## Goal

Allow each tenant (barber academy) to receive real payments for individual course
purchases through Mercado Pago, with Atenea Courses automatically taking a
platform commission per transaction. Subscriptions/memberships remain
manually-activated for now (out of scope for this spec).

## Context

- Multitenant isolation was just hardened (commit `12cb805`): JWT now carries
  `tenantId`, and `requireSameTenant` middleware blocks cross-tenant access.
- Today, `purchaseCourse` in `backend/src/controllers/courseController.ts`
  inserts a `course_purchases` row and grants access immediately — no real
  payment happens.
- `course_purchases` table (added in `database/04-multitenant.sql`) has
  `user_id, course_id, tenant_id, amount`.

## Architecture

### Model: Marketplace OAuth + per-transaction commission

Each tenant connects **their own** Mercado Pago account via OAuth ("Mercado
Pago Connect"). When a student pays for a course, the money goes directly to
the tenant's MP account; Atenea Courses takes a percentage automatically via
MP's `marketplace_fee` (application fee) mechanism.

**Prerequisite (one-time, done by the Atenea Courses owner, not in code):**
register an "Application" at developers.mercadopago.com to obtain
`MP_CLIENT_ID` / `MP_CLIENT_SECRET` for the platform's OAuth app.

### Flow

```
Student                    Backend                         Mercado Pago
  |--- "Comprar curso" ------->|                                 |
  |                            |--- create preference --------->|
  |                            |    (tenant's access_token,      |
  |                            |     marketplace_fee = %)        |
  |                            |<-- init_point ------------------|
  |<-- redirect to MP ---------|                                 |
  |--- pays on MP ------------------------------------------------>|
  |<-- redirect back (back_urls: success/failure/pending) ----------|
  |                            |<-- webhook (payment id) ---------|
  |                            |--- GET /v1/payments/{id} ------->|
  |                            |--- update course_purchases ------|
  |                            |    payment_status='approved'     |
```

**Connection flow (once per academy):** Admin clicks "Conectar con Mercado
Pago" in their admin panel → `GET /api/admin/mercadopago/connect` returns MP's
OAuth authorize URL with a signed `state` (HMAC, identifies the tenant) →
admin authorizes on MP → MP redirects to `GET /api/mercadopago/callback` →
backend exchanges `code` for `access_token`/`refresh_token`/`mp_user_id`,
stores on the tenant row, redirects back to
`https://<slug>.atenea-courses.com/admin?mp=connected`.

## Database Changes

New migration `database/06-mercadopago.sql`:

```sql
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

`payment_status` values: `'pending' | 'approved' | 'rejected'`.

## Behavior Change: `checkAccess`

`checkAccess()` in `courseController.ts` currently grants access if a
`course_purchases` row exists. It must now require
`payment_status = 'approved'`:

```sql
SELECT id FROM course_purchases
WHERE user_id = $1 AND course_id = $2 AND payment_status = 'approved'
```

## Backend Endpoints

### MP connection (admin)
- `GET /api/admin/mercadopago/connect` (auth, requireAdmin, requireSameTenant)
  → returns `{ url: <MP OAuth authorize URL with signed state> }`
- `GET /api/mercadopago/callback?code=&state=` (public route)
  → verifies `state`, exchanges `code` for tokens via
  `POST https://api.mercadopago.com/oauth/token`, stores on `tenants`,
  redirects to `https://<slug>.atenea-courses.com/admin?mp=connected`
- `GET /api/admin/mercadopago/status` (auth, requireAdmin, requireSameTenant)
  → `{ connected: boolean, mpUserId?: string }`
- `DELETE /api/admin/mercadopago/disconnect` (auth, requireAdmin, requireSameTenant)
  → clears MP columns on the tenant row

### Checkout (student)
- `POST /api/courses/:id/checkout` (auth, requireSameTenant)
  1. Validate course exists, `is_published`, and not already `approved` for
     this user.
  2. If tenant has no `mp_access_token` → `400 { message: 'Esta academia no
     tiene pagos configurados' }`.
  3. Refresh tenant's `access_token` if needed (MP tokens expire ~6h;
     `grant_type=refresh_token`).
  4. Create MP preference: `items` (course title/price), `marketplace_fee`
     (= price × `platform_fee_percent` / 100), `external_reference` (id of
     the pending `course_purchases` row), `back_urls` (success/failure/pending
     pointing at the course page with `?payment=` query param),
     `notification_url` (`${BACKEND_URL}/api/payments/webhook`).
  5. Upsert `course_purchases` row: `payment_status='pending'`,
     `mp_preference_id` set.
  6. Return `{ init_point }`.

### Webhook (public)
- `POST /api/payments/webhook`
  1. Verify `x-signature` header (HMAC with `MP_WEBHOOK_SECRET`); reject on
     mismatch.
  2. Read `data.id` (payment id), call `GET /v1/payments/{id}` using the
     platform's own OAuth app access token (confirm during implementation
     that this is permitted for marketplace-connected payments; fall back to
     looking up the tenant via `external_reference` first and using that
     tenant's token if not).
  3. Match `external_reference` to the `course_purchases` row; sanity-check
     `collector_id` against the tenant's `mp_user_id`.
  4. Update `payment_status` (`approved`/`rejected`/`pending` for
     `in_process`) and `mp_payment_id`.
  5. Respond `200` quickly.

### Platform config (super admin)
- `GET /api/super-admin/settings` / `PUT /api/super-admin/settings`
  (requireSuperAdmin) → read/write `platform_fee_percent` in
  `platform_settings`.

### New environment variables
`MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_REDIRECT_URI`, `MP_WEBHOOK_SECRET`,
`BACKEND_URL`.

## Frontend Changes

### Admin panel
- New "Pagos" section (or extend Branding tab): connection status
  ("✅ Conectado" / "⚠️ No conectado"), "Conectar con Mercado Pago" button
  (redirects to OAuth `url`), "Desconectar" button with confirmation. On
  return with `?mp=connected`, show success toast and refresh status.

### Course detail page
- "Comprar — $X" button for priced courses without access → calls
  `/api/courses/:id/checkout`, redirects to `init_point`.
- If tenant not MP-connected: button disabled with tooltip "No disponible por
  el momento".
- On return with `?payment=success|failure|pending`:
  - `success`: banner "¡Pago recibido! Activando tu acceso..." + poll
    `getCourseById` every 2s (up to 3 tries) until `hasAccess` becomes true
    (webhook may lag the redirect slightly).
  - `pending`: banner "Tu pago está siendo procesado."
  - `failure`: banner "El pago no se pudo procesar. Intentá nuevamente."

### Super Admin dashboard
- New editable field: "Comisión de la plataforma (%)".

## Edge Cases

- Free courses (`price` null/0): keep current direct `purchaseCourse` flow,
  bypass MP entirely.
- Abandoned checkout: row stays `pending`; user can retry, which replaces
  `mp_preference_id` on the same row.
- Webhook arrives before redirect completes: no issue, `hasAccess` is already
  true when the user returns.
- Tenant disconnects MP with pending purchases: those stay `pending`
  indefinitely — acceptable for v1 (rare).

## Security Notes

- `mp_access_token`/`mp_refresh_token` stored in plaintext (consistent with
  current credential storage in this codebase) and never returned in any API
  response.
- OAuth `state` param signed with `JWT_SECRET` to prevent connecting an MP
  account to the wrong tenant.
- Webhook signature verification is mandatory — without it, anyone could call
  the webhook and mark purchases as `approved` for free.

## Testing Plan

- Use MP **test accounts** (seller + buyer sandbox credentials) to exercise
  the full OAuth connect → checkout → webhook → access-grant flow before
  production.
- Manual verification: connect a test tenant, buy a course with a test card,
  confirm `course_purchases.payment_status` becomes `approved` and the course
  unlocks.

## Out of Scope (future work)

- Recurring subscriptions/memberships via MP (preapproval API has limited
  marketplace split support).
- Per-tenant commission rates (global rate only for now).
- Token encryption at rest.
