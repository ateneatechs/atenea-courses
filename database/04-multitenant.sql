-- database/04-multitenant.sql
-- Creates tenants table, site_settings, and adds tenant_id to all business tables.
-- Run AFTER schema.sql and 02-purchases-progress.sql.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       VARCHAR(100) UNIQUE NOT NULL,
  name       VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Site settings (per-tenant key/value store)
CREATE TABLE IF NOT EXISTS site_settings (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key       VARCHAR(100) NOT NULL,
  value     TEXT,
  PRIMARY KEY (tenant_id, key)
);

-- 3. Add tenant_id to users (nullable: super_admin has NULL)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- 4. Add tenant_id to courses
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- 5. Add tenant_id to categories
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- 6. Add tenant_id to subscriptions
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- 7. Add tenant_id to course_purchases
ALTER TABLE course_purchases
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- 8. Update role CHECK to allow super_admin
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'admin', 'super_admin'));

-- 9. Indexes for common tenant queries
CREATE INDEX IF NOT EXISTS idx_courses_tenant    ON courses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant      ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subs_tenant       ON subscriptions(tenant_id);
