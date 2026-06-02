---
name: naza-barber-redesign
description: Mobile course card redesign (full-width image overlay), color palette refinement to clean white/cream, and dynamic academy logo upload feature for admin
metadata:
  type: project
---

# Naza Barber — Rediseño UI + Logo Dinámico

## Resumen

Tres cambios coordinados para el cliente Naza Barber:

1. **Mobile course cards** — layout más visual, menos texto en pantallas pequeñas
2. **Paleta cream/blanco** — refinamiento del tema claro hacia blanco puro con acentos crema
3. **Logo dinámico en navbar** — el admin sube su logo desde el panel y reemplaza el texto "Atenea Courses"

---

## 1. Mobile Course Cards

### Problema
En mobile las cards muestran demasiado texto (instructor, duración, descripción) y el layout vertical hace que se necesite mucho scroll para ver los cursos disponibles.

### Solución
En mobile (≤640px), cada `CourseCard` cambia a un layout **full-width imagen con overlay**:

- Aspect-ratio de la imagen: `16/9` (landscape) en lugar de `4/5` (portrait)
- Degradado oscuro desde la parte inferior de la imagen
- Título + precio + badge superpuestos sobre la imagen (absolute positioning dentro del image-wrap)
- Se ocultan `.course-card-instructor` y `.course-card-duration` en mobile
- El bloque `.course-card-info` queda vacío en mobile y se oculta con `display: none`

En desktop (>640px) no hay ningún cambio — el layout actual se mantiene intacto.

**Archivos afectados:**
- `frontend/src/components/courses/CourseCard/CourseCard.tsx` — mover los elementos de título/precio dentro del image-wrap con clase condicional, o usar CSS para reposicionarlos
- `frontend/src/components/courses/CourseCard/CourseCard.css` — media query `@media (max-width: 640px)` con los nuevos estilos overlay

**Decisión de implementación:** Usar CSS puro con `position: absolute` para el overlay, sin cambios estructurales al JSX. El `.course-card-info` se oculta en mobile con `display: none` y se crea un `.course-card-overlay-body` visible solo en mobile con `position: absolute; bottom: 0`.

---

## 2. Paleta Cream/Blanco

### Cambios en `frontend/src/styles/variables.css` (solo `:root`, dark mode sin cambios)

| Token | Antes | Después |
|-------|-------|---------|
| `--color-background` | `#FAF8F4` | `#FFFFFF` |
| `--color-surface` | `#FAF8F4` | `#FAFAFA` |
| `--color-surface-container` | `#F0EDE5` | `#F5F0EA` |
| `--color-surface-container-low` | `#F6F3EE` | `#FDFBF8` |
| `--color-primary` | `#8B6914` | `#7A5C0A` |
| `--glass-bg` | `rgba(255,255,255,0.82)` | `rgba(255,255,255,0.92)` |
| `--nav-bg` | `rgba(250,248,244,0.92)` | `rgba(255,255,255,0.95)` |

El resultado es un fondo blanco nítido con crema suave en superficies elevadas, y el dorado se profundiza ligeramente para mantener contraste WCAG AA sobre fondo blanco.

---

## 3. Logo Dinámico en Navbar

### Base de datos

**Nueva migración:** `database/03-site-settings.sql`

```sql
CREATE TABLE IF NOT EXISTS site_settings (
  key   VARCHAR(100) PRIMARY KEY,
  value TEXT
);

INSERT INTO site_settings (key, value) VALUES ('logo_url', null)
  ON CONFLICT (key) DO NOTHING;
INSERT INTO site_settings (key, value) VALUES ('site_name', 'Naza Barber')
  ON CONFLICT (key) DO NOTHING;
```

### Backend

**Nuevo archivo:** `backend/src/controllers/settingsController.ts`

- `getPublicSettings` — `GET /api/settings/public` — sin auth — devuelve `{ logo_url, site_name }`
- `uploadLogo` — `POST /api/admin/settings/logo` — requiere auth + rol admin — recibe `multipart/form-data` con campo `logo`, guarda en `uploads/logos/` via multer, actualiza `site_settings` donde `key = 'logo_url'`

