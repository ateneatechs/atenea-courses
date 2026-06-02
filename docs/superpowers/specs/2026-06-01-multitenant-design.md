---
name: multitenant-architecture
description: Shared-DB multi-tenant architecture for Atenea Courses SaaS. Adds tenant_id to all tables, path-based tenant routing, super-admin panel, and Naza Barber as first demo tenant.
metadata:
  type: project
---

# Atenea Courses — Arquitectura Multitenant

## Contexto

Atenea Courses es una plataforma SaaS de academias online. Cada cliente (barbería, academia) es un **tenant** con sus propios cursos, usuarios, branding y admin. El spec de UI de Naza Barber (`2026-06-01-naza-barber-redesign-design.md`) forma parte de este mismo proyecto — los settings de logo, nombre y paleta son per-tenant.

---

## Modelo elegido: Shared DB + `tenant_id`

Una sola base de datos PostgreSQL. Todas las tablas de negocio tienen una columna `tenant_id UUID FK → tenants.id`. El backend resuelve el tenant desde el header `X-Tenant-Slug` en cada request. Los super-admins tienen `tenant_id = NULL`.

**URL structure:** `atenea-courses.com/:tenantSlug/*`

---

## Sección 1: Base de Datos

### Nueva tabla `tenants`

```sql
CREATE TABLE tenants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       VARCHAR(100) UNIQUE NOT NULL,
  name       VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Columna `tenant_id` en tablas existentes

| Tabla | Nullable | Motivo |
|-------|----------|--------|
| `users` | Sí | super_admin tiene tenant_id = NULL |
| `courses` | No | siempre pertenece a un tenant |
| `categories` | No | siempre pertenece a un tenant |
| `subscriptions` | No | siempre pertenece a un tenant |
| `site_settings` | No | PK pasa a ser (tenant_id, key) |
| `purchases` | No | siempre pertenece a un tenant |

`lessons` y `lesson_progress` se filtran por JOIN a `courses.tenant_id` — no necesitan columna propia.

### Rol `super_admin`

```sql
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'admin', 'super_admin'));
```

### Migración principal: `database/04-multitenant.sql`

```sql
-- 1. Crear tabla tenants
CREATE TABLE tenants (...);

-- 2. Agregar tenant_id a cada tabla
ALTER TABLE users        ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE courses      ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE categories   ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE subscriptions ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE purchases    ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- 3. Cambiar PK de site_settings
ALTER TABLE site_settings ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE site_settings DROP CONSTRAINT site_settings_pkey;
ALTER TABLE site_settings ADD PRIMARY KEY (tenant_id, key);

-- 4. Actualizar CHECK de role
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'admin', 'super_admin'));
```

### Seed demo: `database/05-demo-naza-barber.sql`

```sql
INSERT INTO tenants (slug, name) VALUES ('naza-barber', 'Naza Barber');

UPDATE categories  SET tenant_id = (SELECT id FROM tenants WHERE slug = 'naza-barber');
UPDATE courses     SET tenant_id = (SELECT id FROM tenants WHERE slug = 'naza-barber');
UPDATE users       SET tenant_id = (SELECT id FROM tenants WHERE slug = 'naza-barber')
  WHERE role != 'super_admin';

INSERT INTO site_settings (tenant_id, key, value)
  SELECT id, 'site_name', 'Naza Barber' FROM tenants WHERE slug = 'naza-barber'
  ON CONFLICT DO NOTHING;
INSERT INTO site_settings (tenant_id, key, value)
  SELECT id, 'logo_url', null FROM tenants WHERE slug = 'naza-barber'
  ON CONFLICT DO NOTHING;
