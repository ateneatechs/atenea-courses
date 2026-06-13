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
