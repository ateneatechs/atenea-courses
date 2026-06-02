# Multitenant Architecture + Naza Barber UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Atenea Courses into a multi-tenant SaaS where each client (e.g. Naza Barber) has isolated courses, users, and branding accessible at `atenea-courses.com/:tenantSlug`, plus mobile-optimized course cards and a clean white/cream color palette.

**Architecture:** Shared PostgreSQL database with `tenant_id` on every business table; tenant resolved from `X-Tenant-Slug` request header injected by a frontend axios interceptor that reads the current URL path. Super-admins (`role = 'super_admin'`, `tenant_id = NULL`) manage all tenants from `/super-admin`.

**Tech Stack:** React 18 + TypeScript + React Router v6 (frontend), Express + TypeScript + PostgreSQL (backend), multer for file uploads, bcryptjs + JWT for auth.

---

## File Map

### New files
| Path | Purpose |
|------|---------|
| `database/04-multitenant.sql` | Creates `tenants`, `site_settings`; adds `tenant_id` to all tables |
| `database/05-demo-naza-barber.sql` | Seeds Naza Barber tenant + migrates existing data |
| `backend/src/middleware/tenant.ts` | `resolveTenant` + `optionalResolveTenant` middleware |
| `backend/src/controllers/settingsController.ts` | Public settings GET + logo upload POST |
| `backend/src/controllers/superAdminController.ts` | CRUD tenants, assign admin |
| `backend/src/routes/settings.ts` | `GET /api/settings/public` |
| `backend/src/routes/superAdmin.ts` | `/api/super-admin/*` routes |
| `frontend/src/contexts/TenantContext.tsx` | Tenant slug + settings context |
| `frontend/src/components/layout/TenantLayout/TenantLayout.tsx` | Wraps tenant routes with context + Navbar |
| `frontend/src/pages/Landing/Landing.tsx` | Root `/` page listing academies |
| `frontend/src/pages/SuperAdmin/SuperAdminDashboard.tsx` | Global management panel |
| `frontend/src/pages/SuperAdmin/SuperAdminDashboard.css` | Styles |

### Modified files
| Path | Change |
|------|--------|
| `frontend/src/styles/variables.css` | Cream/white palette tokens |
| `frontend/src/components/courses/CourseCard/CourseCard.tsx` | Add overlay body for mobile |
| `frontend/src/components/courses/CourseCard/CourseCard.css` | Mobile overlay styles |
| `backend/src/types/index.ts` | `super_admin` role, `tenantId` on Request |
| `backend/src/middleware/auth.ts` | `requireAdmin` allows super_admin; add `requireSuperAdmin` |
| `backend/src/config/multer.ts` | Add logo storage |
| `backend/src/controllers/authController.ts` | Register/login tenant-scoped |
| `backend/src/controllers/courseController.ts` | All queries filter by tenant_id |
| `backend/src/controllers/adminController.ts` | All queries filter by tenant_id |
| `backend/src/routes/courses.ts` | Add `resolveTenant` middleware |
| `backend/src/routes/auth.ts` | Add tenant middleware |
| `backend/src/routes/admin.ts` | Add `resolveTenant` |
| `backend/src/app.ts` | Mount new routers |
| `backend/src/seed.ts` | Add super-admin seed + tenant_id on users |
| `frontend/src/services/api.ts` | Add `X-Tenant-Slug` interceptor |
| `frontend/src/App.tsx` | Multitenant routing |
| `frontend/src/components/layout/Navbar/Navbar.tsx` | Logo dinámico + tenant-prefixed links |
| `frontend/src/components/layout/Navbar/Navbar.css` | `.navbar-logo-img` style |
| `frontend/src/pages/Home/Home.tsx` | Tenant-prefixed navigate calls |
| `frontend/src/pages/Explorer/Explorer.tsx` | Tenant-prefixed navigate calls |
| `frontend/src/pages/Admin/AdminDashboard.tsx` | Add branding tab |
| `frontend/src/types/index.ts` | `AdminTab` += `'branding'` |

---

## PHASE 1 — UI Redesign (independent, ship first)

---

### Task 1: Color Palette — Cream/White Refinement

**Files:**
- Modify: `frontend/src/styles/variables.css`

- [ ] **Step 1: Update the 7 `:root` color tokens**

In `frontend/src/styles/variables.css`, replace the following values inside `:root` (dark mode block is untouched):

```css
/* Change these 7 lines inside :root — do NOT touch html.dark block */
--color-background: #FFFFFF;
--color-surface: #FAFAFA;
--color-surface-container: #F5F0EA;
--color-surface-container-low: #FDFBF8;
--color-primary: #7A5C0A;
--glass-bg: rgba(255, 255, 255, 0.92);
--nav-bg: rgba(255, 255, 255, 0.95);
```

- [ ] **Step 2: Verify in browser**

Start the frontend dev server (`npm run dev` in `frontend/`) and open `http://localhost:5173`. The background should appear white instead of warm beige. Cards and surfaces retain a subtle cream tint.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles/variables.css
git commit -m "feat: refine color palette to clean white/cream"
```

---

### Task 2: Mobile CourseCard — Full-Width Image Overlay

**Files:**
- Modify: `frontend/src/components/courses/CourseCard/CourseCard.tsx`
- Modify: `frontend/src/components/courses/CourseCard/CourseCard.css`

- [ ] **Step 1: Add overlay body to CourseCard JSX**

Replace the entire `CourseCard.tsx` with:

```tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Course } from '../../../types';
import './CourseCard.css';

interface Props {
  course: Course;
}

const CourseCard: React.FC<Props> = ({ course }) => {
  const navigate = useNavigate();

  const badgeClass = course.is_membership_exclusive ? 'primary' : 'glass';

  const priceLabel = course.is_membership_exclusive
    ? 'Incluido'
    : course.price
      ? `$${course.price} USD`
      : 'Gratis';

  return (
    <div className="course-card" onClick={() => navigate(`courses/${course.id}`)}>
      <div className="course-card-image-wrap glass-card">
        {course.thumbnail_url && (
          <img src={course.thumbnail_url} alt={course.title} loading="lazy" />
        )}
        {course.badge && (
          <div className="course-card-badge">
            <span className={`badge-pill ${badgeClass}`}>{course.badge}</span>
          </div>
        )}
        <div className="course-card-overlay-body">
          <h3 className="course-card-overlay-title">{course.title}</h3>
          <span className="course-card-overlay-price">{priceLabel}</span>
        </div>
      </div>

      <div className="course-card-info">
        <h3 className="course-card-title">{course.title}</h3>
        <p className="course-card-instructor">con {course.instructor_name}</p>
        <div className="course-card-meta">
          <span className="course-card-price">{priceLabel}</span>
          <span className="course-card-duration">
            {course.total_lessons} Lecciones • {course.total_duration}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CourseCard;
```

Note: `navigate(`courses/${course.id}`)` is now relative (no leading slash) so it works under `/:tenantSlug/`.

- [ ] **Step 2: Add overlay CSS to CourseCard.css**

Replace the entire `CourseCard.css` with:

```css
.course-card {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: transform var(--transition-fluid);
}
.course-card:hover { transform: translateY(-4px); }

.course-card-image-wrap {
  position: relative;
  aspect-ratio: 4 / 5;
  overflow: hidden;
  border-radius: var(--radius-lg);
  margin-bottom: 24px;
  background: var(--color-surface-container-high);
}

.course-card-image-wrap img {
  width: 100%; height: 100%;
  object-fit: cover;
  transition: transform var(--transition-fluid);
}

.course-card:hover .course-card-image-wrap img {
  transform: scale(1.05);
}

.course-card-badge {
  position: absolute;
  top: 16px; left: 16px;
  display: flex; gap: 8px;
  z-index: 1;
}

.badge-pill {
  padding: 4px 12px;
  border-radius: var(--radius-full);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
}

.badge-pill.glass {
  background: color-mix(in srgb, var(--color-surface-container-lowest) 90%, transparent);
  backdrop-filter: blur(8px);
  color: var(--color-primary);
}

.badge-pill.primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.course-card-info { display: flex; flex-direction: column; gap: 8px; }

.course-card-title {
  font-family: var(--font-display);
  font-size: var(--text-headline-md);
  font-weight: 500;
  color: var(--color-on-surface);
  line-height: 1.25;
}

.course-card-instructor {
  font-size: var(--text-body-md);
  color: var(--color-on-surface-variant);
}

.course-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}

.course-card-price {
  font-size: var(--text-label-caps);
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-primary);
}

