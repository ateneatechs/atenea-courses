# Membership Pricing, ARS Currency & Course Activation Design

## Overview

This feature gives each academy (tenant) admin control over three things from their Admin panel:

1. **Membership pricing**: configurable monthly and annual subscription prices, plus an on/off switch for whether the academy offers membership subscriptions at all.
2. **Currency**: course (and membership) prices are displayed in Argentine pesos (ARS) instead of USD, with no conversion — existing numeric values are reinterpreted as pesos.
3. **Course activation**: a quick on/off switch in the admin courses table to publish/unpublish a course without opening the edit form or deleting it.

All three pieces are scoped per tenant and follow existing multitenant patterns (`req.tenantId`, `site_settings` table, role-gated `/admin/*` routes).

## 1. Membership Pricing & Enable/Disable

### Data Storage

Reuse the existing `site_settings` key/value table (same pattern as `site_name`, `logo_url`). No migration needed — `site_settings` already supports arbitrary keys per `tenant_id`.

New keys (all stored as text, per tenant):

| Key | Default | Meaning |
|---|---|---|
| `membership_enabled` | `'true'` | Whether this academy offers subscriptions at all |
| `membership_monthly_price` | `'15000'` | Monthly plan price (ARS) |
| `membership_annual_price` | `'150000'` | Annual plan price (ARS) |

If a tenant has no rows for these keys yet (existing tenants), the backend treats missing keys as the defaults above.

### Backend

**`backend/src/controllers/settingsController.ts`**

- Extend `getPublicSettings` (GET `/settings/public`, no auth required) to also return:
  ```json
  {
    "logo_url": null,
    "site_name": "Atenea Courses",
    "membership_enabled": true,
    "membership_monthly_price": 15000,
    "membership_annual_price": 150000
  }
  ```
  - `membership_enabled` is returned as a boolean (`value === 'true'`).
  - Prices are returned as numbers (`Number(value)`), falling back to the defaults above when the row doesn't exist.

- Add two new admin-only handlers in the same file:
  - `getMembershipSettings` — `GET /admin/membership-settings` — returns the same shape `{ enabled, monthly_price, annual_price }` (booleans/numbers).
  - `updateMembershipSettings` — `PUT /admin/membership-settings` — body `{ enabled: boolean, monthly_price: number, annual_price: number }`. Validates:
    - `monthly_price` and `annual_price` must be numbers >= 0.
    - Upserts all three keys via `INSERT ... ON CONFLICT (tenant_id, key) DO UPDATE` (same pattern as `uploadLogo`).
    - Returns the updated settings object.

**`backend/src/routes/admin.ts`** (or wherever admin routes are registered)

- Register:
  ```
  GET  /admin/membership-settings  -> getMembershipSettings
  PUT  /admin/membership-settings  -> updateMembershipSettings
  ```
  Both behind the existing admin-auth middleware used for other `/admin/*` routes.

**`backend/src/controllers/courseController.ts`**

- `getCourses` (GET `/courses`): when `membership_enabled` is `false` for `req.tenantId`, add `AND c.is_membership_exclusive = false` to the WHERE clause (in addition to the existing `is_published = true` filter). Requires one extra query (or a JOIN/subquery) to read `membership_enabled` from `site_settings` — implement as a small helper `isMembershipEnabled(tenantId)` shared with `getCourseById`.