```

---

## Sección 2: Backend

### Middleware de tenant: `backend/src/middleware/tenant.ts`

```ts
export const resolveTenant = async (req, res, next) => {
  const slug = req.headers['x-tenant-slug'] as string;
  if (!slug) return res.status(400).json({ message: 'Tenant header required' });
  const result = await query('SELECT id FROM tenants WHERE slug = $1', [slug]);
  if (!result.rows[0]) return res.status(404).json({ message: 'Tenant not found' });
  req.tenantId = result.rows[0].id;
  next();
};
```

Se aplica a todas las rutas excepto `/api/super-admin/*`.

### Guard super-admin: `backend/src/middleware/auth.ts`

Agregar función `requireSuperAdmin`:
```ts
export const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'super_admin') return res.status(403).json({ message: 'Forbidden' });
  next();
};
```

### Tipos: `backend/src/types/index.ts`

```ts
interface JwtPayload {
  userId: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';  // agregar super_admin
}

// Agregar al namespace Express.Request:
tenantId?: string;
```

### Controllers existentes — cambios

Todos los queries de negocio agregan `tenant_id = $N`:

**`courseController.ts`:**
- `getCourses`: `WHERE c.tenant_id = $1 AND c.is_published = true`
- `getCourseById`: `WHERE c.id = $1 AND c.tenant_id = $2`
- Admin CRUD: todos filtran por `req.tenantId`

**`authController.ts`:**
- `register`: INSERT incluye `tenant_id = $4` (viene de `req.tenantId`)
- `login`: SELECT agrega `AND tenant_id = $3` (para no loguear usuarios de otro tenant)
- `getMe`: sin cambio (busca por `user.id`)

**`adminController.ts`:**
- Todos los queries filtran por `req.tenantId`

### Nuevo `settingsController.ts`

```ts
getPublicSettings:  SELECT value FROM site_settings WHERE tenant_id=$1 AND key IN ('logo_url','site_name')
uploadLogo:         multer → guarda en uploads/logos/ → UPDATE site_settings SET value=$1 WHERE tenant_id=$2 AND key='logo_url'
```

### Nuevo `superAdminController.ts`

```ts
listTenants:    SELECT t.*, count(u.id) as users, count(c.id) as courses FROM tenants t LEFT JOIN ...
createTenant:   INSERT INTO tenants (slug, name) + INSERT INTO site_settings defaults
getTenant:      SELECT con stats
assignAdmin:    UPDATE users SET role='admin', tenant_id=$1 WHERE id=$2
```

### Rutas

**`backend/src/routes/settings.ts`** (nuevo):
- `GET /public` → `getPublicSettings` (con `resolveTenant`)

**`backend/src/routes/superAdmin.ts`** (nuevo):
- `GET /tenants` → `listTenants`
- `POST /tenants` → `createTenant`
- `GET /tenants/:id` → `getTenant`
- `POST /tenants/:id/admin` → `assignAdmin`

**`backend/src/app.ts`** — montar routers:
```ts
app.use('/api/settings',     resolveTenant, settingsRouter);
app.use('/api/admin',        resolveTenant, requireAuth, requireAdmin, adminRouter);
app.use('/api/courses',      resolveTenant, coursesRouter);
app.use('/api/auth',         resolveTenant, authRouter);   // register necesita tenant
app.use('/api/super-admin',  requireAuth, requireSuperAdmin, superAdminRouter);
app.use('/uploads',          express.static('uploads'));
```

### Seed super-admin en `backend/src/seed.ts`

```ts
// Insertar super-admin si no existe
await query(`
  INSERT INTO users (email, password_hash, name, role, tenant_id)
  VALUES ('superadmin@atenea.com', $1, 'Super Admin', 'super_admin', NULL)
  ON CONFLICT (email) DO NOTHING
`, [await bcrypt.hash('superadmin123', 12)]);
```

---

## Sección 3: Frontend

### Routing — `frontend/src/App.tsx`

```tsx
<Routes>
  <Route path="/"                  element={<Landing />} />
  <Route path="/super-admin/*"     element={<SuperAdminGuard><SuperAdminDashboard /></SuperAdminGuard>} />
  <Route path="/:tenantSlug"       element={<TenantLayout />}>
    <Route index                   element={<Home />} />
    <Route path="explorer"         element={<Explorer />} />
    <Route path="courses/:id"      element={<CourseDetail />} />
    <Route path="membership"       element={<Membership />} />
    <Route path="admin/*"          element={<AdminGuard><AdminDashboard /></AdminGuard>} />
  </Route>
</Routes>
```

### `TenantContext` — `frontend/src/contexts/TenantContext.tsx`

```ts
interface TenantContextType {
  tenantSlug: string;
  tenantName: string;
  logoUrl: string | null;
  refreshSettings: () => Promise<void>;
}
```

- Lee `tenantSlug` de `useParams()`
- Fetchea `GET /api/settings/public` con header `X-Tenant-Slug: tenantSlug`
- Si el fetch devuelve 404 → renderiza `<TenantNotFound />`
- Reemplaza el `SiteSettingsContext` del spec anterior

### `api.ts` — interceptor de tenant

```ts
api.interceptors.request.use(config => {
  const slug = getTenantSlugFromURL(); // lee window.location.pathname.split('/')[1]
  if (slug && slug !== 'super-admin') {
    config.headers['X-Tenant-Slug'] = slug;
  }
  return config;
});
```

### `TenantLayout.tsx` — `frontend/src/components/layout/TenantLayout/TenantLayout.tsx`

Wrapper que:
1. Provee `<TenantProvider tenantSlug={tenantSlug}>`
2. Renderiza `<Navbar />` + `<Outlet />`
3. Si tenant no encontrado: página 404 "Academia no encontrada"

### `Navbar.tsx` — cambios

- Consume `useTenant()` en lugar del futuro `useSiteSettings()`
- Logo dinámico: `logoUrl` → `<img>`, sino → `tenantName` como texto
- Links internos prefijados con `/${tenantSlug}/`

### `Landing.tsx` — `frontend/src/pages/Landing/Landing.tsx`

Página mínima en `/`:
- Título "Atenea Courses — Plataforma de Academias Online"
- Lista de academias disponibles (`GET /api/super-admin/tenants` o un endpoint público)
- En demo: solo muestra "Naza Barber" con botón "Entrar" → navega a `/naza-barber`

### `SuperAdminDashboard.tsx` — `frontend/src/pages/SuperAdmin/SuperAdminDashboard.tsx`

Tres vistas:
1. **Lista de tenants** — tabla con nombre, slug, URL, stats, botón "Ver"
2. **Crear tenant** — modal con `name` + `slug` (auto desde nombre)
3. **Detalle de tenant** — stats + asignar admin por email

### `AdminDashboard.tsx` — cambios

- Nueva pestaña `'branding'` → form de upload de logo (del spec anterior)
- El tipo `AdminTab` en `types/index.ts` agrega `'branding'`

### `SuperAdminGuard` y `AdminGuard`

Componentes wrapper simples:
- `SuperAdminGuard`: verifica `user?.role === 'super_admin'`, sino redirige a `/`
- `AdminGuard`: verifica `user?.role === 'admin' || 'super_admin'`, sino redirige al home del tenant

---

## Archivos a crear / modificar

### Nuevos archivos

| Archivo | Descripción |
|---------|-------------|
| `database/04-multitenant.sql` | Migración: tenant_id en todas las tablas |
| `database/05-demo-naza-barber.sql` | Seed: tenant Naza Barber + migrar datos existentes |
| `backend/src/middleware/tenant.ts` | Resuelve tenant desde header |
| `backend/src/controllers/settingsController.ts` | Settings públicos + upload logo |
| `backend/src/controllers/superAdminController.ts` | CRUD tenants + asignar admins |
| `backend/src/routes/settings.ts` | GET /public |
| `backend/src/routes/superAdmin.ts` | CRUD /tenants |
| `frontend/src/contexts/TenantContext.tsx` | Tenant slug + settings |
| `frontend/src/components/layout/TenantLayout/TenantLayout.tsx` | Wrapper de rutas tenant |
| `frontend/src/pages/Landing/Landing.tsx` | Página raíz "/" |
| `frontend/src/pages/SuperAdmin/SuperAdminDashboard.tsx` | Panel global |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `database/schema.sql` | Referencia a migraciones 04 y 05 |
| `backend/src/middleware/auth.ts` | Agregar `requireSuperAdmin` |
| `backend/src/types/index.ts` | `super_admin` en role, `tenantId` en Request |
| `backend/src/controllers/authController.ts` | register + login usan tenant_id |
| `backend/src/controllers/courseController.ts` | Todos los queries filtran por tenant_id |
| `backend/src/controllers/adminController.ts` | Todos los queries filtran por tenant_id |
| `backend/src/config/multer.ts` | Storage para logos |
| `backend/src/app.ts` | Montar nuevos routers, servir /uploads |
| `backend/src/seed.ts` | Agregar super-admin seed |
| `frontend/src/App.tsx` | Nuevo routing multitenant |
| `frontend/src/services/api.ts` | Interceptor X-Tenant-Slug |
| `frontend/src/components/layout/Navbar/Navbar.tsx` | Logo dinámico + links con tenantSlug |
| `frontend/src/components/layout/Navbar/Navbar.css` | Estilo navbar-logo-img |
| `frontend/src/pages/Admin/AdminDashboard.tsx` | Pestaña branding |
| `frontend/src/styles/variables.css` | Paleta cream/blanco |
| `frontend/src/components/courses/CourseCard/CourseCard.tsx` | Overlay mobile |
| `frontend/src/components/courses/CourseCard/CourseCard.css` | Media query overlay |
| `frontend/src/types/index.ts` | AdminTab += 'branding' |

---

## Fuera de scope

- Billing / pagos por tenant a Atenea (modelo comercial SaaS)
- Onboarding self-service de nuevos clientes
- Aislamiento de uploads por tenant en cloud storage (se usa disco local por ahora)
- Cambio de colores por tenant (la paleta cream es global por ahora)
- Dominio propio por tenant (se puede agregar después)