.course-card-duration {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-outline);
}

/* Overlay body — hidden on desktop, shown on mobile */
.course-card-overlay-body {
  display: none;
}

/* ── Mobile: full-width image with gradient overlay ── */
@media (max-width: 640px) {
  .course-card-image-wrap {
    aspect-ratio: 16 / 9;
    margin-bottom: 0;
  }

  .course-card-image-wrap::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 65%;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.78), transparent);
    pointer-events: none;
  }

  .course-card-info {
    display: none;
  }

  .course-card-overlay-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    position: absolute;
    bottom: 0; left: 0; right: 0;
    padding: 14px 16px;
    z-index: 1;
  }

  .course-card-overlay-title {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
    line-height: 1.3;
  }

  .course-card-overlay-price {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.85);
  }
}
```

- [ ] **Step 3: Verify mobile layout**

Open the browser devtools → toggle mobile view (375px wide). Navigate to `/explorer`. Cards should show as landscape images with text overlay. On desktop they should look identical to before.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/courses/CourseCard/CourseCard.tsx
git add frontend/src/components/courses/CourseCard/CourseCard.css
git commit -m "feat: mobile course card full-width image overlay"
```

---

## PHASE 2 — Database Migrations

---

### Task 3: Migration — Multitenant Schema

**Files:**
- Create: `database/04-multitenant.sql`

- [ ] **Step 1: Create the migration file**

```sql
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
```

- [ ] **Step 2: Run the migration against the running database**

```bash
# From repo root — adjust connection string if needed
docker compose exec postgres psql -U lumiere -d lumiere_academy -f /docker-entrypoint-initdb.d/04-multitenant.sql
```

If the file is not mounted, copy it in first:
```bash
docker compose cp database/04-multitenant.sql postgres:/tmp/04-multitenant.sql
docker compose exec postgres psql -U lumiere -d lumiere_academy -f /tmp/04-multitenant.sql
```

Expected output: series of `ALTER TABLE`, `CREATE TABLE`, `CREATE INDEX` lines — no errors.

- [ ] **Step 3: Commit**

```bash
git add database/04-multitenant.sql
git commit -m "feat(db): multitenant schema — tenants table, tenant_id on all tables"
```

---

### Task 4: Migration — Naza Barber Demo Seed

**Files:**
- Create: `database/05-demo-naza-barber.sql`

- [ ] **Step 1: Create the seed migration**

```sql
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
```

- [ ] **Step 2: Run the seed migration**

```bash
docker compose cp database/05-demo-naza-barber.sql postgres:/tmp/05-demo-naza-barber.sql
docker compose exec postgres psql -U lumiere -d lumiere_academy -f /tmp/05-demo-naza-barber.sql
```

Expected: `INSERT 0 1`, several `UPDATE N` lines (where N > 0 means existing data was migrated).

- [ ] **Step 3: Verify data**

```bash
docker compose exec postgres psql -U lumiere -d lumiere_academy -c "SELECT slug, name FROM tenants;"
docker compose exec postgres psql -U lumiere -d lumiere_academy -c "SELECT COUNT(*) FROM courses WHERE tenant_id IS NOT NULL;"
```

Expected: one tenant row `naza-barber | Naza Barber`, course count matching your existing courses.

- [ ] **Step 4: Commit**

```bash
git add database/05-demo-naza-barber.sql
git commit -m "feat(db): seed Naza Barber tenant, migrate existing data"
```

---

## PHASE 3 — Backend Infrastructure

---

### Task 5: Backend Types Update

**Files:**
- Modify: `backend/src/types/index.ts`

- [ ] **Step 1: Replace the entire types file**

```ts
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'super_admin';
  avatar_url?: string;
  tenant_id?: string | null;
  created_at: Date;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  instructor_name: string;
  thumbnail_url: string;
  preview_url?: string;
  price: number | null;
  category_id: string;
  category_name?: string;
  category_slug?: string;
  badge?: string;
  total_lessons: number;
  total_duration: string;
  is_membership_exclusive: boolean;
  is_published: boolean;
  tenant_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface Lesson {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  video_url?: string;
  duration: string;
  order_index: number;
  section_number: number;
  section_title: string;
  lesson_type: 'video' | 'quiz' | 'resource';
  created_at: Date;
}

export interface Subscription {
  id: string;
  user_id: string;
  tenant_id: string;
  plan: string;
  status: 'active' | 'cancelled' | 'expired';
  starts_at: Date;
  ends_at: Date;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      tenantId?: string;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/types/index.ts
git commit -m "feat(backend): add super_admin role and tenantId to types"
```

---

### Task 6: Tenant Middleware

**Files:**
- Create: `backend/src/middleware/tenant.ts`

- [ ] **Step 1: Create the middleware file**

```ts
import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';

export const resolveTenant = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const slug = req.headers['x-tenant-slug'] as string | undefined;
  if (!slug) {
    res.status(400).json({ message: 'X-Tenant-Slug header required' });
    return;
  }
  try {
    const result = await query('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (!result.rows[0]) {
      res.status(404).json({ message: `Tenant '${slug}' not found` });
      return;
    }
    req.tenantId = result.rows[0].id;
    next();
  } catch (error) {
    console.error('resolveTenant error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const optionalResolveTenant = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const slug = req.headers['x-tenant-slug'] as string | undefined;
  if (!slug) { next(); return; }
  try {
    const result = await query('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (result.rows[0]) req.tenantId = result.rows[0].id;
  } catch {
    // non-fatal for optional tenant resolution
  }
  next();
};
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/middleware/tenant.ts
git commit -m "feat(backend): add resolveTenant and optionalResolveTenant middleware"
```

---

### Task 7: Auth Middleware Update

**Files:**
- Modify: `backend/src/middleware/auth.ts`

- [ ] **Step 1: Replace the entire auth.ts middleware file**

```ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ message: 'No token provided' });
      return;
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback') as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const optionalAuth = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback') as JwtPayload;
      req.user = decoded;
    }
  } catch {
    // ignore for optional routes
  }
  next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
    res.status(403).json({ message: 'Admin access required' });
    return;
  }
  next();
};

export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'super_admin') {
    res.status(403).json({ message: 'Super-admin access required' });
    return;
  }
  next();
};
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/middleware/auth.ts
git commit -m "feat(backend): requireAdmin allows super_admin; add requireSuperAdmin"
```

---

### Task 8: Multer Config — Logo Storage

**Files:**
- Modify: `backend/src/config/multer.ts`

- [ ] **Step 1: Add logo storage to multer.ts**

Replace the entire `multer.ts` with:

```ts
import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import fs from 'fs';

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const makeStorage = (subdir: string) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(process.cwd(), 'uploads', subdir);
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, unique + path.extname(file.originalname));
    },
  });

const imageFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Only images allowed'));
};

const videoFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  file.mimetype.startsWith('video/') ? cb(null, true) : cb(new Error('Only videos allowed'));
};

export const uploadImage = multer({
  storage: makeStorage('images'),
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadVideo = multer({
  storage: makeStorage('videos'),
  fileFilter: videoFilter,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
});

export const uploadLogo = multer({
  storage: makeStorage('logos'),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/config/multer.ts
git commit -m "feat(backend): add uploadLogo multer storage"
```

---

## PHASE 4 — Backend Controllers + Routes

---

### Task 9: Auth Controller — Tenant-Scoped

**Files:**
- Modify: `backend/src/controllers/authController.ts`

- [ ] **Step 1: Replace the entire authController.ts**

```ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { JwtPayload } from '../types';

const signToken = (payload: JwtPayload) =>
  jwt.sign(payload, process.env.JWT_SECRET || 'fallback', { expiresIn: '7d' });

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ message: 'All fields are required' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ message: 'Password must be at least 8 characters' });
      return;
    }
    if (!req.tenantId) {
      res.status(400).json({ message: 'Tenant required for registration' });
      return;
    }

    const existing = await query(
      'SELECT id FROM users WHERE email = $1 AND tenant_id = $2',
      [email.toLowerCase(), req.tenantId]
    );
    if (existing.rows.length > 0) {
      res.status(400).json({ message: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query(
      'INSERT INTO users (email, password_hash, name, tenant_id) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
      [email.toLowerCase(), passwordHash, name, req.tenantId]
    );

    const user = result.rows[0];
    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    res.status(201).json({ token, user });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }

    let result;
    if (req.tenantId) {
      // Tenant-scoped login; also matches super_admin as fallback so they can log in from any tenant URL
      result = await query(
        "SELECT id, email, name, role, password_hash FROM users WHERE email = $1 AND (tenant_id = $2 OR (role = 'super_admin' AND tenant_id IS NULL))",
        [email.toLowerCase(), req.tenantId]
      );
    } else {
      result = await query(
        "SELECT id, email, name, role, password_hash FROM users WHERE email = $1 AND role = 'super_admin' AND tenant_id IS NULL",
        [email.toLowerCase()]
      );
    }

    if (result.rows.length === 0) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      'SELECT id, email, name, role, avatar_url, created_at FROM users WHERE id = $1',
      [req.user!.userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const subResult = await query(
      `SELECT id, plan, status, ends_at FROM subscriptions
       WHERE user_id = $1 AND status = 'active' AND ends_at > NOW()
       ORDER BY ends_at DESC LIMIT 1`,
      [req.user!.userId]
    );

    res.json({ ...result.rows[0], subscription: subResult.rows[0] || null });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/controllers/authController.ts
git commit -m "feat(backend): auth controller tenant-scoped register and login"
```

---

### Task 10: Course Controller — Tenant-Scoped

**Files:**
- Modify: `backend/src/controllers/courseController.ts`

- [ ] **Step 1: Replace the entire courseController.ts**

```ts
import { Request, Response } from 'express';
import { query } from '../config/database';

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
    query('SELECT id FROM course_purchases WHERE user_id = $1 AND course_id = $2', [userId, courseId]),
  ]);
  return sub.rows.length > 0 || purchase.rows.length > 0;
};

export const getCourses = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, search, sort = 'newest' } = req.query;
    const params: unknown[] = [req.tenantId!];
    let sql = `
      SELECT c.*, cat.name AS category_name, cat.slug AS category_slug
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.is_published = true AND c.tenant_id = $1
    `;

    if (category && category !== 'all') {
      params.push(category);
      sql += ` AND cat.slug = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (c.title ILIKE $${params.length} OR c.instructor_name ILIKE $${params.length})`;
    }

    const orderMap: Record<string, string> = {
      newest: 'c.created_at DESC',
      popular: 'c.total_lessons DESC',
      'price-desc': 'c.price DESC NULLS LAST',
    };
    sql += ` ORDER BY ${orderMap[sort as string] || orderMap.newest}`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('GetCourses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getCourseById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const courseResult = await query(
      `SELECT c.*, cat.name AS category_name FROM courses c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.id = $1 AND c.tenant_id = $2 AND c.is_published = true`,
      [id, req.tenantId!]
    );
    if (courseResult.rows.length === 0) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }

    const lessonsResult = await query(
      'SELECT * FROM lessons WHERE course_id = $1 ORDER BY section_number, order_index',
      [id]
    );

    let hasAccess = false;
    if (req.user) {
      hasAccess = await checkAccess(req.user.userId, id, req.tenantId!, req.user.role);
    }

    const lessons = lessonsResult.rows.map(l => ({
      ...l,
      video_url: hasAccess ? l.video_url : null,
    }));

    res.json({ ...courseResult.rows[0], lessons, hasAccess });
  } catch (error) {
    console.error('GetCourseById error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getInstructors = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(`
      SELECT
        c.instructor_name AS name,
        COUNT(c.id)::int AS course_count,
        MIN(c.thumbnail_url) AS avatar_url,
        COALESCE(
          array_agg(DISTINCT cat.name) FILTER (WHERE cat.name IS NOT NULL),
          '{}'::text[]
        ) AS categories
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.is_published = true AND c.tenant_id = $1
      GROUP BY c.instructor_name
      ORDER BY COUNT(c.id) DESC, c.instructor_name ASC
    `, [req.tenantId!]);
    res.json(result.rows);
  } catch (error) {
    console.error('GetInstructors error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      'SELECT * FROM categories WHERE tenant_id = $1 ORDER BY name',
      [req.tenantId!]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('GetCategories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const { plan = 'monthly' } = req.body;
    const userId = req.user!.userId;

    await query(
      `UPDATE subscriptions SET status = 'cancelled' WHERE user_id = $1 AND tenant_id = $2 AND status = 'active'`,
      [userId, req.tenantId!]
    );

    const startsAt = new Date();
    const endsAt = new Date();
    plan === 'annual' ? endsAt.setFullYear(endsAt.getFullYear() + 1) : endsAt.setMonth(endsAt.getMonth() + 1);

    const result = await query(
      `INSERT INTO subscriptions (user_id, tenant_id, plan, status, starts_at, ends_at)
       VALUES ($1, $2, $3, 'active', $4, $5) RETURNING *`,
      [userId, req.tenantId!, plan, startsAt, endsAt]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('CreateSubscription error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

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

    const existing = await query(
      'SELECT id FROM course_purchases WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    );
    if (existing.rows.length > 0) {
      res.status(400).json({ message: 'Course already purchased' });
      return;
    }

    const course = courseResult.rows[0];
    const result = await query(
      'INSERT INTO course_purchases (user_id, course_id, tenant_id, amount) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, courseId, req.tenantId!, course.price]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('PurchaseCourse error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getLessonById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const lessonResult = await query('SELECT * FROM lessons WHERE id = $1', [id]);
    if (lessonResult.rows.length === 0) {
      res.status(404).json({ message: 'Lesson not found' });
      return;
    }

    const lesson = lessonResult.rows[0];
    const hasAccess = await checkAccess(userId, lesson.course_id, req.tenantId!, req.user!.role);

    if (!hasAccess) {
      res.status(403).json({ message: 'Access denied. Subscribe or purchase this course.' });
      return;
    }

    const progressResult = await query(
      'SELECT * FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2',
      [userId, id]
    );

    res.json({ ...lesson, progress: progressResult.rows[0] || null });
  } catch (error) {
    console.error('GetLessonById error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateLessonProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { completed, progressSeconds } = req.body;
    const userId = req.user!.userId;

    const lessonResult = await query('SELECT course_id FROM lessons WHERE id = $1', [id]);
    if (lessonResult.rows.length === 0) {
      res.status(404).json({ message: 'Lesson not found' });
      return;
    }

    await query(
      `INSERT INTO lesson_progress (user_id, lesson_id, course_id, completed, progress_seconds, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, lesson_id)
       DO UPDATE SET completed = $4, progress_seconds = $5, updated_at = NOW()`,
      [userId, id, lessonResult.rows[0].course_id, completed || false, progressSeconds || 0]
    );

    res.json({ message: 'Progress updated' });
  } catch (error) {
    console.error('UpdateProgress error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/controllers/courseController.ts
git commit -m "feat(backend): course controller fully tenant-scoped"
```

---

### Task 11: Admin Controller — Tenant-Scoped

**Files:**
- Modify: `backend/src/controllers/adminController.ts`

- [ ] **Step 1: Replace the entire adminController.ts**

