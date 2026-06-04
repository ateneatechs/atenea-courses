-- database/05-demo-naza-barber.sql
-- Creates the Naza Barber tenant and migrates all existing data to it.
-- Run AFTER 04-multitenant.sql.

-- 1. Create Naza Barber tenant
INSERT INTO tenants (slug, name)
VALUES ('naza-barber', 'Naza Barber')
ON CONFLICT (slug) DO NOTHING;

-- 2. Migrate existing rows to this tenant
UPDATE categories
SET tenant_id = (SELECT id FROM tenants WHERE slug = 'naza-barber')
WHERE tenant_id IS NULL;

UPDATE courses
SET tenant_id = (SELECT id FROM tenants WHERE slug = 'naza-barber')
WHERE tenant_id IS NULL;

UPDATE users
SET tenant_id = (SELECT id FROM tenants WHERE slug = 'naza-barber')
WHERE tenant_id IS NULL AND role IN ('user', 'admin');

UPDATE subscriptions
SET tenant_id = (SELECT id FROM tenants WHERE slug = 'naza-barber')
WHERE tenant_id IS NULL;

UPDATE course_purchases
SET tenant_id = (SELECT id FROM tenants WHERE slug = 'naza-barber')
WHERE tenant_id IS NULL;

-- 3. Default site settings for Naza Barber
INSERT INTO site_settings (tenant_id, key, value)
SELECT id, 'site_name', 'Naza Barber' FROM tenants WHERE slug = 'naza-barber'
ON CONFLICT DO NOTHING;

INSERT INTO site_settings (tenant_id, key, value)
SELECT id, 'logo_url', NULL FROM tenants WHERE slug = 'naza-barber'
ON CONFLICT DO NOTHING;
