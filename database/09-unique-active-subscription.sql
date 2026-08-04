CREATE UNIQUE INDEX unique_active_subscription ON subscriptions (user_id, tenant_id) WHERE status = 'active';