```ts
import { Request, Response } from 'express';
import { query } from '../config/database';

export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const tid = req.tenantId!;
    const [users, courses, subs, revenue] = await Promise.all([
      query("SELECT COUNT(*) AS count FROM users WHERE role = 'user' AND tenant_id = $1", [tid]),
      query('SELECT COUNT(*) AS count FROM courses WHERE tenant_id = $1', [tid]),
      query("SELECT COUNT(*) AS count FROM subscriptions WHERE tenant_id = $1 AND status = 'active' AND ends_at > NOW()", [tid]),
      query('SELECT COALESCE(SUM(amount), 0) AS total FROM course_purchases WHERE tenant_id = $1', [tid]),
    ]);
    res.json({
      totalUsers: parseInt(users.rows[0].count),
      totalCourses: parseInt(courses.rows[0].count),
      activeSubscriptions: parseInt(subs.rows[0].count),
      totalRevenue: parseFloat(revenue.rows[0].total),
    });
  } catch (error) {
    console.error('GetStats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAllCourses = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(`
      SELECT c.*, cat.name AS category_name, cat.slug AS category_slug
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.tenant_id = $1
      ORDER BY c.created_at DESC
    `, [req.tenantId!]);
    res.json(result.rows);
  } catch (error) {
    console.error('GetAllCourses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title, description, instructor_name, price,
      category_id, badge, total_duration,
      is_membership_exclusive = false, is_published = false,
      thumbnail_url: bodyThumb,
    } = req.body;

    const thumbnail_url = req.file ? `/uploads/images/${req.file.filename}` : (bodyThumb || '');

    const result = await query(
      `INSERT INTO courses
        (title, description, instructor_name, thumbnail_url, price, category_id, badge,
         total_duration, is_membership_exclusive, is_published, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [title, description, instructor_name, thumbnail_url,
        price || null, category_id || null, badge || null, total_duration || null,
        is_membership_exclusive === 'true' || is_membership_exclusive === true,
        is_published === 'true' || is_published === true,
        req.tenantId!]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('CreateCourse error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      title, description, instructor_name, price, category_id,
      badge, total_duration, is_membership_exclusive, is_published, thumbnail_url: bodyThumb,
    } = req.body;

    const thumbnail_url = req.file ? `/uploads/images/${req.file.filename}` : bodyThumb;

    const result = await query(
      `UPDATE courses SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        instructor_name = COALESCE($3, instructor_name),
        thumbnail_url = COALESCE($4, thumbnail_url),
        price = $5,
        category_id = COALESCE($6, category_id),
        badge = $7,
        total_duration = COALESCE($8, total_duration),
        is_membership_exclusive = COALESCE($9::boolean, is_membership_exclusive),
        is_published = COALESCE($10::boolean, is_published),
        updated_at = NOW()
       WHERE id = $11 AND tenant_id = $12
       RETURNING *`,
      [title, description, instructor_name, thumbnail_url,
        price !== undefined && price !== '' ? price : null,
        category_id, badge || null, total_duration,
        is_membership_exclusive != null ? (is_membership_exclusive === 'true' || is_membership_exclusive === true) : null,
        is_published != null ? (is_published === 'true' || is_published === true) : null,
        id, req.tenantId!]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('UpdateCourse error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    await query('DELETE FROM courses WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId!]);
    res.json({ message: 'Course deleted' });
  } catch (error) {
    console.error('DeleteCourse error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getLessons = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT l.* FROM lessons l
       JOIN courses c ON c.id = l.course_id
       WHERE l.course_id = $1 AND c.tenant_id = $2
       ORDER BY l.section_number, l.order_index`,
      [req.params.courseId, req.tenantId!]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('GetLessons error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createLesson = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      course_id, title, description, duration,
      order_index, section_number, section_title, lesson_type, video_url: bodyUrl,
    } = req.body;

    const video_url = req.file ? `/uploads/videos/${req.file.filename}` : (bodyUrl || '');

    const result = await query(
      `INSERT INTO lessons
        (course_id, title, description, video_url, duration, order_index, section_number, section_title, lesson_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [course_id, title, description || '', video_url, duration || '',
        parseInt(order_index) || 1, parseInt(section_number) || 1,
        section_title || 'Section 1', lesson_type || 'video']
    );

    await query(
      'UPDATE courses SET total_lessons = (SELECT COUNT(*) FROM lessons WHERE course_id = $1), updated_at = NOW() WHERE id = $1',
      [course_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('CreateLesson error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateLesson = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      title, description, duration,
      order_index, section_number, section_title, lesson_type, video_url: bodyUrl,
    } = req.body;

    const video_url = req.file ? `/uploads/videos/${req.file.filename}` : bodyUrl;

    const result = await query(
      `UPDATE lessons SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        video_url = COALESCE($3, video_url),
        duration = COALESCE($4, duration),
        order_index = COALESCE($5::int, order_index),
        section_number = COALESCE($6::int, section_number),
        section_title = COALESCE($7, section_title),
        lesson_type = COALESCE($8, lesson_type),
        updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [title, description, video_url, duration,
        order_index ? parseInt(order_index) : null,
        section_number ? parseInt(section_number) : null,
        section_title, lesson_type, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Lesson not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('UpdateLesson error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteLesson = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const lessonResult = await query('SELECT course_id FROM lessons WHERE id = $1', [id]);
    if (lessonResult.rows.length === 0) {
      res.status(404).json({ message: 'Lesson not found' });
      return;
    }
    const { course_id } = lessonResult.rows[0];
    await query('DELETE FROM lessons WHERE id = $1', [id]);
    await query(
      'UPDATE courses SET total_lessons = (SELECT COUNT(*) FROM lessons WHERE course_id = $1), updated_at = NOW() WHERE id = $1',
      [course_id]
    );
    res.json({ message: 'Lesson deleted' });
  } catch (error) {
    console.error('DeleteLesson error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      res.status(400).json({ message: 'Rol inválido' });
      return;
    }
    if (id === req.user?.userId) {
      res.status(400).json({ message: 'No puedes cambiar tu propio rol.' });
      return;
    }
    const result = await query(
      'UPDATE users SET role = $1 WHERE id = $2 AND tenant_id = $3 RETURNING id, email, name, role',
      [role, id, req.tenantId!]
    );
    if (result.rows.length === 0) { res.status(404).json({ message: 'User not found' }); return; }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('UpdateUserRole error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (id === req.user?.userId) {
      res.status(400).json({ message: 'No puedes eliminar tu propia cuenta.' });
      return;
    }
    await query('DELETE FROM users WHERE id = $1 AND tenant_id = $2', [id, req.tenantId!]);
    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error('DeleteUser error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(`
      SELECT u.id, u.email, u.name, u.role, u.created_at,
             s.plan, s.status AS sub_status, s.ends_at
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id AND s.tenant_id = $1 AND s.status = 'active' AND s.ends_at > NOW()
      WHERE u.tenant_id = $1 AND u.role != 'super_admin'
      ORDER BY u.created_at DESC
    `, [req.tenantId!]);
    res.json(result.rows);
  } catch (error) {
    console.error('GetAllUsers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/controllers/adminController.ts
git commit -m "feat(backend): admin controller fully tenant-scoped"
```

---

### Task 12: Settings + SuperAdmin Controllers

**Files:**
- Create: `backend/src/controllers/settingsController.ts`
- Create: `backend/src/controllers/superAdminController.ts`

- [ ] **Step 1: Create settingsController.ts**

```ts
import { Request, Response } from 'express';
import { query } from '../config/database';

export const getPublicSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT key, value FROM site_settings WHERE tenant_id = $1 AND key IN ('logo_url', 'site_name')`,
      [req.tenantId!]
    );
    const settings: Record<string, string | null> = { logo_url: null, site_name: 'Atenea Courses' };
    result.rows.forEach((r: { key: string; value: string | null }) => {
      settings[r.key] = r.value;
    });
    res.json(settings);
  } catch (error) {
    console.error('GetPublicSettings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const uploadLogo = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    await query(
      `INSERT INTO site_settings (tenant_id, key, value) VALUES ($1, 'logo_url', $2)
       ON CONFLICT (tenant_id, key) DO UPDATE SET value = $2`,
      [req.tenantId!, logoUrl]
    );
    res.json({ logo_url: logoUrl });
  } catch (error) {
    console.error('UploadLogo error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
```

- [ ] **Step 2: Create superAdminController.ts**

```ts
import { Request, Response } from 'express';
import { query } from '../config/database';

export const listTenants = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(`
      SELECT
        t.id, t.slug, t.name, t.created_at,
        COUNT(DISTINCT u.id)::int AS user_count,
        COUNT(DISTINCT c.id)::int AS course_count
      FROM tenants t
      LEFT JOIN users u ON u.tenant_id = t.id AND u.role != 'super_admin'
      LEFT JOIN courses c ON c.tenant_id = t.id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('ListTenants error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createTenant = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug, name } = req.body;
    if (!slug || !name) {
      res.status(400).json({ message: 'slug and name are required' });
      return;
    }
    const result = await query(
      'INSERT INTO tenants (slug, name) VALUES ($1, $2) RETURNING *',
      [slug.toLowerCase().replace(/\s+/g, '-'), name]
    );
    const tenant = result.rows[0];

    await query(
      `INSERT INTO site_settings (tenant_id, key, value) VALUES ($1, 'site_name', $2), ($1, 'logo_url', NULL)`,
      [tenant.id, name]
    );

    res.status(201).json(tenant);
  } catch (error: unknown) {
    if ((error as { code?: string }).code === '23505') {
      res.status(400).json({ message: 'Slug already exists' });
      return;
    }
    console.error('CreateTenant error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getTenant = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const [tenantResult, statsResult, adminResult] = await Promise.all([
      query('SELECT * FROM tenants WHERE id = $1', [id]),
      query(`
        SELECT
          COUNT(DISTINCT u.id) FILTER (WHERE u.role != 'super_admin')::int AS user_count,
          COUNT(DISTINCT c.id)::int AS course_count,
          COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active' AND s.ends_at > NOW())::int AS active_subscriptions
        FROM tenants t
        LEFT JOIN users u ON u.tenant_id = t.id
        LEFT JOIN courses c ON c.tenant_id = t.id
        LEFT JOIN subscriptions s ON s.tenant_id = t.id
        WHERE t.id = $1
      `, [id]),
      query(
        "SELECT id, email, name FROM users WHERE tenant_id = $1 AND role = 'admin' LIMIT 1",
        [id]
      ),
    ]);

    if (!tenantResult.rows[0]) {
      res.status(404).json({ message: 'Tenant not found' });
      return;
    }

    res.json({
      ...tenantResult.rows[0],
      stats: statsResult.rows[0],
      admin: adminResult.rows[0] || null,
    });
  } catch (error) {
    console.error('GetTenant error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const assignAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ message: 'email is required' });
      return;
    }

    const userResult = await query(
      'SELECT id FROM users WHERE email = $1 AND tenant_id = $2',
      [email.toLowerCase(), id]
    );
    if (!userResult.rows[0]) {
      res.status(404).json({ message: 'User not found in this tenant' });
      return;
    }

    await query(
      "UPDATE users SET role = 'admin' WHERE id = $1",
      [userResult.rows[0].id]
    );

    res.json({ message: 'Admin assigned' });
  } catch (error) {
    console.error('AssignAdmin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/settingsController.ts backend/src/controllers/superAdminController.ts
git commit -m "feat(backend): settings and superAdmin controllers"
```

---

### Task 13: Routes + app.ts

**Files:**
- Create: `backend/src/routes/settings.ts`
- Create: `backend/src/routes/superAdmin.ts`
- Modify: `backend/src/routes/auth.ts`
- Modify: `backend/src/routes/courses.ts`
- Modify: `backend/src/routes/admin.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create settings router**

```ts
// backend/src/routes/settings.ts
import { Router } from 'express';
import { resolveTenant } from '../middleware/tenant';
import { getPublicSettings, uploadLogo } from '../controllers/settingsController';
import { authenticate, requireAdmin } from '../middleware/auth';
import { uploadLogo as multerLogo } from '../config/multer';

const router = Router();

router.get('/public', resolveTenant, getPublicSettings);
router.post('/logo', resolveTenant, authenticate, requireAdmin, multerLogo.single('logo'), uploadLogo);

export default router;
```

- [ ] **Step 2: Create superAdmin router**

```ts
// backend/src/routes/superAdmin.ts
import { Router } from 'express';
import { authenticate, requireSuperAdmin } from '../middleware/auth';
import { listTenants, createTenant, getTenant, assignAdmin } from '../controllers/superAdminController';

const router = Router();
router.use(authenticate, requireSuperAdmin);

router.get('/tenants', listTenants);
router.post('/tenants', createTenant);
router.get('/tenants/:id', getTenant);
router.post('/tenants/:id/admin', assignAdmin);

export default router;
```

- [ ] **Step 3: Update auth router**

```ts
// backend/src/routes/auth.ts
import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { resolveTenant, optionalResolveTenant } from '../middleware/tenant';

const router = Router();

router.post('/register', resolveTenant, register);
router.post('/login', optionalResolveTenant, login);
router.get('/me', authenticate, getMe);

export default router;
```

- [ ] **Step 4: Update courses router**

```ts
// backend/src/routes/courses.ts
import { Router } from 'express';
import {
  getCourses, getCourseById, getCategories, getInstructors,
  createSubscription, purchaseCourse,
  getLessonById, updateLessonProgress,
} from '../controllers/courseController';
import { authenticate, optionalAuth } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();
router.use(resolveTenant);

router.get('/', getCourses);
router.get('/categories', getCategories);
router.get('/instructors', getInstructors);
router.get('/:id', optionalAuth, getCourseById);
router.post('/subscribe', authenticate, createSubscription);
router.post('/purchase', authenticate, purchaseCourse);
router.get('/lessons/:id', authenticate, getLessonById);
router.put('/lessons/:id/progress', authenticate, updateLessonProgress);

export default router;
```

- [ ] **Step 5: Update admin router**

```ts
// backend/src/routes/admin.ts
import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { uploadImage, uploadVideo } from '../config/multer';
import {
  getStats, getAllCourses, createCourse, updateCourse, deleteCourse,
  getLessons, createLesson, updateLesson, deleteLesson,
  getAllUsers, updateUserRole, deleteUser,
} from '../controllers/adminController';

const router = Router();
router.use(resolveTenant, authenticate, requireAdmin);

router.get('/stats', getStats);
router.get('/courses', getAllCourses);
router.post('/courses', uploadImage.single('thumbnail'), createCourse);
router.put('/courses/:id', uploadImage.single('thumbnail'), updateCourse);
router.delete('/courses/:id', deleteCourse);

router.get('/courses/:courseId/lessons', getLessons);
router.post('/lessons', uploadVideo.single('video'), createLesson);
router.put('/lessons/:id', uploadVideo.single('video'), updateLesson);
router.delete('/lessons/:id', deleteLesson);

router.get('/users', getAllUsers);
router.patch('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);

export default router;
```

- [ ] **Step 6: Update app.ts**

```ts
// backend/src/app.ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth';
import courseRoutes from './routes/courses';
import adminRoutes from './routes/admin';
import settingsRoutes from './routes/settings';
import superAdminRoutes from './routes/superAdmin';

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/auth',        authRoutes);
app.use('/api/courses',     courseRoutes);
app.use('/api/admin',       adminRoutes);
app.use('/api/settings',    settingsRoutes);
app.use('/api/super-admin', superAdminRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Internal server error' });
});

export default app;
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/settings.ts backend/src/routes/superAdmin.ts
git add backend/src/routes/auth.ts backend/src/routes/courses.ts backend/src/routes/admin.ts
git add backend/src/app.ts
git commit -m "feat(backend): wire all routes with tenant middleware"
```

---

### Task 14: Seed Update — Super-Admin

**Files:**
- Modify: `backend/src/seed.ts`

- [ ] **Step 1: Add super-admin insert at the end of the seed function, before the `console.log`**

Find the line `console.log('Database seeded successfully!');` in `seed.ts` and insert before it:

```ts
    // Super-admin (no tenant)
    const superHash = await bcrypt.hash('SuperAdmin123!', 12);
    await client.query(`
      INSERT INTO users (email, password_hash, name, role, tenant_id)
      VALUES ('superadmin@atenea.com', $1, 'Super Admin', 'super_admin', NULL)
      ON CONFLICT (email) DO NOTHING
    `, [superHash]);

    console.log('Database seeded successfully!');
    console.log('');
    console.log('Credenciales:');
    console.log('  Admin:      admin@atenea.com      / Admin123!');
    console.log('  User:       user@atenea.com       / User123!');
    console.log('  SuperAdmin: superadmin@atenea.com / SuperAdmin123!');
```

Also update the two existing user INSERTs to include `tenant_id`. Find the existing INSERT block and replace it:

```ts
    const tenantResult = await client.query("SELECT id FROM tenants WHERE slug = 'naza-barber'");
    const tenantId = tenantResult.rows[0]?.id;

    const adminHash = await bcrypt.hash('Admin123!', 12);
    const userHash = await bcrypt.hash('User123!', 12);

    await client.query(`
      INSERT INTO users (email, password_hash, name, role, tenant_id) VALUES
        ('admin@atenea.com', $1, 'Atenea Admin', 'admin', $3),
        ('user@atenea.com', $2, 'Usuario Demo', 'user', $3)
      ON CONFLICT (email) DO NOTHING
    `, [adminHash, userHash, tenantId]);
```

- [ ] **Step 2: Run the seed**

```bash
cd backend && npx ts-node src/seed.ts
```

Expected output ends with:
```
  SuperAdmin: superadmin@atenea.com / SuperAdmin123!
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/seed.ts
git commit -m "feat(backend): seed super-admin user with no tenant"
```

---

## PHASE 5 — Frontend Infrastructure

---

### Task 15: API Interceptor — X-Tenant-Slug Header

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Replace api.ts**

```ts
import axios from 'axios';

const getTenantSlug = (): string | null => {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (!parts[0] || parts[0] === 'super-admin') return null;
  return parts[0];
};

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lumiere-token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;

  const slug = getTenantSlug();
  if (slug) config.headers['X-Tenant-Slug'] = slug;

  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('lumiere-token');
    }
    return Promise.reject(error);
  }
);

export default api;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat(frontend): inject X-Tenant-Slug header from URL path"
```

---

### Task 16: TenantContext

**Files:**
- Create: `frontend/src/contexts/TenantContext.tsx`

- [ ] **Step 1: Create TenantContext.tsx**

```tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

interface TenantSettings {
  tenantSlug: string;
  tenantName: string;
  logoUrl: string | null;
  notFound: boolean;
  refreshSettings: () => Promise<void>;
}

const TenantContext = createContext<TenantSettings | undefined>(undefined);

export const TenantProvider: React.FC<{
  tenantSlug: string;
  children: React.ReactNode;
}> = ({ tenantSlug, children }) => {
  const [tenantName, setTenantName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const refreshSettings = useCallback(async () => {
    try {
      const { data } = await api.get<{ site_name: string; logo_url: string | null }>(
        '/settings/public'
      );
      setTenantName(data.site_name || tenantSlug);
      setLogoUrl(data.logo_url);
      setNotFound(false);
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } }).response?.status === 404) {
        setNotFound(true);
      }
    }
  }, [tenantSlug]);

  useEffect(() => { refreshSettings(); }, [refreshSettings]);

  return (
    <TenantContext.Provider value={{ tenantSlug, tenantName, logoUrl, notFound, refreshSettings }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = (): TenantSettings => {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/contexts/TenantContext.tsx
git commit -m "feat(frontend): TenantContext with settings fetch and refreshSettings"
```

---

### Task 17: TenantLayout

**Files:**
- Create: `frontend/src/components/layout/TenantLayout/TenantLayout.tsx`

- [ ] **Step 1: Create TenantLayout.tsx**

```tsx
import React from 'react';
import { Outlet, useParams, Navigate } from 'react-router-dom';
import { TenantProvider, useTenant } from '../../../contexts/TenantContext';
import Navbar from '../Navbar/Navbar';
import Footer from '../Footer/Footer';

const TenantGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { notFound } = useTenant();
  if (notFound) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const TenantLayout: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  if (!tenantSlug) return <Navigate to="/" replace />;

  return (
    <TenantProvider tenantSlug={tenantSlug}>
      <TenantGuard>
        <div className="app">
          <Navbar />
          <Outlet />
          <Footer />
        </div>
      </TenantGuard>
    </TenantProvider>
  );
};

export default TenantLayout;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/layout/TenantLayout/TenantLayout.tsx
git commit -m "feat(frontend): TenantLayout wraps tenant routes with context + guard"
```

---

### Task 18: App.tsx — Multitenant Routing

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Update types/index.ts — add 'branding' to AdminTab**

In `frontend/src/types/index.ts`, find:
```ts
export type AdminTab = 'overview' | 'courses' | 'users';
```
Replace with:
```ts
export type AdminTab = 'overview' | 'courses' | 'users' | 'branding';
```

- [ ] **Step 2: Replace App.tsx**

```tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import TenantLayout from './components/layout/TenantLayout/TenantLayout';
import Home from './pages/Home/Home';
import Explorer from './pages/Explorer/Explorer';
import CourseDetail from './pages/CourseDetail/CourseDetail';
import Membership from './pages/Membership/Membership';
import AdminDashboard from './pages/Admin/AdminDashboard';
import Landing from './pages/Landing/Landing';
import SuperAdminDashboard from './pages/SuperAdmin/SuperAdminDashboard';
import './styles/globals.css';
import './App.css';

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isAdmin, isLoading, user } = useAuth();
  if (isLoading) return <div className="loading-screen">Loading...</div>;
  const isSuperAdmin = user?.role === 'super_admin';
  if (!isAuthenticated || (!isAdmin && !isSuperAdmin)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <div className="loading-screen">Loading...</div>;
  if (!isAuthenticated || user?.role !== 'super_admin') return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App: React.FC = () => (
  <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/super-admin/*"
            element={
              <SuperAdminRoute>
                <SuperAdminDashboard />
              </SuperAdminRoute>
            }
          />
          <Route path="/:tenantSlug" element={<TenantLayout />}>
            <Route index element={<Home />} />
            <Route path="explorer" element={<Explorer />} />
            <Route path="courses/:id" element={<CourseDetail />} />
            <Route path="membership" element={<Membership />} />
            <Route
              path="admin/*"
              element={<AdminRoute><AdminDashboard /></AdminRoute>}
            />
            <Route path="*" element={<Navigate to="" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx frontend/src/types/index.ts
git commit -m "feat(frontend): multitenant routing with TenantLayout and super-admin guard"
```

---

## PHASE 6 — Frontend Pages + Components

---

### Task 19: Navbar — Logo Dinámico + Tenant Links

**Files:**
- Modify: `frontend/src/components/layout/Navbar/Navbar.tsx`
- Modify: `frontend/src/components/layout/Navbar/Navbar.css`

- [ ] **Step 1: Replace Navbar.tsx**

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { useTenant } from '../../../contexts/TenantContext';
import LoginModal from '../../auth/LoginModal/LoginModal';
import RegisterModal from '../../auth/RegisterModal/RegisterModal';
import './Navbar.css';

const Navbar: React.FC = () => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { tenantSlug, tenantName, logoUrl } = useTenant();
  const navigate = useNavigate();
  const { tenantSlug: paramSlug } = useParams<{ tenantSlug: string }>();
  const slug = paramSlug || tenantSlug;

  const [scrolled, setScrolled] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    setShowDropdown(false);
    navigate(`/${slug}`);
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <>
      <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
        <div className="navbar-left">
          {logoUrl
            ? <NavLink to={`/${slug}`}><img src={logoUrl} alt={tenantName} className="navbar-logo-img" /></NavLink>
            : <NavLink to={`/${slug}`} className="navbar-logo">{tenantName}</NavLink>
          }
          <ul className="navbar-links">
            <li><NavLink to={`/${slug}/explorer`} className={({ isActive }) => isActive ? 'active' : ''}>Explorar</NavLink></li>
            <li><NavLink to={`/${slug}/explorer?filter=masterclass`} className={({ isActive }) => isActive ? 'active' : ''}>Masterclasses</NavLink></li>
            <li><NavLink to={`/${slug}/membership`} className={({ isActive }) => isActive ? 'active' : ''}>Membresía</NavLink></li>
          </ul>
        </div>

        <div className="navbar-right">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            <span className="material-symbols-outlined">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>

          {isAuthenticated ? (
            <div className="user-avatar-wrap" ref={dropdownRef}>
              <button className="navbar-avatar" onClick={() => setShowDropdown(p => !p)}>
                {initials}
              </button>
              {showDropdown && (
                <div className="user-dropdown">
                  <div className="user-dropdown-header">
                    <div className="user-dropdown-name">{user?.name}</div>
                    <div className="user-dropdown-email">{user?.email}</div>
                    {isAdmin && <span className="user-dropdown-badge">Admin</span>}
                    {user?.subscription && <span className="user-dropdown-badge">Miembro</span>}
                  </div>
                  {isAdmin && (
                    <button
                      className="user-dropdown-item"
                      onClick={() => { navigate(`/${slug}/admin`); setShowDropdown(false); }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>admin_panel_settings</span>
                      Panel de Admin
                    </button>
                  )}
                  <NavLink
                    to={`/${slug}/membership`}
                    className="user-dropdown-item"
                    onClick={() => setShowDropdown(false)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>workspace_premium</span>
                    Membresía
                  </NavLink>
                  <div className="user-dropdown-divider" />
                  <button className="user-dropdown-item danger" onClick={handleLogout}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button className="navbar-signin-btn" onClick={() => setShowLogin(true)}>
                Iniciar sesión
              </button>
              <button
                className="navbar-icon-btn"
                onClick={() => setShowRegister(true)}
                title="Crear cuenta"
              >
                <span className="material-symbols-outlined">account_circle</span>
              </button>
            </>
          )}
        </div>
      </nav>

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSwitchToRegister={() => { setShowLogin(false); setShowRegister(true); }}
        />
      )}
      {showRegister && (
        <RegisterModal
          onClose={() => setShowRegister(false)}
          onSwitchToLogin={() => { setShowRegister(false); setShowLogin(true); }}
        />
      )}
    </>
  );
};

export default Navbar;
```

- [ ] **Step 2: Add `.navbar-logo-img` to Navbar.css**

Add at the end of `Navbar.css`:

```css
.navbar-logo-img {
  height: 36px;
  width: auto;
  object-fit: contain;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/Navbar/Navbar.tsx
git add frontend/src/components/layout/Navbar/Navbar.css
git commit -m "feat(frontend): navbar dynamic logo + tenant-prefixed links"
```

---

### Task 20: Landing Page

**Files:**
- Create: `frontend/src/pages/Landing/Landing.tsx`

- [ ] **Step 1: Create Landing.tsx**

```tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  course_count: number;
  user_count: number;
}

const Landing: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<Tenant[]>('/super-admin/tenants').catch(() => {
      setTenants([{ id: '1', slug: 'naza-barber', name: 'Naza Barber', course_count: 0, user_count: 0 }]);
    }).then(r => {
      if (r) setTenants(r.data);
    });
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: 'var(--color-background)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-headline-xl)', color: 'var(--color-primary)', marginBottom: 8 }}>
        Atenea Courses
      </h1>
      <p style={{ color: 'var(--color-on-surface-variant)', marginBottom: 48, fontSize: 'var(--text-body-lg)' }}>
        Plataforma de academias online
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center' }}>
        {tenants.map(t => (
          <div
            key={t.id}
            onClick={() => navigate(`/${t.slug}`)}
            style={{
              cursor: 'pointer',
              padding: '32px 40px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-outline-variant)',
              background: 'var(--color-surface-container-low)',
              textAlign: 'center',
              minWidth: 220,
              transition: 'transform 200ms, box-shadow 200ms',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-headline-sm)', color: 'var(--color-on-surface)', marginBottom: 8 }}>{t.name}</div>
            <div style={{ fontSize: 'var(--text-label-caps)', color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {t.course_count} cursos
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Landing;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Landing/Landing.tsx
git commit -m "feat(frontend): landing page listing tenant academies"
```

---

### Task 21: Update navigate calls in Home + Explorer

**Files:**
- Modify: `frontend/src/pages/Home/Home.tsx`
- Modify: `frontend/src/pages/Explorer/Explorer.tsx`

- [ ] **Step 1: Update Home.tsx — replace absolute navigate paths**

In `Home.tsx`, `navigate('/explorer')` → `navigate('explorer')`, `navigate('/membership')` → `navigate('membership')`, `navigate('/courses/${...}')` → `navigate(`courses/${...}`)`.

The component uses React Router v6 nested routes, so relative navigation (no leading `/`) will correctly prepend `/:tenantSlug/`.

Find and replace all occurrences in `Home.tsx`:

```tsx
// Line: navigate('/explorer')           →  navigate('explorer')
// Line: navigate('/membership')         →  navigate('membership')
// Line: navigate(`/courses/${large.id}`) →  navigate(`courses/${large.id}`)
// Line: navigate(`/courses/${c.id}`)    →  navigate(`courses/${c.id}`)
```

Also update the `<Link to="/explorer">` import to use relative path `to="explorer"`.

- [ ] **Step 2: Update Explorer.tsx — useNavigate calls**

In `Explorer.tsx`, if there are any `navigate('/...')` calls, change them to relative paths. The current Explorer doesn't navigate programmatically to course pages but CourseCard already uses relative `navigate('courses/${course.id}')` from Task 2.

Verify `Explorer.tsx` has no remaining absolute path navigate calls.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Home/Home.tsx frontend/src/pages/Explorer/Explorer.tsx
git commit -m "feat(frontend): use relative navigate paths for tenant routing"
```

---

### Task 22: SuperAdmin Dashboard

**Files:**
- Create: `frontend/src/pages/SuperAdmin/SuperAdminDashboard.tsx`
- Create: `frontend/src/pages/SuperAdmin/SuperAdminDashboard.css`

- [ ] **Step 1: Create SuperAdminDashboard.tsx**

```tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './SuperAdminDashboard.css';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  user_count: number;
  course_count: number;
  created_at: string;
}

const SuperAdminDashboard: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    const { data } = await api.get<Tenant[]>('/super-admin/tenants');
    setTenants(data);
  };

  useEffect(() => { load(); }, []);

  const handleNameChange = (val: string) => {
    setNewName(val);
    setNewSlug(val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  };

  const handleCreate = async () => {
    if (!newName || !newSlug) return;
    setCreating(true);
    try {
      await api.post('/super-admin/tenants', { name: newName, slug: newSlug });
      setShowModal(false);
      setNewName('');
      setNewSlug('');
      await load();
    } catch {
      alert('Error al crear la academia. El slug puede estar en uso.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="super-admin">
      <header className="super-admin-header">
        <div>
          <h1 className="super-admin-title">Atenea Platform</h1>
          <p className="super-admin-subtitle">Panel de administración global</p>
        </div>
        <button className="super-admin-btn-primary" onClick={() => setShowModal(true)}>
          + Nueva academia
        </button>
      </header>

      <div className="super-admin-table-wrap">
        <table className="super-admin-table">
          <thead>
            <tr>
              <th>Academia</th>
              <th>Slug</th>
              <th>Usuarios</th>
              <th>Cursos</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map(t => (
              <tr key={t.id}>
                <td className="super-admin-name">{t.name}</td>
                <td><code>/{t.slug}</code></td>
                <td>{t.user_count}</td>
                <td>{t.course_count}</td>
                <td>
                  <button
                    className="super-admin-btn-link"
                    onClick={() => navigate(`/${t.slug}`)}
                  >
                    Ir →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="super-admin-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="super-admin-modal" onClick={e => e.stopPropagation()}>
            <h2>Nueva academia</h2>
            <label>Nombre</label>
            <input
              type="text"
              value={newName}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="Ej: Naza Barber"
              className="super-admin-input"
            />
            <label>Slug (URL)</label>
            <input
              type="text"
              value={newSlug}
              onChange={e => setNewSlug(e.target.value)}
              placeholder="naza-barber"
              className="super-admin-input"
            />
            <p className="super-admin-slug-preview">
              URL: atenea-courses.com/<strong>{newSlug || '...'}</strong>
            </p>
            <div className="super-admin-modal-actions">
              <button className="super-admin-btn-outline" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button className="super-admin-btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? 'Creando...' : 'Crear academia'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
```

- [ ] **Step 2: Create SuperAdminDashboard.css**

```css
.super-admin {
  padding: calc(var(--navbar-height, 80px) + 48px) var(--spacing-margin-desktop, 64px) 80px;
  max-width: var(--container-max-width, 1280px);
  margin: 0 auto;
}

.super-admin-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 48px;
  flex-wrap: wrap;
  gap: 16px;
}

.super-admin-title {
  font-family: var(--font-display);
  font-size: var(--text-headline-xl);
  color: var(--color-primary);
  line-height: 1.1;
}

.super-admin-subtitle {
  color: var(--color-on-surface-variant);
  font-size: var(--text-body-md);
  margin-top: 4px;
}

.super-admin-btn-primary {
  padding: 12px 28px;
  background: var(--color-primary);
  color: var(--color-on-primary);
  border: none;
  border-radius: var(--radius-full);
  font-size: var(--text-label-caps);
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: box-shadow var(--transition-normal), transform var(--transition-fast);
}
.super-admin-btn-primary:hover { box-shadow: var(--shadow-glow); transform: translateY(-1px); }
.super-admin-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.super-admin-btn-outline {
  padding: 12px 28px;
  background: transparent;
  color: var(--color-on-surface);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-full);
  font-size: var(--text-label-caps);
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
}

.super-admin-btn-link {
  background: none;
  border: none;
  color: var(--color-primary);
  font-weight: 600;
  cursor: pointer;
  font-size: var(--text-body-md);
}

.super-admin-table-wrap {
  background: var(--color-surface-container-low);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.super-admin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-body-md);
}

.super-admin-table th {
  text-align: left;
  padding: 14px 20px;
  font-size: var(--text-label-caps);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
  border-bottom: 1px solid var(--color-outline-variant);
}

.super-admin-table td {
  padding: 16px 20px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-outline-variant) 50%, transparent);
  color: var(--color-on-surface);
}

.super-admin-table tr:last-child td { border-bottom: none; }
.super-admin-name { font-weight: 600; }

.super-admin-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.super-admin-modal {
  background: var(--color-surface-container-low);
  border-radius: var(--radius-lg);
  padding: 32px;
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.super-admin-modal h2 {
  font-family: var(--font-display);
  font-size: var(--text-headline-sm);
  color: var(--color-on-surface);
  margin-bottom: 8px;
}

.super-admin-modal label {
  font-size: var(--text-label-caps);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-primary);
}

.super-admin-input {
  width: 100%;
  padding: 10px 0;
  border: none;
  border-bottom: 1px solid var(--color-outline);
  background: transparent;
  font-size: var(--text-body-md);
  color: var(--color-on-surface);
  outline: none;
}
.super-admin-input:focus { border-color: var(--color-primary); }

.super-admin-slug-preview {
  font-size: var(--text-label-md);
  color: var(--color-on-surface-variant);
}

.super-admin-modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 8px;
}

@media (max-width: 640px) {
  .super-admin {
    padding-left: var(--spacing-margin-mobile, 20px);
    padding-right: var(--spacing-margin-mobile, 20px);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/SuperAdmin/SuperAdminDashboard.tsx
git add frontend/src/pages/SuperAdmin/SuperAdminDashboard.css
git commit -m "feat(frontend): super-admin dashboard with tenant list and create modal"
```

---

### Task 23: AdminDashboard — Branding Tab

**Files:**
- Modify: `frontend/src/pages/Admin/AdminDashboard.tsx`

- [ ] **Step 1: Add branding tab button in the tab bar**

Find the tab bar in `AdminDashboard.tsx` where other tabs are rendered (look for the `tab` state buttons like `'overview'`, `'courses'`, `'users'`). Add a new tab button after the users tab:

```tsx
<button
  className={`admin-tab ${tab === 'branding' ? 'active' : ''}`}
  onClick={() => setTab('branding')}
>
  Personalización
</button>
```

- [ ] **Step 2: Add branding tab content**

Find the section where tab content is rendered (look for `{tab === 'overview' && ...}`). Add after the users tab content:

```tsx
{tab === 'branding' && (
  <BrandingTab />
)}
```

- [ ] **Step 3: Add BrandingTab component inside the same file, above the AdminDashboard function**

```tsx
const BrandingTab: React.FC = () => {
  const { logoUrl, tenantName, refreshSettings } = useTenant();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSave = async () => {
    if (!file) return;
    setSaving(true);
    setSuccess(false);
    try {
      const form = new FormData();
      form.append('logo', file);
      await api.post('/settings/logo', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      await refreshSettings();
      setSuccess(true);
      setFile(null);
      setPreview(null);
    } catch {
      alert('Error al subir el logo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-headline-sm)', color: 'var(--color-on-surface)', marginBottom: 8 }}>
          Logo de la academia
        </h3>
        <p style={{ color: 'var(--color-on-surface-variant)', fontSize: 'var(--text-body-md)' }}>
          El logo aparece en la barra de navegación. Formatos: PNG, JPG, SVG. Máx. 5 MB.
        </p>
      </div>

      {(preview || logoUrl) && (
        <div style={{ padding: 16, background: 'var(--color-surface-container)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={preview || logoUrl!} alt={tenantName} style={{ height: 48, objectFit: 'contain' }} />
        </div>
      )}

      <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 'var(--text-label-caps)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-primary)' }}>
          Subir imagen
        </span>
        <input type="file" accept="image/*" onChange={handleFile} />
      </label>

      {file && (
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '12px 28px',
            background: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
            alignSelf: 'flex-start',
          }}
        >
          {saving ? 'Guardando...' : 'Guardar logo'}
        </button>
      )}

      {success && (
        <p style={{ color: 'var(--color-success)', fontWeight: 600 }}>
          Logo actualizado correctamente.
        </p>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Add `useTenant` import and `useState` if not already present**

At the top of `AdminDashboard.tsx`, ensure these imports exist:

```tsx
import { useTenant } from '../../contexts/TenantContext';
// useState is already imported
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Admin/AdminDashboard.tsx
git commit -m "feat(frontend): admin dashboard branding tab for logo upload"
```

---

### Task 24: Final Verification + Main Commit

- [ ] **Step 1: Start both servers**

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

- [ ] **Step 2: Verify tenant routing**

Navigate to `http://localhost:5173/naza-barber`. Expected: Home page loads with "Naza Barber" in the navbar. Navigate to `http://localhost:5173/naza-barber/explorer`. Expected: course grid loads with courses.

- [ ] **Step 3: Verify mobile layout**

Open Chrome devtools → mobile view (375px). Go to `/naza-barber/explorer`. Expected: course cards show as landscape images with overlay text.

- [ ] **Step 4: Verify super-admin**

Navigate to `http://localhost:5173/super-admin`. Expected: redirect to `/` (not logged in). Log in as `superadmin@atenea.com / SuperAdmin123!` via `/naza-barber` login modal. Then navigate to `/super-admin`. Expected: dashboard shows "Naza Barber" tenant row.

- [ ] **Step 5: Verify logo upload**

Log in as `admin@atenea.com / Admin123!` at `/naza-barber`. Go to `/naza-barber/admin` → tab "Personalización". Upload a PNG. Expected: logo appears in the navbar immediately after saving.

- [ ] **Step 6: Final commit to main**

```bash
git add -A
git status  # review any remaining uncommitted changes
git commit -m "$(cat <<'EOF'
feat: multitenant SaaS architecture + Naza Barber UI redesign

- Shared-DB multitenancy with tenant_id on all tables
- Path-based routing /:tenantSlug/* with X-Tenant-Slug header
- Super-admin panel at /super-admin for tenant management
- Dynamic logo upload per tenant (admin branding tab)
- Mobile course cards with full-width image overlay
- Refined white/cream color palette

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```
