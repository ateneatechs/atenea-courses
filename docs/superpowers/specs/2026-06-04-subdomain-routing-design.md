# Subdomain-Based Multi-Tenant Routing — Design Spec

**Date:** 2026-06-04
**Status:** Approved

## Goal

Replace path-based tenant routing (`/:tenantSlug/*`) with subdomain-based routing (`naza-barber.atenea-courses.com/*`). Each barber client gets their own subdomain to share with their students. The root domain becomes an Atenea sales landing page.

---

## Architecture

### URL Structure

```
BEFORE:
  atenea-courses.com/naza-barber/explorer
  atenea-courses.com/naza-barber/courses/:id

AFTER:
  naza-barber.atenea-courses.com/explorer
  naza-barber.atenea-courses.com/courses/:id
  atenea-courses.com/                         ← Atenea sales landing
  atenea-courses.com/super-admin              ← global admin panel
```

### Data Flow (backend unchanged)

1. User visits `naza-barber.atenea-courses.com/explorer`
2. Frontend reads `window.location.hostname` → extracts `naza-barber`
3. Axios interceptor injects `X-Tenant-Slug: naza-barber` on every request
4. Backend resolves tenant from the header — no backend changes needed

---

## Frontend Changes

### New utility: `src/utils/tenant.ts`

Single source of truth for tenant slug resolution:

```typescript
export function getTenantSlug(): string | null {
  const hostname = window.location.hostname;
  // Dev: localhost → read from VITE_DEV_TENANT env var
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return import.meta.env.VITE_DEV_TENANT || null;
  }
  // Prod: naza-barber.atenea-courses.com → "naza-barber"
  const parts = hostname.split('.');
  return parts.length >= 3 ? parts[0] : null;
}
```

### `App.tsx` — flat routes

Remove `/:tenantSlug` prefix. Route selection based on whether a subdomain is detected:

- Subdomain present → `TenantLayout` wrapping tenant routes
- No subdomain → `Landing` (sales page) at `/`, `SuperAdminDashboard` at `/super-admin`

```
/             → TenantLayout > Home        (with subdomain)
/             → Landing                    (no subdomain)
/explorer     → TenantLayout > Explorer
/courses/:id  → TenantLayout > CourseDetail
/membership   → TenantLayout > Membership
/admin/*      → TenantLayout > AdminDashboard (requires admin role)
/super-admin  → SuperAdminDashboard (requires super_admin role)
```

### Modified files

| File | Change |
|------|--------|
| `src/utils/tenant.ts` | **New** — `getTenantSlug()` utility |
| `src/App.tsx` | Remove `/:tenantSlug` prefix, detect subdomain for route selection |
| `src/components/layout/TenantLayout/TenantLayout.tsx` | Use `getTenantSlug()` instead of `useParams` |
| `src/services/api.ts` | Use `getTenantSlug()` instead of parsing pathname |
| `src/components/layout/Navbar/Navbar.tsx` | Absolute links: `/explorer`, `/membership`, `/admin` |
| `src/pages/Home/Home.tsx` | `navigate('/explorer')`, `navigate('/membership')` (absolute) |
| `src/pages/Landing/Landing.tsx` | Rewrite as Atenea sales page |

### Local development

Create `frontend/.env.local`:
```
VITE_DEV_TENANT=naza-barber
```

Access dev server at `localhost:5173` as usual. The env var injects the tenant slug transparently.

---

## VPS + Nginx

### DNS Records (Hostinger)

| Type | Name | Value |
|------|------|-------|
| A | `atenea-courses.com` | `VPS_IP` |
| A | `*.atenea-courses.com` | `VPS_IP` |

### Nginx Config

```nginx
# Tenant subdomains: naza-barber.atenea-courses.com
server {
    listen 443 ssl;
    server_name ~^(?<tenant>.+)\.atenea-courses\.com$;

    ssl_certificate     /etc/letsencrypt/live/atenea-courses.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/atenea-courses.com/privkey.pem;

    location /api      { proxy_pass http://localhost:3000; proxy_set_header Host $host; }
    location /uploads  { proxy_pass http://localhost:3000; }
    location /         { proxy_pass http://localhost:5173; }
}

# Root domain: atenea-courses.com
server {
    listen 443 ssl;
    server_name atenea-courses.com;

    ssl_certificate     /etc/letsencrypt/live/atenea-courses.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/atenea-courses.com/privkey.pem;

    location /api         { proxy_pass http://localhost:3000; proxy_set_header Host $host; }
    location /super-admin { proxy_pass http://localhost:5173; }
    location /            { proxy_pass http://localhost:5173; }
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name atenea-courses.com *.atenea-courses.com;
    return 301 https://$host$request_uri;
}
```

### SSL — Wildcard Certificate

```bash
certbot certonly --dns-hostinger \
  -d atenea-courses.com \
  -d *.atenea-courses.com
```

One certificate covers the root domain and all subdomains. New tenants are covered automatically — no Nginx changes needed when adding clients.

---

## What Does NOT Change

- Backend middleware (`resolveTenant`) — still reads `X-Tenant-Slug` header
- Backend controllers, routes, database schema
- All auth flows
- Admin dashboard
- Super-admin panel URL (`/super-admin`)

---

## Adding a New Tenant (post-implementation)

1. Super-admin creates tenant in dashboard → gets slug (e.g. `otro-barber`)
2. DNS wildcard already covers `otro-barber.atenea-courses.com` — nothing to configure
3. Barber shares `otro-barber.atenea-courses.com` with their students
4. Done
