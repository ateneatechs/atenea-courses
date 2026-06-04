# Subdomain-Based Routing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace path-based tenant routing (`/:tenantSlug/*`) with subdomain-based routing (`naza-barber.atenea-courses.com/*`) so each barber client has their own clean URL.

**Architecture:** Frontend reads tenant slug from `window.location.hostname` (or `VITE_DEV_TENANT` env var in dev). Axios interceptor still injects `X-Tenant-Slug` header — backend unchanged. App routes become flat (`/explorer`, `/courses/:id`) instead of prefixed (`/:tenantSlug/explorer`).

**Tech Stack:** React 18 + TypeScript + React Router v6 + Vite, Nginx on VPS (Hostinger).

---

## File Map

### New files
| Path | Purpose |
|------|---------|
| `frontend/src/utils/tenant.ts` | `getTenantSlug()` — single source of truth for hostname → slug |
| `frontend/.env.local` | `VITE_DEV_TENANT=naza-barber` for local dev |

### Modified files
| Path | Change |
|------|--------|
| `frontend/src/vite-env.d.ts` | Declare `VITE_DEV_TENANT` env var type |
| `frontend/src/services/api.ts` | Import `getTenantSlug` from utils instead of inline pathname parse |
| `frontend/src/App.tsx` | Flat routes + `RootElement` component for subdomain detection |
| `frontend/src/components/layout/TenantLayout/TenantLayout.tsx` | Use `getTenantSlug()` instead of `useParams` |
| `frontend/src/components/layout/Navbar/Navbar.tsx` | Absolute links, remove slug prefix logic |
| `frontend/src/pages/Home/Home.tsx` | Absolute `navigate('/explorer')`, `navigate('/membership')` |
| `frontend/src/components/courses/CourseCard/CourseCard.tsx` | Absolute `navigate('/courses/${id}')` |
| `frontend/src/pages/Landing/Landing.tsx` | Rewrite as Atenea sales page |
| `frontend/vite.config.ts` | Add `server.allowedHosts: 'all'` |
| `nginx/nginx.conf` | Wildcard subdomain + SSL config |

---

## Task 1: `getTenantSlug()` utility + dev env

**Files:**
- Create: `frontend/src/utils/tenant.ts`
- Create: `frontend/.env.local`
- Modify: `frontend/src/vite-env.d.ts`

- [ ] **Step 1: Create `frontend/src/utils/tenant.ts`**

```ts
export function getTenantSlug(): string | null {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return import.meta.env.VITE_DEV_TENANT || null;
  }
  // naza-barber.atenea-courses.com → "naza-barber"
  const parts = hostname.split('.');
  return parts.length >= 3 ? parts[0] : null;
}
```

- [ ] **Step 2: Create `frontend/.env.local`**

```
VITE_DEV_TENANT=naza-barber
```

Note: `.env.local` is already in `.gitignore` — never commit secrets here.

- [ ] **Step 3: Declare env var type in `frontend/src/vite-env.d.ts`**

Replace entire file with:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_TENANT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css';
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/tenant.ts frontend/src/vite-env.d.ts
git commit -m "feat(frontend): getTenantSlug() utility reads from hostname"
```

Note: `.env.local` is intentionally NOT committed.

---

## Task 2: Update `api.ts` to use the utility

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Replace the file**

```ts
import axios from 'axios';
import { getTenantSlug } from '../utils/tenant';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('atenea-token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;

  const slug = getTenantSlug();
  if (slug) config.headers['X-Tenant-Slug'] = slug;

  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('atenea-token');
    }
    return Promise.reject(error);
  }
);

export default api;
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && node_modules/.bin/tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "refactor(frontend): api.ts uses getTenantSlug() from utils"
```

---

## Task 3: Update `TenantLayout`

**Files:**
- Modify: `frontend/src/components/layout/TenantLayout/TenantLayout.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { TenantProvider, useTenant } from '../../../contexts/TenantContext';
import { getTenantSlug } from '../../../utils/tenant';
import Navbar from '../Navbar/Navbar';
import Footer from '../Footer/Footer';

const TenantGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { notFound } = useTenant();
  if (notFound) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const TenantLayout: React.FC = () => {
  const tenantSlug = getTenantSlug();

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

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && node_modules/.bin/tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/TenantLayout/TenantLayout.tsx
git commit -m "refactor(frontend): TenantLayout reads slug from hostname"
```

---

## Task 4: Update `App.tsx` — flat routes

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { getTenantSlug } from './utils/tenant';
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

// Shows TenantLayout (with Outlet for children) when subdomain present,
// or Landing when accessed from the root domain.
const RootElement: React.FC = () => {
  const slug = getTenantSlug();
  return slug ? <TenantLayout /> : <Landing />;
};

const App: React.FC = () => (
  <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootElement />}>
            <Route index element={<Home />} />
            <Route path="explorer" element={<Explorer />} />
            <Route path="courses/:id" element={<CourseDetail />} />
            <Route path="membership" element={<Membership />} />
            <Route
              path="admin/*"
              element={<AdminRoute><AdminDashboard /></AdminRoute>}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
          <Route
            path="/super-admin/*"
            element={
              <SuperAdminRoute>
                <SuperAdminDashboard />
              </SuperAdminRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && node_modules/.bin/tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(frontend): flat routes — subdomain replaces /:tenantSlug prefix"
```

---

## Task 5: Update `Navbar.tsx` — absolute links

**Files:**
- Modify: `frontend/src/components/layout/Navbar/Navbar.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { useTenant } from '../../../contexts/TenantContext';
import LoginModal from '../../auth/LoginModal/LoginModal';
import RegisterModal from '../../auth/RegisterModal/RegisterModal';
import './Navbar.css';

const Navbar: React.FC = () => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { tenantName, logoUrl } = useTenant();
  const navigate = useNavigate();

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
    navigate('/');
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <>
      <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
        <div className="navbar-left">
          {logoUrl
            ? <NavLink to="/"><img src={logoUrl} alt={tenantName} className="navbar-logo-img" /></NavLink>
            : <NavLink to="/" className="navbar-logo">{tenantName}</NavLink>
          }
          <ul className="navbar-links">
            <li><NavLink to="/explorer" className={({ isActive }) => isActive ? 'active' : ''}>Explorar</NavLink></li>
            <li><NavLink to="/explorer?filter=masterclass" className={({ isActive }) => isActive ? 'active' : ''}>Masterclasses</NavLink></li>
            <li><NavLink to="/membership" className={({ isActive }) => isActive ? 'active' : ''}>Membresía</NavLink></li>
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
                      onClick={() => { navigate('/admin'); setShowDropdown(false); }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>admin_panel_settings</span>
                      Panel de Admin
                    </button>
                  )}
                  <NavLink
                    to="/membership"
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

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/layout/Navbar/Navbar.tsx
git commit -m "refactor(frontend): navbar uses absolute links — no slug prefix"
```

---

## Task 6: Fix navigate paths in `Home.tsx` and `CourseCard.tsx`

**Files:**
- Modify: `frontend/src/pages/Home/Home.tsx`
- Modify: `frontend/src/components/courses/CourseCard/CourseCard.tsx`

- [ ] **Step 1: In `Home.tsx`, change all relative navigate calls to absolute**

Find and replace these 6 occurrences:

```tsx
// BEFORE → AFTER
navigate('explorer')           → navigate('/explorer')
navigate('membership')         → navigate('/membership')  // appears twice
navigate(`courses/${large.id}`) → navigate(`/courses/${large.id}`)
navigate(`courses/${c.id}`)    → navigate(`/courses/${c.id}`)
<Link to="explorer"            → <Link to="/explorer"
```

- [ ] **Step 2: In `CourseCard.tsx`, change relative navigate to absolute**

Find line 22:
```tsx
<div className="course-card" onClick={() => navigate(`courses/${course.id}`)}>
```
Replace with:
```tsx
<div className="course-card" onClick={() => navigate(`/courses/${course.id}`)}>
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && node_modules/.bin/tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Home/Home.tsx
git add frontend/src/components/courses/CourseCard/CourseCard.tsx
git commit -m "fix(frontend): absolute navigate paths for flat routing"
```

---

## Task 7: Rewrite `Landing.tsx` as Atenea sales page

**Files:**
- Modify: `frontend/src/pages/Landing/Landing.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import './Landing.css';

const FEATURES = [
  { icon: 'palette', title: 'Marca propia', desc: 'Logo, nombre y dominio exclusivo para tu academia.' },
  { icon: 'play_circle', title: 'Cursos ilimitados', desc: 'Subí videos, quizzes y recursos sin límite de contenido.' },
  { icon: 'group', title: 'Gestión de alumnos', desc: 'Panel de admin con usuarios, suscripciones e ingresos.' },
  { icon: 'workspace_premium', title: 'Membresías y ventas', desc: 'Vendé acceso mensual o por curso individualmente.' },
  { icon: 'smartphone', title: 'Optimizado para móvil', desc: 'Tus alumnos aprenden desde cualquier dispositivo.' },
  { icon: 'lock', title: 'Contenido protegido', desc: 'Solo alumnos con acceso pueden ver tus videos.' },
];

const Landing: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <span className="landing-nav-logo">Atenea Courses</span>
        <button className="landing-nav-theme" onClick={toggleTheme} title="Cambiar tema">
          <span className="material-symbols-outlined">
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
        </button>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <p className="landing-eyebrow">Plataforma SaaS para academias</p>
        <h1 className="landing-title">
          Tu academia online,<br />tu marca, tu dominio.
        </h1>
        <p className="landing-subtitle">
          Creamos la plataforma para que vos te enfoques en enseñar. Subí tus cursos, gestioná tus alumnos y cobrá — todo desde un solo lugar con tu nombre.
        </p>
        <a
          className="landing-cta"
          href="mailto:hola@atenea-courses.com?subject=Quiero%20mi%20academia"
        >
          Quiero mi academia
        </a>
      </section>

      {/* Features */}
      <section className="landing-features">
        <h2 className="landing-features-title">Todo lo que necesitás</h2>
        <div className="landing-features-grid">
          {FEATURES.map(f => (
            <div key={f.icon} className="landing-feature-card">
              <span className="material-symbols-outlined landing-feature-icon" style={{ fontVariationSettings: "'FILL' 1" }}>
                {f.icon}
              </span>
              <h3 className="landing-feature-name">{f.title}</h3>
              <p className="landing-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA bottom */}
      <section className="landing-bottom-cta">
        <h2 className="landing-bottom-title">¿Listo para lanzar tu academia?</h2>
        <p className="landing-bottom-sub">Hablemos. Te tenemos operativo en menos de 48 horas.</p>
        <a
          className="landing-cta"
          href="mailto:hola@atenea-courses.com?subject=Quiero%20mi%20academia"
        >
          Contactanos
        </a>
      </section>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} Atenea Courses</span>
      </footer>
    </div>
  );
};

export default Landing;
```

- [ ] **Step 2: Create `frontend/src/pages/Landing/Landing.css`**

```css
.landing {
  min-height: 100vh;
  background: var(--color-background);
  color: var(--color-on-surface);
  display: flex;
  flex-direction: column;
}

/* Nav */
.landing-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px var(--spacing-margin-desktop, 64px);
  position: sticky;
  top: 0;
  background: var(--nav-bg);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid color-mix(in srgb, var(--color-outline) 15%, transparent);
  z-index: 100;
}

.landing-nav-logo {
  font-family: var(--font-display);
  font-size: var(--text-headline-md);
  font-weight: 500;
  color: var(--color-primary);
  font-style: italic;
  letter-spacing: -0.02em;
}

.landing-nav-theme {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-on-surface-variant);
  display: flex;
  align-items: center;
  padding: 6px;
  border-radius: var(--radius-full);
  transition: color var(--transition-fast);
}
.landing-nav-theme:hover { color: var(--color-primary); }

/* Hero */
.landing-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 100px var(--spacing-margin-desktop, 64px) 80px;
  max-width: 760px;
  margin: 0 auto;
}

.landing-eyebrow {
  font-size: var(--text-label-caps, 11px);
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--color-primary);
  margin-bottom: 16px;
}

.landing-title {
  font-family: var(--font-display);
  font-size: clamp(2.4rem, 6vw, 4rem);
  font-weight: 500;
  line-height: 1.1;
  color: var(--color-on-surface);
  margin-bottom: 24px;
  letter-spacing: -0.02em;
}

.landing-subtitle {
  font-size: var(--text-body-lg, 1.0625rem);
  color: var(--color-on-surface-variant);
  line-height: 1.65;
  margin-bottom: 40px;
  max-width: 560px;
}

.landing-cta {
  display: inline-block;
  padding: 14px 36px;
  background: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: var(--radius-full);
  font-size: var(--text-label-caps, 11px);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  text-decoration: none;
  transition: box-shadow var(--transition-normal), transform var(--transition-fast);
}
.landing-cta:hover {
  box-shadow: var(--shadow-glow);
  transform: translateY(-2px);
}

/* Features */
.landing-features {
  padding: 80px var(--spacing-margin-desktop, 64px);
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.landing-features-title {
  font-family: var(--font-display);
  font-size: var(--text-headline-lg, 2rem);
  font-weight: 500;
  text-align: center;
  color: var(--color-on-surface);
  margin-bottom: 56px;
}

.landing-features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
}

.landing-feature-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 32px;
  border-radius: var(--radius-lg);
  background: var(--color-surface-container-low);
  border: 1px solid var(--color-outline-variant);
}

.landing-feature-icon {
  font-size: 28px;
  color: var(--color-primary);
}

.landing-feature-name {
  font-family: var(--font-display);
  font-size: var(--text-headline-xs, 1.125rem);
  font-weight: 500;
  color: var(--color-on-surface);
}

.landing-feature-desc {
  font-size: var(--text-body-md);
  color: var(--color-on-surface-variant);
  line-height: 1.6;
}

/* Bottom CTA */
.landing-bottom-cta {
  text-align: center;
  padding: 80px var(--spacing-margin-desktop, 64px);
  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-background));
}

.landing-bottom-title {
  font-family: var(--font-display);
  font-size: var(--text-headline-lg, 2rem);
  color: var(--color-on-surface);
  margin-bottom: 12px;
}

.landing-bottom-sub {
  color: var(--color-on-surface-variant);
  font-size: var(--text-body-lg);
  margin-bottom: 36px;
}

/* Footer */
.landing-footer {
  text-align: center;
  padding: 24px;
  font-size: 13px;
  color: var(--color-on-surface-variant);
  border-top: 1px solid var(--color-outline-variant);
  margin-top: auto;
}

/* Mobile */
@media (max-width: 768px) {
  .landing-nav { padding: 16px var(--spacing-margin-mobile, 20px); }
  .landing-hero { padding: 60px var(--spacing-margin-mobile, 20px) 48px; }
  .landing-features { padding: 48px var(--spacing-margin-mobile, 20px); }
  .landing-features-grid { grid-template-columns: 1fr; gap: 20px; }
  .landing-bottom-cta { padding: 48px var(--spacing-margin-mobile, 20px); }
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && node_modules/.bin/tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Landing/Landing.tsx frontend/src/pages/Landing/Landing.css
git commit -m "feat(frontend): Atenea sales landing page at root domain"
```

---

## Task 8: Update `vite.config.ts`

**Files:**
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: Replace the file**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: 'all',
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  resolve: { alias: { '@': '/src' } },
});
```

- [ ] **Step 2: Commit**

```bash
git add frontend/vite.config.ts
git commit -m "chore(frontend): allow all hosts in vite dev server"
```

---

## Task 9: Update `nginx/nginx.conf` for VPS

**Files:**
- Modify: `nginx/nginx.conf`

- [ ] **Step 1: Replace the file**

```nginx
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout 65;
    client_max_body_size 2048M;

    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;

    # ── HTTP → HTTPS redirect ──────────────────────────────────────
    server {
        listen 80;
        server_name atenea-courses.com *.atenea-courses.com;
        return 301 https://$host$request_uri;
    }

    # ── Tenant subdomains: naza-barber.atenea-courses.com ──────────
    server {
        listen 443 ssl;
        server_name ~^(?<tenant>.+)\.atenea-courses\.com$;

        ssl_certificate     /etc/letsencrypt/live/atenea-courses.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/atenea-courses.com/privkey.pem;
        ssl_protocols       TLSv1.2 TLSv1.3;
        ssl_ciphers         HIGH:!aNULL:!MD5;

        # Forward API and uploads to backend
        location /api/ {
            proxy_pass http://localhost:3000/api/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_read_timeout 120s;
        }

        location /uploads/ {
            proxy_pass http://localhost:3000/uploads/;
            expires 30d;
            add_header Cache-Control "public, no-transform";
        }

        # Frontend SPA — serve built static files
        location / {
            root /var/www/atenea-courses/frontend/dist;
            try_files $uri $uri/ /index.html;
        }
    }

    # ── Root domain: atenea-courses.com ───────────────────────────
    server {
        listen 443 ssl;
        server_name atenea-courses.com;

        ssl_certificate     /etc/letsencrypt/live/atenea-courses.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/atenea-courses.com/privkey.pem;
        ssl_protocols       TLSv1.2 TLSv1.3;
        ssl_ciphers         HIGH:!aNULL:!MD5;

        location /api/ {
            proxy_pass http://localhost:3000/api/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_read_timeout 120s;
        }

        location /uploads/ {
            proxy_pass http://localhost:3000/uploads/;
            expires 30d;
            add_header Cache-Control "public, no-transform";
        }

        location / {
            root /var/www/atenea-courses/frontend/dist;
            try_files $uri $uri/ /index.html;
        }
    }
}
```

Note: This config assumes the frontend is built (`npm run build`) and served as static files from `/var/www/atenea-courses/frontend/dist`. The backend runs as a Node process on port 3000 (managed by PM2).

- [ ] **Step 2: Commit**

```bash
git add nginx/nginx.conf
git commit -m "feat(nginx): wildcard subdomain routing + SSL for VPS deployment"
```

---

## Task 10: Final verification

- [ ] **Step 1: Full TypeScript check**

```bash
cd frontend && node_modules/.bin/tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 2: Start backend**

```bash
cd backend && npm run dev
```

Expected: `Server running on port 3000`.

- [ ] **Step 3: Start frontend**

```bash
cd frontend && npm run dev
```

Expected: `VITE ready on http://localhost:5173/`

- [ ] **Step 4: Verify tenant routing**

Open `http://localhost:5173`. Because `.env.local` has `VITE_DEV_TENANT=naza-barber`, the app should load the Naza Barber home page directly — no slug in the URL.

Expected: Home page loads with "Naza Barber" in the navbar.

- [ ] **Step 5: Verify navigation**

Navigate to `http://localhost:5173/explorer`. Expected: course grid loads. URL stays at `/explorer` (no `/naza-barber/` prefix).

- [ ] **Step 6: Verify root domain (no tenant)**

Temporarily comment out `VITE_DEV_TENANT` in `.env.local`, restart Vite, and open `http://localhost:5173`. Expected: Atenea sales landing page. Restore the line after verifying.

- [ ] **Step 7: Final commit**

```bash
git add -A
git status  # verify only expected files
git commit -m "feat: subdomain-based multi-tenant routing complete"
```
