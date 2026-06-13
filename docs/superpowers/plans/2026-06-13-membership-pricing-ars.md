# Membership Pricing, ARS Currency & Course Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each academy admin configure their own membership prices (monthly/annual) and enable/disable membership entirely, display all prices in Argentine pesos (ARS), and toggle a course's published state with one click from the admin courses table.

**Architecture:** Backend reuses the existing `site_settings` key/value table (already used for `logo_url`/`site_name`) to store three new per-tenant keys (`membership_enabled`, `membership_monthly_price`, `membership_annual_price`), exposed via the existing public settings endpoint plus two new admin-only endpoints. `getCourses`/`getCourseById` hide membership-exclusive courses when membership is disabled. A new lightweight `PATCH /admin/courses/:id/published` endpoint flips `is_published` without touching other fields. Frontend adds a `formatARS` currency helper, a reusable `ToggleSwitch` component, extends `TenantContext` with the new membership fields, adds a "Membresías" admin tab, and updates `Membership.tsx`, `CourseCard.tsx`, `CourseDetail.tsx`, `Navbar.tsx`, and the admin courses table to use them.

**Tech Stack:** Express + TypeScript + `pg` (existing). React 18 + TS + React Router v6 (existing). No new dependencies.

---

## File Map

**New files:**
- `frontend/src/utils/currency.ts` — `formatARS(price)` helper.
- `frontend/src/components/common/ToggleSwitch/ToggleSwitch.tsx` + `.css` — reusable switch component.
- `frontend/src/pages/Admin/MembershipTab.tsx` — admin tab for membership enable/disable + pricing.

**Modified files:**
- `backend/src/controllers/settingsController.ts` — extend `getPublicSettings`, add `getMembershipSettings`/`updateMembershipSettings`.
- `backend/src/routes/admin.ts` — register membership settings + course-publish-toggle routes.
- `backend/src/controllers/courseController.ts` — hide membership-exclusive courses when membership disabled.
- `backend/src/controllers/adminController.ts` — add `toggleCoursePublished`.
- `frontend/src/types/index.ts` — `AdminTab += 'membership'`.
- `frontend/src/contexts/TenantContext.tsx` — expose `membershipEnabled`, `membershipMonthlyPrice`, `membershipAnnualPrice`.
- `frontend/src/components/courses/CourseCard/CourseCard.tsx` — ARS price label.
- `frontend/src/pages/CourseDetail/CourseDetail.tsx` — ARS price labels.
- `frontend/src/pages/Admin/AdminDashboard.tsx` — ARS price column + label, "Membresías" nav item + tab, course table toggle switch.
- `frontend/src/pages/Membership/Membership.tsx` — ARS prices from settings, annual plan card, hide plans when disabled.
- `frontend/src/components/layout/Navbar/Navbar.tsx` — hide "Membresía" link when disabled.

---

### Task 1: Backend — membership settings storage & endpoints

**Files:**
- Modify: `backend/src/controllers/settingsController.ts`
- Modify: `backend/src/routes/admin.ts`

- [ ] **Step 1: Add membership defaults and extend `getPublicSettings`**

In `backend/src/controllers/settingsController.ts`, add near the top (after the imports):

```ts
const MEMBERSHIP_DEFAULTS: Record<string, string> = {
  membership_enabled: 'true',
  membership_monthly_price: '15000',
  membership_annual_price: '150000',
};
```

Replace the body of `getPublicSettings` with:

```ts
export const getPublicSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT key, value FROM site_settings WHERE tenant_id = $1 AND key IN
        ('logo_url', 'site_name', 'membership_enabled', 'membership_monthly_price', 'membership_annual_price')`,
      [req.tenantId!]
    );
    const raw: Record<string, string | null> = {
      logo_url: null,
      site_name: 'Atenea Courses',
      ...MEMBERSHIP_DEFAULTS,
    };
    result.rows.forEach((r: { key: string; value: string | null }) => {
      raw[r.key] = r.value;
    });
    res.json({
      logo_url: raw.logo_url,
      site_name: raw.site_name,
      membership_enabled: raw.membership_enabled === 'true',
      membership_monthly_price: Number(raw.membership_monthly_price),
      membership_annual_price: Number(raw.membership_annual_price),
    });
  } catch (error) {
    console.error('GetPublicSettings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
```

- [ ] **Step 2: Add `getMembershipSettings` and `updateMembershipSettings`**

Append to `backend/src/controllers/settingsController.ts` (after `uploadLogo`):

```ts
export const getMembershipSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT key, value FROM site_settings WHERE tenant_id = $1 AND key IN
        ('membership_enabled', 'membership_monthly_price', 'membership_annual_price')`,
      [req.tenantId!]
    );
    const raw: Record<string, string | null> = { ...MEMBERSHIP_DEFAULTS };
    result.rows.forEach((r: { key: string; value: string | null }) => {
      raw[r.key] = r.value;
    });
    res.json({
      enabled: raw.membership_enabled === 'true',
      monthly_price: Number(raw.membership_monthly_price),
      annual_price: Number(raw.membership_annual_price),
    });
  } catch (error) {
    console.error('GetMembershipSettings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateMembershipSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { enabled, monthly_price, annual_price } = req.body;
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ message: 'enabled debe ser un valor booleano' });
      return;
    }
    if (
      typeof monthly_price !== 'number' || !Number.isFinite(monthly_price) || monthly_price < 0 ||
      typeof annual_price !== 'number' || !Number.isFinite(annual_price) || annual_price < 0
    ) {
      res.status(400).json({ message: 'Los precios deben ser números mayores o iguales a 0' });
      return;
    }

    const entries: [string, string][] = [
      ['membership_enabled', enabled ? 'true' : 'false'],
      ['membership_monthly_price', String(monthly_price)],
      ['membership_annual_price', String(annual_price)],
    ];
    for (const [key, value] of entries) {
      await query(
        `INSERT INTO site_settings (tenant_id, key, value) VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, key) DO UPDATE SET value = $3`,
        [req.tenantId!, key, value]
      );
    }
    res.json({ enabled, monthly_price, annual_price });
  } catch (error) {
    console.error('UpdateMembershipSettings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
```

- [ ] **Step 3: Register admin routes**

In `backend/src/routes/admin.ts`, add `getMembershipSettings` and `updateMembershipSettings` to the import from `'../controllers/settingsController'` (new import line, since `adminController` is a separate module):

```ts
import { getMembershipSettings, updateMembershipSettings } from '../controllers/settingsController';
```

Then add the routes (anywhere after `router.use(resolveTenant, authenticate, requireAdmin, requireSameTenant);`):

```ts
router.get('/membership-settings', getMembershipSettings);
router.put('/membership-settings', updateMembershipSettings);
```

- [ ] **Step 4: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/settingsController.ts backend/src/routes/admin.ts
git commit -m "feat(backend): add per-tenant membership pricing settings endpoints"
```

---

### Task 2: Backend — hide membership-exclusive courses when membership disabled

**Files:**
- Modify: `backend/src/controllers/courseController.ts`

- [ ] **Step 1: Add `isMembershipEnabled` helper**

In `backend/src/controllers/courseController.ts`, add after the existing `checkAccess` function (around line 19):

```ts
const isMembershipEnabled = async (tenantId: string): Promise<boolean> => {
  const result = await query(
    `SELECT value FROM site_settings WHERE tenant_id = $1 AND key = 'membership_enabled'`,
    [tenantId]
  );
  return result.rows.length === 0 || result.rows[0].value === 'true';
};
```

- [ ] **Step 2: Filter `getCourses`**

In `getCourses`, right after the existing `if (search) { ... }` block and before the `orderMap`/`ORDER BY` logic, add:

```ts
    if (!(await isMembershipEnabled(req.tenantId!))) {
      sql += ` AND c.is_membership_exclusive = false`;
    }
```

- [ ] **Step 3: Filter `getCourseById`**

In `getCourseById`, right after the existing `if (courseResult.rows.length === 0) { ... return; }` block, add:

```ts
    const course = courseResult.rows[0];
    if (course.is_membership_exclusive && !(await isMembershipEnabled(req.tenantId!))) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }
