ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users ADD CONSTRAINT unique_tenant_email UNIQUE (tenant_id, email);

-- tenant_id is NULL for super_admins; NULLs don't collide in a normal UNIQUE
-- constraint, so this partial index closes that gap for the tenant_id IS NULL set.
CREATE UNIQUE INDEX unique_null_tenant_email ON users (email) WHERE tenant_id IS NULL;