- `getCourseById` (GET `/courses/:id`): when `membership_enabled` is `false` AND the course has `is_membership_exclusive = true`, respond `404 { message: 'Course not found' }` (same as a non-existent course — don't leak existence).

### Frontend

**New file: `frontend/src/pages/Admin/MembershipTab.tsx`**

Follows the same structural pattern as `BrandingTab` (sub-component, self-contained state, save button with success message):

- On mount: `GET /admin/membership-settings`.
- Renders:
  - A toggle switch (new `ToggleSwitch` component, see section 3) labeled "Membresías activas" / "Membresías desactivadas".
  - Two number inputs: "Precio mensual (ARS)" and "Precio anual (ARS)", disabled when the toggle is off.
  - "Guardar cambios" button → `PUT /admin/membership-settings`, shows a success message on completion (same `saved` state pattern as `BrandingTab`).
- When toggle is off, show a short hint: "Los cursos marcados como exclusivos de membresía no se mostrarán a los alumnos mientras las membresías estén desactivadas."

**`frontend/src/pages/Admin/AdminDashboard.tsx`**

- Add `'membership'` to the `AdminTab` union (in `frontend/src/types/index.ts`):
  ```ts
  export type AdminTab = 'overview' | 'courses' | 'users' | 'branding' | 'membership';
  ```
- Add to `navItems`:
  ```ts
  { id: 'membership', icon: 'workspace_premium', label: 'Membresías' },
  ```
- Add the render branch: `{tab === 'membership' && <MembershipTab />}`.

**`frontend/src/contexts/TenantContext.tsx`**

`TenantContext` already calls `GET /settings/public` on mount (`refreshSettings`, lines 22-35) and exposes `tenantName`/`logoUrl`. Extend it to also expose the membership fields:

- Add to the `TenantSettings` interface (lines 4-10): `membershipEnabled: boolean`, `membershipMonthlyPrice: number`, `membershipAnnualPrice: number`.
- Add corresponding `useState` (defaults: `true`, `15000`, `150000` — matching backend defaults).
- In `refreshSettings`, widen the response type to include the new `PublicSettings` fields and set the three new state values from `data.membership_enabled`, `data.membership_monthly_price`, `data.membership_annual_price`.
- Add the new state values to the `<TenantContext.Provider value={{ ... }}>` object.

**`frontend/src/pages/Membership/Membership.tsx`**

- Use `const { membershipEnabled, membershipMonthlyPrice, membershipAnnualPrice } = useTenant();`.
- If `membershipEnabled === false`:
  - Don't render the "Suscripción Mensual" or "Suscripción Anual" plan cards.
  - Show only the "Curso Individual" card (or a short message: "Esta academia no ofrece membresías por el momento. Explora nuestros cursos individuales.") plus a button to `/explorer`.
- If `membership_enabled === true`:
  - "Suscripción Mensual" card price becomes `formatARS(membershipMonthlyPrice)` (see section 2) instead of the hardcoded `$49`.
  - **New** "Suscripción Anual" card (same visual structure as the monthly card, `plan-icon-wrap` etc.), price `formatARS(membershipAnnualPrice)` with `/ año` suffix, button calls `handleSubscribe('annual')` (the backend `createSubscription` endpoint already supports `plan: 'annual'` — no backend change needed there).
  - The existing "Curso Individual" card remains as the third card.

**Navbar / tenant layout**

- Wherever the "Membresía" nav link is rendered (search for `/membership` link in `Navbar`/`TenantLayout`), hide it when `useTenant().membershipEnabled === false`.

## 2. ARS Currency Display

No database changes — existing `price DECIMAL(10,2)` values are reinterpreted as pesos.

**New file: `frontend/src/utils/currency.ts`**

```ts
export const formatARS = (price: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(price);
```

Produces strings like `$15.000`.

**Call sites to update:**

- `frontend/src/components/courses/CourseCard/CourseCard.tsx:18` — `priceLabel` changes from `` `$${course.price} USD` `` to `formatARS(course.price)`.
- `frontend/src/pages/CourseDetail/CourseDetail.tsx:128` — `` `Compra este curso por $${course.price} USD` `` → `` `Compra este curso por ${formatARS(course.price)}` ``.
- `frontend/src/pages/CourseDetail/CourseDetail.tsx:144` — `` `Comprar por $${course.price}` `` → `` `Comprar por ${formatARS(course.price)}` ``.
- `frontend/src/pages/Admin/AdminDashboard.tsx:410` — `` c.price ? `$${c.price}` : 'Gratis' `` → `` c.price ? formatARS(c.price) : 'Gratis' ``.
- `frontend/src/pages/Admin/AdminDashboard.tsx:638` — form label `"Precio (USD)"` → `"Precio (ARS)"`.
- `frontend/src/pages/Membership/Membership.tsx` — membership prices use `formatARS` (see section 1).

No other files reference course price with a currency label (verified during research).

## 3. Quick Publish/Unpublish Toggle for Courses

### Backend

**`backend/src/controllers/adminController.ts`**

New handler `toggleCoursePublished`:

```ts
export const toggleCoursePublished = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { is_published } = req.body;
    const result = await query(
      `UPDATE courses SET is_published = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [is_published === true, id, req.tenantId!]
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

**Routes**: register `PATCH /admin/courses/:id/published -> toggleCoursePublished` alongside the existing `/admin/courses/:id` routes, same admin middleware.

### Frontend

**New file: `frontend/src/components/common/ToggleSwitch/ToggleSwitch.tsx`** (+ co-located `ToggleSwitch.css`)

Small reusable controlled switch:

```tsx
interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}
```

Visual: pill-shaped track (`var(--color-surface-container-high)` off / `var(--color-primary)` on) with a circular knob, CSS transition on `transform`/`background`. Used both here and in `MembershipTab.tsx`.

**`frontend/src/pages/Admin/AdminDashboard.tsx`**

- Replace the status-badge cell at `AdminDashboard.tsx:412-416` (and the overview table's equivalent at `~356-358`) with:
  ```tsx
  <ToggleSwitch
    checked={c.is_published}
    onChange={async (checked) => {
      await api.patch(`/admin/courses/${c.id}/published`, { is_published: checked });
      setCourses(prev => prev.map(course => course.id === c.id ? { ...course, is_published: checked } : course));
    }}
    label={c.is_published ? 'Publicado' : 'Borrador'}
  />
  ```
- The existing checkbox in the course edit form (`AdminDashboard.tsx:676-681`, "Publicado") stays as-is — it still works via the regular `saveCourse` multipart submit. The new switch is an additional, faster path for the same field.
- If the `PATCH` request fails, revert the optimistic UI update and show an alert (same error-handling style as `deleteCourse`).

## Error Handling

- `updateMembershipSettings`: reject with `400` if `monthly_price`/`annual_price` are negative or not finite numbers, or if `enabled` is not a boolean.
- `toggleCoursePublished`: `404` if the course doesn't belong to the tenant (mirrors `updateCourse`'s existing tenant check).
- Frontend `MembershipTab` and the course toggle both show a simple `alert()` on failure, consistent with existing admin error handling (`deleteCourse`, `saveCourse`).

## Testing

- **Backend**: manual verification via existing dev server — confirm `GET/PUT /admin/membership-settings` persist correctly, `GET /settings/public` reflects the new fields with correct defaults for tenants with no rows yet, and `GET /courses` / `GET /courses/:id` correctly hide membership-exclusive courses when `membership_enabled = false`.
- **Frontend**: manual verification in browser —
  - Toggle membership off/on in admin, confirm Membership page and navbar link respond accordingly.
  - Edit monthly/annual prices, confirm they appear correctly formatted (ARS) on the Membership page.
  - Confirm course prices show as ARS (e.g. `$15.000`) on Explorer, CourseCard, CourseDetail, and Admin courses table.
  - Use the new course table switch to toggle a course's published state and confirm it updates immediately and persists after page reload.
- No automated test suite currently exists for this codebase (per existing patterns) — this feature follows the same manual-verification approach as prior tasks (e.g. Task 12 of the Mercado Pago plan).

## Out of Scope

- Actual payment/checkout flow for membership subscriptions (handled separately by the Mercado Pago marketplace work).
- Currency conversion or multi-currency support — ARS is the only currency, applied via display formatting only.
- A separate "active/inactive" status distinct from `is_published` — the existing publish/draft field is reused, just exposed via a faster UI control.