**Nuevas rutas:**
- `backend/src/routes/settings.ts` — registra `GET /public`
- `backend/src/routes/admin.ts` — agrega `POST /settings/logo` (ya tiene middleware auth+admin)
- `backend/src/app.ts` — monta `/api/settings` con el nuevo router

**Multer config:** Reutilizar `backend/src/config/multer.ts` existente, agregar un storage específico para logos con destino `uploads/logos/` y filtro de mimetype `image/*`.

**Serving estático:** `app.ts` ya debe servir `/uploads` como estático (o agregarlo si no está).

### Frontend

**`frontend/src/contexts/SiteSettingsContext.tsx`** (nuevo) — Context liviano que fetchea `GET /api/settings/public` una vez al montar la app y expone `{ logoUrl, siteName }`. Se envuelve en `App.tsx` junto a los demás providers.

**`frontend/src/components/layout/Navbar/Navbar.tsx`** — Consume `useSiteSettings()`. El logo text `<NavLink>Atenea Courses</NavLink>` se reemplaza por:
```tsx
{logoUrl
  ? <NavLink to="/"><img src={logoUrl} alt={siteName} className="navbar-logo-img" /></NavLink>
  : <NavLink to="/" className="navbar-logo">{siteName}</NavLink>
}
```

**`frontend/src/pages/Admin/AdminDashboard.tsx`** — Nueva pestaña `'branding'` en el tipo `AdminTab`. Contiene:
- Preview del logo actual
- Input file para nueva imagen
- Botón "Guardar logo"
- Al guardar exitoso: llama a `refreshSettings()` del context para que el navbar actualice inmediatamente

**`frontend/src/types/index.ts`** — Agregar `'branding'` a `AdminTab`.

### Flujo completo
```
Admin abre Panel → pestaña "Personalización"
→ selecciona archivo .png/.jpg
→ POST /api/admin/settings/logo (multipart)
→ backend guarda archivo → actualiza DB
→ frontend recibe respuesta → refreshSettings()
→ SiteSettingsContext re-fetchea → Navbar muestra nuevo logo
```

---

## Archivos modificados / creados

| Archivo | Acción |
|---------|--------|
| `database/03-site-settings.sql` | Crear |
| `backend/src/controllers/settingsController.ts` | Crear |
| `backend/src/routes/settings.ts` | Crear |
| `backend/src/routes/admin.ts` | Modificar (agregar ruta logo) |
| `backend/src/app.ts` | Modificar (montar router settings, servir /uploads) |
| `backend/src/config/multer.ts` | Modificar (agregar storage logos) |
| `frontend/src/styles/variables.css` | Modificar (tokens de color) |
| `frontend/src/components/courses/CourseCard/CourseCard.tsx` | Modificar (overlay mobile) |
| `frontend/src/components/courses/CourseCard/CourseCard.css` | Modificar (media query overlay) |
| `frontend/src/contexts/SiteSettingsContext.tsx` | Crear |
| `frontend/src/App.tsx` | Modificar (envolver con SiteSettingsProvider) |
| `frontend/src/components/layout/Navbar/Navbar.tsx` | Modificar (logo dinámico) |
| `frontend/src/components/layout/Navbar/Navbar.css` | Modificar (estilos navbar-logo-img) |
| `frontend/src/pages/Admin/AdminDashboard.tsx` | Modificar (pestaña Personalización) |
| `frontend/src/types/index.ts` | Modificar (AdminTab += 'branding') |

## Fuera de scope
- Generación o diseño del logo gráfico (lo hace el cliente manualmente)
- Cambio del nombre en textos de contenido demo (lecciones, descripciones) — lo hace el cliente
- Modo dark: sin cambios
- Funcionalidad de "cargar más cursos" (ya existente, sin cambios)