```

Then change the subsequent code that reads `courseResult.rows[0]` to use the new `course` variable instead (the final `res.json({ ...courseResult.rows[0], lessons, hasAccess })` becomes `res.json({ ...course, lessons, hasAccess })`).

- [ ] **Step 4: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/courseController.ts
git commit -m "feat(backend): hide membership-exclusive courses when membership disabled"
```

---

### Task 3: Backend — quick course publish/unpublish endpoint

**Files:**
- Modify: `backend/src/controllers/adminController.ts`
- Modify: `backend/src/routes/admin.ts`

- [ ] **Step 1: Add `toggleCoursePublished` handler**

In `backend/src/controllers/adminController.ts`, add after `updateCourse`:

```ts
export const toggleCoursePublished = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { is_published } = req.body;
    if (typeof is_published !== 'boolean') {
      res.status(400).json({ message: 'is_published debe ser un valor booleano' });
      return;
    }
    const result = await query(
      `UPDATE courses SET is_published = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [is_published, id, req.tenantId!]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('ToggleCoursePublished error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
```

- [ ] **Step 2: Register the route**

In `backend/src/routes/admin.ts`, add `toggleCoursePublished` to the existing import from `'../controllers/adminController'`, then add the route right after `router.put('/courses/:id', ...)`:

```ts
router.patch('/courses/:id/published', toggleCoursePublished);
```

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/adminController.ts backend/src/routes/admin.ts
git commit -m "feat(backend): add quick course publish/unpublish toggle endpoint"
```

---

### Task 4: Frontend — ARS currency helper and price display updates

**Files:**
- Create: `frontend/src/utils/currency.ts`
- Modify: `frontend/src/components/courses/CourseCard/CourseCard.tsx`
- Modify: `frontend/src/pages/CourseDetail/CourseDetail.tsx`
- Modify: `frontend/src/pages/Admin/AdminDashboard.tsx`

- [ ] **Step 1: Create the currency helper**

Create `frontend/src/utils/currency.ts`:

```ts
export const formatARS = (price: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(price);
```

- [ ] **Step 2: Update `CourseCard.tsx`**

In `frontend/src/components/courses/CourseCard/CourseCard.tsx`, add the import:

```tsx
import { formatARS } from '../../../utils/currency';
```

Replace the `priceLabel` definition (line 15-19):

```tsx
  const priceLabel = course.is_membership_exclusive
    ? 'Incluido'
    : course.price
      ? formatARS(course.price)
      : 'Gratis';
```

- [ ] **Step 3: Update `CourseDetail.tsx`**

In `frontend/src/pages/CourseDetail/CourseDetail.tsx`, add the import:

```tsx
import { formatARS } from '../../utils/currency';
```

Replace line 128:

```tsx
                  : `Compra este curso por ${formatARS(course.price!)} o suscríbete para acceder a todos los cursos.`}
```

Replace line 144:

```tsx
                    Comprar por {formatARS(course.price!)}
```

- [ ] **Step 4: Update `AdminDashboard.tsx` price column and form label**

In `frontend/src/pages/Admin/AdminDashboard.tsx`, add the import at the top:

```tsx
import { formatARS } from '../../utils/currency';
```

Replace line 354 (overview table price cell):

```tsx
                      <td>{c.is_membership_exclusive ? 'Miembro' : c.price ? formatARS(c.price) : 'Gratis'}</td>
```

Replace line 410 (courses table price cell):

```tsx
                            ? <span className="status-badge member-only">Miembro</span>
                            : c.price ? formatARS(c.price) : 'Gratis'}
```

(Keep line 408-409 — `c.is_membership_exclusive ? <span ...>` — unchanged; only the `: c.price ? ...` branch changes.)

Replace line 638 (form label):

```tsx
                  <label className="form-label">Precio (ARS)</label>
```

- [ ] **Step 5: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/currency.ts frontend/src/components/courses/CourseCard/CourseCard.tsx frontend/src/pages/CourseDetail/CourseDetail.tsx frontend/src/pages/Admin/AdminDashboard.tsx
git commit -m "feat(frontend): display course prices in ARS instead of USD"
```

---

### Task 5: Frontend — reusable ToggleSwitch component

**Files:**
- Create: `frontend/src/components/common/ToggleSwitch/ToggleSwitch.tsx`
- Create: `frontend/src/components/common/ToggleSwitch/ToggleSwitch.css`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/common/ToggleSwitch/ToggleSwitch.tsx`:

```tsx
import React from 'react';
import './ToggleSwitch.css';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

const ToggleSwitch: React.FC<Props> = ({ checked, onChange, disabled, label }) => (
  <label className={`toggle-switch${disabled ? ' disabled' : ''}`}>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={e => onChange(e.target.checked)}
    />
    <span className="toggle-switch-track">
      <span className="toggle-switch-knob" />
    </span>
    {label && <span className="toggle-switch-label">{label}</span>}
  </label>
);

export default ToggleSwitch;
```

- [ ] **Step 2: Create the styles**

Create `frontend/src/components/common/ToggleSwitch/ToggleSwitch.css`:

```css
.toggle-switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}
.toggle-switch.disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.toggle-switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.toggle-switch-track {
  position: relative;
  width: 40px;
  height: 22px;
  border-radius: var(--radius-full);
  background: var(--color-surface-container-high);
  transition: background var(--transition-fast);
  flex-shrink: 0;
}
.toggle-switch input:checked + .toggle-switch-track {
  background: var(--color-primary);
}
.toggle-switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-surface);
  transition: transform var(--transition-fast);
}
.toggle-switch input:checked + .toggle-switch-track .toggle-switch-knob {
  transform: translateX(18px);
}
.toggle-switch-label {
  font-size: var(--text-body-md);
  color: var(--color-on-surface-variant);
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/common/ToggleSwitch/
git commit -m "feat(frontend): add reusable ToggleSwitch component"
```

---

### Task 6: Frontend — extend TenantContext with membership settings

**Files:**
- Modify: `frontend/src/contexts/TenantContext.tsx`

- [ ] **Step 1: Extend the context type and state**

In `frontend/src/contexts/TenantContext.tsx`, replace the `TenantSettings` interface (lines 4-10):

```tsx
interface TenantSettings {
  tenantSlug: string;
  tenantName: string;
  logoUrl: string | null;
  notFound: boolean;
  membershipEnabled: boolean;
  membershipMonthlyPrice: number;
  membershipAnnualPrice: number;
  refreshSettings: () => Promise<void>;
}
```

- [ ] **Step 2: Add state and update `refreshSettings`**

Inside `TenantProvider`, add new state alongside the existing `useState` calls (after line 20):

```tsx
  const [membershipEnabled, setMembershipEnabled] = useState(true);
  const [membershipMonthlyPrice, setMembershipMonthlyPrice] = useState(15000);
  const [membershipAnnualPrice, setMembershipAnnualPrice] = useState(150000);
```

Replace the `refreshSettings` callback (lines 22-35):

```tsx
  const refreshSettings = useCallback(async () => {
    try {
      const { data } = await api.get<{
        site_name: string;
        logo_url: string | null;
        membership_enabled: boolean;
        membership_monthly_price: number;
        membership_annual_price: number;
      }>('/settings/public');
      setTenantName(data.site_name || tenantSlug);
      setLogoUrl(data.logo_url);
      setMembershipEnabled(data.membership_enabled);
      setMembershipMonthlyPrice(data.membership_monthly_price);
      setMembershipAnnualPrice(data.membership_annual_price);
      setNotFound(false);
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } }).response?.status === 404) {
        setNotFound(true);
      }
    }
  }, [tenantSlug]);
```

- [ ] **Step 3: Expose the new values from the provider**

Replace the `<TenantContext.Provider value={{ ... }}>` line (line 40):

```tsx
    <TenantContext.Provider value={{
      tenantSlug, tenantName, logoUrl, notFound,
      membershipEnabled, membershipMonthlyPrice, membershipAnnualPrice,
      refreshSettings,
    }}>
```

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/contexts/TenantContext.tsx
git commit -m "feat(frontend): expose membership settings via TenantContext"
```

---

### Task 7: Frontend — MembershipTab admin UI

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/pages/Admin/MembershipTab.tsx`
- Modify: `frontend/src/pages/Admin/AdminDashboard.tsx`

- [ ] **Step 1: Add the new admin tab type**

In `frontend/src/types/index.ts`, replace line 83:

```ts
export type AdminTab = 'overview' | 'courses' | 'users' | 'branding' | 'membership';
```

- [ ] **Step 2: Create `MembershipTab.tsx`**

Create `frontend/src/pages/Admin/MembershipTab.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useTenant } from '../../contexts/TenantContext';
import ToggleSwitch from '../../components/common/ToggleSwitch/ToggleSwitch';

interface MembershipSettings {
  enabled: boolean;
  monthly_price: number;
  annual_price: number;
}

const MembershipTab: React.FC = () => {
  const { refreshSettings } = useTenant();
  const [settings, setSettings] = useState<MembershipSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get<MembershipSettings>('/admin/membership-settings').then(r => setSettings(r.data));
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSuccess(false);
    try {
      const { data } = await api.put<MembershipSettings>('/admin/membership-settings', settings);
      setSettings(data);
      await refreshSettings();
      setSuccess(true);
    } catch {
      alert('Error al guardar la configuración de membresías.');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return null;

  return (
    <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-headline-sm)', color: 'var(--color-on-surface)', marginBottom: 8 }}>
          Membresías
        </h3>
        <p style={{ color: 'var(--color-on-surface-variant)', fontSize: 'var(--text-body-md)' }}>
          Configura si tu academia ofrece suscripciones y a qué precio.
        </p>
      </div>

      <ToggleSwitch
        checked={settings.enabled}
        onChange={checked => setSettings(p => p && { ...p, enabled: checked })}
        label={settings.enabled ? 'Membresías activas' : 'Membresías desactivadas'}
      />

      {!settings.enabled && (
        <p style={{ color: 'var(--color-on-surface-variant)', fontSize: 'var(--text-body-md)' }}>
          Los cursos marcados como exclusivos de membresía no se mostrarán a los alumnos mientras
          las membresías estén desactivadas.
        </p>
      )}

      <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 'var(--text-label-caps)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-primary)' }}>
          Precio mensual (ARS)
        </span>
        <input
          className="form-input"
          type="number"
          min={0}
          step="1"
          disabled={!settings.enabled}
          value={settings.monthly_price}
          onChange={e => setSettings(p => p && { ...p, monthly_price: Number(e.target.value) })}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 'var(--text-label-caps)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-primary)' }}>
          Precio anual (ARS)
        </span>
        <input
          className="form-input"
          type="number"
          min={0}
          step="1"
          disabled={!settings.enabled}
          value={settings.annual_price}
          onChange={e => setSettings(p => p && { ...p, annual_price: Number(e.target.value) })}
        />
      </label>

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
        {saving ? 'Guardando...' : 'Guardar cambios'}
      </button>

      {success && (
        <p style={{ color: 'var(--color-success)', fontWeight: 600 }}>
          Configuración de membresías actualizada correctamente.
        </p>
      )}
    </div>
  );
};

export default MembershipTab;
```

- [ ] **Step 3: Wire the tab into AdminDashboard**

In `frontend/src/pages/Admin/AdminDashboard.tsx`, add the import near the top:

```tsx
import MembershipTab from './MembershipTab';
```

Add to `navItems` (after the `branding` entry, line 281):

```tsx
    { id: 'membership', icon: 'workspace_premium', label: 'Membresías' },
```

Add the render branch right after the `branding` tab's closing `)}` (after line 604):

```tsx
        {tab === 'membership' && (
          <>
            <h1 className="admin-page-title">Membresías</h1>
            <p className="admin-page-subtitle">Configura los planes de suscripción de tu academia.</p>
            <MembershipTab />
          </>
        )}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/pages/Admin/MembershipTab.tsx frontend/src/pages/Admin/AdminDashboard.tsx
git commit -m "feat(frontend): add Membresías admin tab for subscription pricing"
```

---

### Task 8: Frontend — Membership page (ARS prices, annual plan, hide when disabled)

**Files:**
- Modify: `frontend/src/pages/Membership/Membership.tsx`

- [ ] **Step 1: Read settings from TenantContext and ARS formatter**

In `frontend/src/pages/Membership/Membership.tsx`, add imports:

```tsx
import { useTenant } from '../../contexts/TenantContext';
import { formatARS } from '../../utils/currency';
```

Inside the component, add after the existing `useAuth()`/`useNavigate()` lines (around line 8-9):

```tsx
  const { membershipEnabled, membershipMonthlyPrice, membershipAnnualPrice } = useTenant();
```

- [ ] **Step 2: Wrap Monthly+Annual in a membership-enabled check, add the Annual card, and use ARS prices**

Replace the entire `<div className="membership-plans">...</div>` block (lines 48-119, i.e. from `<div className="membership-plans">` through its matching closing `</div>`) with:

```tsx
      <div className="membership-plans">
        {membershipEnabled && (
          <>
            {/* Monthly */}
            <div className="plan-card glass-card">
              <div className="plan-icon-wrap primary">
                <span className="material-symbols-outlined plan-icon primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  auto_awesome
                </span>
              </div>
              <h2 className="plan-name">Suscripción Mensual</h2>
              <p className="plan-desc">
                Acceso ilimitado a toda nuestra biblioteca de masterclasses, recursos y eventos en vivo.
              </p>
              <div className="plan-price">
                <span className="plan-price-amount">{formatARS(membershipMonthlyPrice)}</span>
                <span className="plan-price-period"> / mes</span>
              </div>
              <ul className="plan-features">
                {[
                  '200+ Lecciones en Video',
                  'Sesiones mensuales de preguntas en vivo',
                  'Acceso al foro de la comunidad',
                  'Certificado de finalización',
                  'Nuevos cursos cada mes',
                ].map(f => (
                  <li key={f} className="plan-feature">
                    <span className="material-symbols-outlined plan-feature-icon" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className="plan-btn-primary"
                onClick={() => handleSubscribe('monthly')}
                disabled={loading === 'monthly' || hasActiveSub}
              >
                {loading === 'monthly' ? 'Procesando...' : hasActiveSub ? 'Actualmente activo' : 'Comenzar prueba de 7 días gratis'}
              </button>
            </div>

            {/* Annual */}
            <div className="plan-card glass-card">
              <div className="plan-icon-wrap primary">
                <span className="material-symbols-outlined plan-icon primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  calendar_month
                </span>
              </div>
              <h2 className="plan-name">Suscripción Anual</h2>
              <p className="plan-desc">
                Acceso ilimitado a toda nuestra biblioteca de masterclasses, recursos y eventos en vivo,
                con el mejor precio por mes.
              </p>
              <div className="plan-price">
                <span className="plan-price-amount">{formatARS(membershipAnnualPrice)}</span>
                <span className="plan-price-period"> / año</span>
              </div>
              <ul className="plan-features">
                {[
                  '200+ Lecciones en Video',
                  'Sesiones mensuales de preguntas en vivo',
                  'Acceso al foro de la comunidad',
                  'Certificado de finalización',
                  'Nuevos cursos cada mes',
                ].map(f => (
                  <li key={f} className="plan-feature">
                    <span className="material-symbols-outlined plan-feature-icon" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className="plan-btn-primary"
                onClick={() => handleSubscribe('annual')}
                disabled={loading === 'annual' || hasActiveSub}
              >
                {loading === 'annual' ? 'Procesando...' : hasActiveSub ? 'Actualmente activo' : 'Suscribirse'}
              </button>
            </div>
          </>
        )}

        {/* Individual */}
        <div className="plan-card glass-card">
          <div className="plan-icon-wrap secondary">
            <span className="material-symbols-outlined plan-icon secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
              local_library
            </span>
          </div>
          <h2 className="plan-name">Curso Individual</h2>
          <p className="plan-desc">
            Adquiere un masterclass específico de por vida. Ideal para el desarrollo enfocado de habilidades a tu propio ritmo.
          </p>
          <div className="plan-price">
            <span className="plan-price-from">Desde</span>
            <span className="plan-price-amount">$129</span>
          </div>
          <ul className="plan-features">
            {[
              'Acceso de por vida al curso adquirido',
              'Videos en alta definición',
              'Guías de técnicas descargables',
              'Retroalimentación privada del curso',
            ].map(f => (
              <li key={f} className="plan-feature">
                <span className="material-symbols-outlined plan-feature-icon" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                {f}
              </li>
            ))}
          </ul>
          <button className="plan-btn-outline" onClick={() => navigate('/explorer')}>
            Ver cursos
          </button>
        </div>
      </div>

      {!membershipEnabled && (
        <p style={{ textAlign: 'center', color: 'var(--color-on-surface-variant)', marginTop: 16 }}>
          Esta academia no ofrece membresías por el momento. Explora nuestros cursos individuales.
        </p>
      )}
```

Note: the "Curso Individual" card's `$129` placeholder is unchanged — it's promotional copy, not a real price field, and is out of scope for this plan.

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Membership/Membership.tsx
git commit -m "feat(frontend): show ARS membership prices, add annual plan, hide when disabled"
```

---

### Task 9: Frontend — hide "Membresía" nav link when membership disabled

**Files:**
- Modify: `frontend/src/components/layout/Navbar/Navbar.tsx`

- [ ] **Step 1: Read `membershipEnabled` from TenantContext**

In `frontend/src/components/layout/Navbar/Navbar.tsx`, the component already calls `useTenant()` (line 13):

```tsx
  const { tenantName, logoUrl } = useTenant();
```

Replace it with:

```tsx
  const { tenantName, logoUrl, membershipEnabled } = useTenant();
```

- [ ] **Step 2: Hide the desktop nav link**

Replace line 59:

```tsx
            {membershipEnabled && (
              <li><NavLink to="/membership" className={({ isActive }) => isActive ? 'active' : ''}>Membresía</NavLink></li>
            )}
```

- [ ] **Step 3: Hide the dropdown link**

Replace the dropdown's "Membresía" link (lines 96-103):

```tsx
                  {membershipEnabled && (
                    <NavLink
                      to="/membership"
                      className="user-dropdown-item"
                      onClick={() => setShowDropdown(false)}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>workspace_premium</span>
                      Membresía
                    </NavLink>
                  )}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/Navbar/Navbar.tsx
git commit -m "feat(frontend): hide membership nav links when academy disables membership"
```

---

### Task 10: Frontend — quick publish/unpublish switch in admin courses table

**Files:**
- Modify: `frontend/src/pages/Admin/AdminDashboard.tsx`

- [ ] **Step 1: Import ToggleSwitch**

In `frontend/src/pages/Admin/AdminDashboard.tsx`, add the import near the top:

```tsx
import ToggleSwitch from '../../components/common/ToggleSwitch/ToggleSwitch';
```

- [ ] **Step 2: Add a toggle handler**

Add this function alongside `deleteCourse` (after line 227):

```tsx
  const togglePublished = async (courseId: string, is_published: boolean) => {
    setCourses(prev => prev.map(c => c.id === courseId ? { ...c, is_published } : c));
    try {
      await api.patch(`/admin/courses/${courseId}/published`, { is_published });
    } catch {
      setCourses(prev => prev.map(c => c.id === courseId ? { ...c, is_published: !is_published } : c));
      alert('Error al actualizar el estado del curso.');
    }
  };
```

- [ ] **Step 3: Replace the courses table status cell**

Replace the status-badge cell in the "Cursos" tab table (lines 412-416):

```tsx
                        <td>
                          <ToggleSwitch
                            checked={c.is_published}
                            onChange={checked => togglePublished(c.id, checked)}
                            label={c.is_published ? 'Publicado' : 'Borrador'}
                          />
                        </td>
```

The overview table's read-only status badge (lines 355-359) stays as-is — it's a summary view, not the management table.

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Admin/AdminDashboard.tsx
git commit -m "feat(frontend): add quick publish/unpublish switch to admin courses table"
```

---

### Task 11: Manual end-to-end verification

**Files:** none (manual testing only)

- [ ] **Step 1: Start both dev servers**

```bash
cd backend && npm run dev
```
```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Verify ARS currency display**

- Open the Explorer page and a course detail page for a paid course. Confirm the price shows as `$X.XXX` (no "USD").
- Open `/admin` → "Cursos" tab. Confirm the price column shows ARS-formatted prices and the edit form's price field is labeled "Precio (ARS)".

- [ ] **Step 3: Verify the course publish/unpublish switch**

- In `/admin` → "Cursos", toggle a course's switch off. Confirm it updates immediately to "Borrador" and the course disappears from the public Explorer page.
- Toggle it back on. Confirm it reappears.
- Reload the admin page and confirm the switch state persisted.

- [ ] **Step 4: Verify membership settings**

- In `/admin` → "Membresías", confirm default values (monthly 15000, annual 150000, enabled).
- Change both prices and save. Confirm the success message appears.
- Visit `/membership` and confirm the Monthly and Annual cards show the new ARS prices.

- [ ] **Step 5: Verify the membership disable flow**

- In `/admin` → "Membresías", turn membership off and save.
- Visit `/membership`: confirm the Monthly/Annual cards are gone and the "no ofrece membresías" message appears, with only the "Curso Individual" card visible.
- Confirm the "Membresía" link disappears from the navbar (both logged-out and logged-in dropdown).
- If any course is marked "Exclusivo para miembros", confirm it no longer appears on the Explorer page and visiting its `/courses/:id` URL directly returns a 404/"not found" state.
- Turn membership back on and confirm everything reappears.

---

## Self-Review Notes

- **Spec coverage:** Section 1 (membership pricing + enable/disable) → Tasks 1, 6, 7, 8, 9. Section 2 (ARS currency) → Task 4. Section 3 (course activation toggle) → Tasks 3, 10. All covered.
- **Type consistency:** `MembershipSettings` shape (`{ enabled, monthly_price, annual_price }`) matches between backend (`getMembershipSettings`/`updateMembershipSettings`, Task 1) and frontend (`MembershipTab.tsx`, Task 7). `TenantSettings` field names (`membershipEnabled`, `membershipMonthlyPrice`, `membershipAnnualPrice`, Task 6) match usage in `Membership.tsx` (Task 8) and `Navbar.tsx` (Task 9). `formatARS` (Task 4) signature matches all call sites.
- **Ordering:** Task 6 (TenantContext) must land before Tasks 8 and 9 since both consume the new context fields — task order above already reflects this.

