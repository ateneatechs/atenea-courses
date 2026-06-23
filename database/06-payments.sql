-- database/06-payments.sql
-- Mercado Pago payment tracking + per-tenant gateway settings.
-- Run AFTER 05-demo-naza-barber.sql.

-- 1. Payments table (idempotency + audit trail for Mercado Pago)
CREATE TABLE IF NOT EXISTS payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type             VARCHAR(20) NOT NULL CHECK (type IN ('course', 'subscription')),
  course_id        UUID REFERENCES courses(id) ON DELETE SET NULL,
  plan             VARCHAR(20),
  amount           DECIMAL(10,2) NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  mp_preference_id TEXT,
  mp_payment_id    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  processed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant     ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_user       ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_mp_payment ON payments(mp_payment_id);

-- 2. Default payment settings for the Naza Barber tenant (disabled until a token is loaded)
INSERT INTO site_settings (tenant_id, key, value)
SELECT id, 'mp_enabled', 'false' FROM tenants WHERE slug = 'naza-barber'
ON CONFLICT DO NOTHING;

INSERT INTO site_settings (tenant_id, key, value)
SELECT id, 'mp_access_token', '' FROM tenants WHERE slug = 'naza-barber'
ON CONFLICT DO NOTHING;
