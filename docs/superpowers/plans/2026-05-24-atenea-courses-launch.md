# Atenea Courses — Demo Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el sistema corriendo con Docker, branding barbería premium (dark + dorado #C9A96E), nombre "Atenea Courses", categorías y cursos de barbería en español.

**Architecture:** 5 servicios Docker (postgres, backend, frontend, nginx, seed). El servicio seed usa `ts-node` para ejecutar el script existente una sola vez tras que postgres esté healthy. El frontend se sirve como SPA via nginx. El proxy nginx en puerto 80 enruta `/api/*` al backend y `/` al frontend.

**Tech Stack:** React 18 + TypeScript + Vite + Axios / Node.js + Express + TypeScript + pg / PostgreSQL 16 / Nginx / Docker Compose

---

## Mapa de archivos

| Archivo | Acción | Razón |
|---------|--------|-------|
| `docker-compose.yml` | Modificar | Agregar servicio `seed` |
| `database/schema.sql` | Modificar | Categorías de barbería |
| `backend/src/seed.ts` | Modificar | Emails Atenea + 6 cursos de barbería en español |
| `database/seed.ts` | Modificar | Mismo cambio (copia para dev local) |
| `frontend/index.html` | Modificar | Título + Montserrat font |
| `frontend/src/styles/variables.css` | Modificar | Gold primario `#C9A96E` + font Montserrat |
| `frontend/src/contexts/ThemeContext.tsx` | Modificar | Default dark, key localStorage `atenea-theme` |
| `frontend/src/components/layout/Navbar/Navbar.tsx` | Modificar | "Lumière Academy" → "Atenea Courses" |
| `frontend/src/components/layout/Footer/Footer.tsx` | Modificar | Branding + tagline barbería |
| `frontend/src/pages/Home/Home.tsx` | Modificar | Hero content + stats adaptados a barbería |
| `frontend/src/pages/CourseDetail/CourseDetail.tsx` | Modificar | Traducir strings hardcodeados en inglés |

---

## Task 1: Agregar servicio seed a Docker Compose

**Archivos:**
- Modificar: `docker-compose.yml`

- [ ] **Paso 1: Agregar el servicio seed**

  Abrir `docker-compose.yml` y agregar el servicio `seed` al final de `services:`, antes de `volumes:`:

  ```yaml
    seed:
      image: node:20-alpine
      container_name: atenea-seed
      working_dir: /app
      volumes:
        - ./backend:/app
      environment:
        DATABASE_URL: postgres://lumiere:lumiere_pass@postgres:5432/lumiere_academy
      command: sh -c "npm ci && npx ts-node --transpile-only src/seed.ts"
      depends_on:
        postgres:
          condition: service_healthy
      restart: "no"
  ```

- [ ] **Paso 2: Verificar sintaxis del docker-compose.yml**

  ```bash
  docker compose config
  ```
  
  Debe mostrar la configuración completa sin errores de YAML.

- [ ] **Paso 3: Commit**

  ```bash
  git add docker-compose.yml
  git commit -m "feat(docker): add seed service for automatic DB population"
  ```

---

## Task 2: Actualizar categorías en schema.sql

**Archivos:**
- Modificar: `database/schema.sql` (solo el INSERT de categorías al final)

- [ ] **Paso 1: Reemplazar el INSERT de categorías**

  En `database/schema.sql`, reemplazar el bloque INSERT de categories (líneas 91-97) por:

  ```sql
  INSERT INTO categories (name, slug) VALUES
    ('Fade', 'fade'),
    ('Barba', 'beard'),
    ('Corte Clásico', 'clasico'),
    ('Colorimetría', 'colorimetria'),
    ('Negocio', 'negocio')
  ON CONFLICT (slug) DO NOTHING;
  ```

- [ ] **Paso 2: Commit**

  ```bash
  git add database/schema.sql
  git commit -m "feat(db): update categories to barbershop-specific"
  ```

---

## Task 3: Actualizar seed con contenido de barbería

**Archivos:**
- Modificar: `backend/src/seed.ts`
- Modificar: `database/seed.ts` (mismo contenido)

- [ ] **Paso 1: Reemplazar backend/src/seed.ts**

  Reemplazar el contenido completo de `backend/src/seed.ts` con:

  ```typescript
  import bcrypt from 'bcryptjs';
  import { Pool } from 'pg';
  import dotenv from 'dotenv';
  import path from 'path';

  dotenv.config({ path: path.join(__dirname, '../.env') });

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://lumiere:lumiere_pass@localhost:5432/lumiere_academy',
  });

  async function seed() {
    const client = await pool.connect();
    try {
      console.log('Seeding database...');

      const adminHash = await bcrypt.hash('Admin123!', 12);
      const userHash = await bcrypt.hash('User123!', 12);

      await client.query(`
        INSERT INTO users (email, password_hash, name, role) VALUES
          ('admin@atenea.com', $1, 'Atenea Admin', 'admin'),
          ('user@atenea.com', $2, 'Usuario Demo', 'user')
        ON CONFLICT (email) DO NOTHING
      `, [adminHash, userHash]);

      const catResult = await client.query('SELECT id, slug FROM categories');
      const cats: Record<string, string> = {};
      catResult.rows.forEach((r: { slug: string; id: string }) => { cats[r.slug] = r.id; });

      await client.query(`
        INSERT INTO courses (title, description, instructor_name, thumbnail_url, price, category_id, badge, total_lessons, total_duration, is_membership_exclusive, is_published)
        VALUES
          ('El Arte del Fade Perfecto', 'Domina todas las variaciones del fade desde cero hasta el nivel más avanzado. Técnicas de transición suave, skin fade y high fade explicadas paso a paso por un maestro barbero con más de 10 años de experiencia en competencias internacionales.', 'Marcos Delgado', 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=80', 199.00, $1, 'Masterclass', 10, '3h 45m', false, true),
          ('Diseño y Perfilado de Barba', 'Aprende a diseñar, perfilar y dar forma a cualquier tipo de barba. Desde barba corta de oficina hasta full beard artística. Incluye técnica de navaja para líneas perfectas y mantenimiento profesional.', 'Rodrigo Fuentes', 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&q=80', null, $2, 'Exclusivo Miembros', 8, '2h 50m', true, true),
          ('Corte Clásico con Tijera', 'Técnicas de tijera para cortes masculinos clásicos y modernos. Corte wet, texturizado, capas y acabado perfecto. El curso favorito de barberos que buscan diferenciarse con técnica de tijera premium.', 'Carlos Ibarra', 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80', 149.00, $3, 'Trending', 9, '3h 10m', false, true),
          ('Colorimetría Masculina', 'Decoloración, matizado y coloración en cabello masculino. Aprende las bases del color, corrección de tono y las técnicas más demandadas en barberias premium: babylights, bleach & tone y gris platinado.', 'Valentina Cruz', 'https://images.unsplash.com/photo-1512690459411-b9245aed614d?w=800&q=80', 179.00, $4, 'Nuevo', 11, '4h 20m', false, true),
          ('Gestión de Barbería Exitosa', 'Transforma tu barbería en un negocio rentable. Precios, redes sociales, fidelización de clientes, gestión del tiempo y cómo armar un equipo de trabajo. Para barberos que quieren crecer más allá del sillón.', 'Diego Pereira', 'https://images.unsplash.com/photo-1600948836101-f9ffda59d250?w=800&q=80', null, $5, 'Exclusivo Miembros', 14, '5h 30m', true, true),
          ('Styling y Acabados Masculinos', 'Productos, técnicas de secado y acabados profesionales para el cabello masculino. Desde el look natural hasta el peinado de red carpet. Aprende a recomendar y aplicar productos como un experto.', 'Tomás Ríos', 'https://images.unsplash.com/photo-1596728325488-58c87691e9af?w=800&q=80', 129.00, $1, null, 7, '2h 15m', false, true)
      ], [cats['fade'], cats['beard'], cats['clasico'], cats['colorimetria'], cats['negocio']]);

      const coursesResult = await client.query('SELECT id, title FROM courses LIMIT 6');
      for (const course of coursesResult.rows) {
        await client.query(`
          INSERT INTO lessons (course_id, title, description, duration, order_index, section_number, section_title, lesson_type)
          VALUES
            ($1, 'Introducción y materiales', 'Bienvenida al curso. Herramientas necesarias y preparación del puesto de trabajo.', '08 MIN', 1, 1, 'Fundamentos', 'video'),
            ($1, 'Análisis del cliente', 'Cómo leer la morfología del rostro y recomendar el corte ideal.', '12 MIN', 2, 1, 'Fundamentos', 'video'),
            ($1, 'Técnica principal - Parte 1', 'Desarrollo paso a paso de la técnica central del curso.', '22 MIN', 1, 2, 'Técnica', 'video'),
            ($1, 'Técnica principal - Parte 2', 'Aplicación avanzada y refinamiento de la técnica.', '28 MIN', 2, 2, 'Técnica', 'video'),
            ($1, 'Control de conocimiento', 'Evaluación de los conceptos aprendidos hasta el momento.', '5 PREGUNTAS', 3, 2, 'Técnica', 'quiz'),
            ($1, 'Acabados y presentación final', 'Técnicas de acabado profesional y presentación del resultado.', '18 MIN', 1, 3, 'Acabados', 'video')
          ON CONFLICT DO NOTHING
        `, [course.id]);

        await client.query(
          'UPDATE courses SET total_lessons = (SELECT COUNT(*) FROM lessons WHERE course_id = $1) WHERE id = $1',
          [course.id]
        );
      }

      console.log('Database seeded successfully!');
      console.log('');
      console.log('Credenciales:');
      console.log('  Admin: admin@atenea.com / Admin123!');
      console.log('  User:  user@atenea.com  / User123!');
    } finally {
      client.release();
      await pool.end();
    }
  }

  seed().catch(console.error);
  ```

- [ ] **Paso 2: Reemplazar database/seed.ts**

  El archivo `database/seed.ts` es idéntico al anterior pero con la ruta del .env distinta. Reemplazar su contenido completo con:

  ```typescript
  import bcrypt from 'bcryptjs';
  import { Pool } from 'pg';
  import dotenv from 'dotenv';
  import path from 'path';

  dotenv.config({ path: path.join(__dirname, '../backend/.env') });

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://lumiere:lumiere_pass@localhost:5432/lumiere_academy',
  });

  async function seed() {
    const client = await pool.connect();
    try {
      console.log('Seeding database...');

      const adminHash = await bcrypt.hash('Admin123!', 12);
      const userHash = await bcrypt.hash('User123!', 12);

      await client.query(`
        INSERT INTO users (email, password_hash, name, role) VALUES
          ('admin@atenea.com', $1, 'Atenea Admin', 'admin'),
          ('user@atenea.com', $2, 'Usuario Demo', 'user')
        ON CONFLICT (email) DO NOTHING
      `, [adminHash, userHash]);

      const catResult = await client.query('SELECT id, slug FROM categories');
      const cats: Record<string, string> = {};
      catResult.rows.forEach((r: { slug: string; id: string }) => { cats[r.slug] = r.id; });

      await client.query(`
        INSERT INTO courses (title, description, instructor_name, thumbnail_url, price, category_id, badge, total_lessons, total_duration, is_membership_exclusive, is_published)
        VALUES
          ('El Arte del Fade Perfecto', 'Domina todas las variaciones del fade desde cero hasta el nivel más avanzado. Técnicas de transición suave, skin fade y high fade explicadas paso a paso por un maestro barbero con más de 10 años de experiencia en competencias internacionales.', 'Marcos Delgado', 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=80', 199.00, $1, 'Masterclass', 10, '3h 45m', false, true),
          ('Diseño y Perfilado de Barba', 'Aprende a diseñar, perfilar y dar forma a cualquier tipo de barba. Desde barba corta de oficina hasta full beard artística. Incluye técnica de navaja para líneas perfectas y mantenimiento profesional.', 'Rodrigo Fuentes', 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&q=80', null, $2, 'Exclusivo Miembros', 8, '2h 50m', true, true),
          ('Corte Clásico con Tijera', 'Técnicas de tijera para cortes masculinos clásicos y modernos. Corte wet, texturizado, capas y acabado perfecto. El curso favorito de barberos que buscan diferenciarse con técnica de tijera premium.', 'Carlos Ibarra', 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80', 149.00, $3, 'Trending', 9, '3h 10m', false, true),
          ('Colorimetría Masculina', 'Decoloración, matizado y coloración en cabello masculino. Aprende las bases del color, corrección de tono y las técnicas más demandadas en barberias premium: babylights, bleach & tone y gris platinado.', 'Valentina Cruz', 'https://images.unsplash.com/photo-1512690459411-b9245aed614d?w=800&q=80', 179.00, $4, 'Nuevo', 11, '4h 20m', false, true),
          ('Gestión de Barbería Exitosa', 'Transforma tu barbería en un negocio rentable. Precios, redes sociales, fidelización de clientes, gestión del tiempo y cómo armar un equipo de trabajo. Para barberos que quieren crecer más allá del sillón.', 'Diego Pereira', 'https://images.unsplash.com/photo-1600948836101-f9ffda59d250?w=800&q=80', null, $5, 'Exclusivo Miembros', 14, '5h 30m', true, true),
          ('Styling y Acabados Masculinos', 'Productos, técnicas de secado y acabados profesionales para el cabello masculino. Desde el look natural hasta el peinado de red carpet. Aprende a recomendar y aplicar productos como un experto.', 'Tomás Ríos', 'https://images.unsplash.com/photo-1596728325488-58c87691e9af?w=800&q=80', 129.00, $1, null, 7, '2h 15m', false, true)
      `, [cats['fade'], cats['beard'], cats['clasico'], cats['colorimetria'], cats['negocio']]);

      const coursesResult = await client.query('SELECT id, title FROM courses LIMIT 6');
      for (const course of coursesResult.rows) {
        await client.query(`
          INSERT INTO lessons (course_id, title, description, duration, order_index, section_number, section_title, lesson_type)
          VALUES
            ($1, 'Introducción y materiales', 'Bienvenida al curso. Herramientas necesarias y preparación del puesto de trabajo.', '08 MIN', 1, 1, 'Fundamentos', 'video'),
            ($1, 'Análisis del cliente', 'Cómo leer la morfología del rostro y recomendar el corte ideal.', '12 MIN', 2, 1, 'Fundamentos', 'video'),
            ($1, 'Técnica principal - Parte 1', 'Desarrollo paso a paso de la técnica central del curso.', '22 MIN', 1, 2, 'Técnica', 'video'),
            ($1, 'Técnica principal - Parte 2', 'Aplicación avanzada y refinamiento de la técnica.', '28 MIN', 2, 2, 'Técnica', 'video'),
            ($1, 'Control de conocimiento', 'Evaluación de los conceptos aprendidos hasta el momento.', '5 PREGUNTAS', 3, 2, 'Técnica', 'quiz'),
            ($1, 'Acabados y presentación final', 'Técnicas de acabado profesional y presentación del resultado.', '18 MIN', 1, 3, 'Acabados', 'video')
          ON CONFLICT DO NOTHING
        `, [course.id]);

        await client.query(
          'UPDATE courses SET total_lessons = (SELECT COUNT(*) FROM lessons WHERE course_id = $1) WHERE id = $1',
          [course.id]
        );
      }

      console.log('Database seeded successfully!');
      console.log('');
      console.log('Credenciales:');
      console.log('  Admin: admin@atenea.com / Admin123!');
      console.log('  User:  user@atenea.com  / User123!');
    } finally {
      client.release();
      await pool.end();
    }
  }

  seed().catch(console.error);
  ```

- [ ] **Paso 3: Commit**

  ```bash
  git add backend/src/seed.ts database/seed.ts
  git commit -m "feat(seed): barbershop courses and Atenea branding in seed data"
  ```

---

## Task 4: Actualizar HTML — título y fuentes

**Archivos:**
- Modificar: `frontend/index.html`

- [ ] **Paso 1: Reemplazar frontend/index.html**

  ```html
  <!DOCTYPE html>
  <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Atenea Courses</title>
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Montserrat:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />
    </head>
    <body>
      <div id="root"></div>
      <script type="module" src="/src/main.tsx"></script>
    </body>
  </html>
  ```

- [ ] **Paso 2: Commit**

  ```bash
  git add frontend/index.html
  git commit -m "feat(frontend): update title to Atenea Courses, add Montserrat font"
  ```

---

## Task 5: Actualizar variables CSS — gold + Montserrat + dark optimizado

**Archivos:**
- Modificar: `frontend/src/styles/variables.css`

- [ ] **Paso 1: Reemplazar variables.css**

  ```css
  /* ===========================
     LIGHT MODE DESIGN TOKENS
     =========================== */
  :root {
    --color-primary: #8B6914;
    --color-primary-container: #C9A96E;
    --color-primary-fixed: #F0D9B0;
    --color-primary-fixed-dim: #D4B87A;
    --color-on-primary: #ffffff;
    --color-on-primary-container: #3E2A00;

    --color-secondary: #6B5B45;
    --color-secondary-container: #C8B89A;
    --color-on-secondary: #ffffff;
    --color-on-secondary-container: #3A2E1E;

    --color-background: #FAF8F4;
    --color-on-background: #1A1A1A;

    --color-surface: #FAF8F4;
    --color-surface-dim: #DDD9D1;
    --color-surface-variant: #E8E3D8;
    --color-surface-container: #F0EDE5;
    --color-surface-container-low: #F6F3EE;
    --color-surface-container-high: #E8E3D8;
    --color-surface-container-highest: #E0DBD0;
    --color-surface-container-lowest: #FFFFFF;
    --color-on-surface: #1A1A1A;
    --color-on-surface-variant: #4A4035;

    --color-outline: #7A6E5E;
    --color-outline-variant: #CEC4B0;

    --color-error: #ba1a1a;
    --color-error-container: #ffdad6;
    --color-on-error: #ffffff;

    --color-success: #386a20;
    --color-success-container: #b7f397;

    /* Spacing */
    --spacing-unit: 8px;
    --spacing-gutter: 32px;
    --spacing-margin-mobile: 20px;
    --spacing-margin-desktop: 64px;
    --spacing-section-padding: 120px;
    --container-max-width: 1280px;
    --navbar-height: 80px;

    /* Border Radius */
    --radius-sm: 0.25rem;
    --radius-md: 0.5rem;
    --radius-lg: 0.75rem;
    --radius-full: 9999px;

    /* Font Families */
    --font-display: 'Playfair Display', Georgia, serif;
    --font-body: 'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif;

    /* Font Sizes */
    --text-display-lg: 64px;
    --text-display-mobile: 40px;
    --text-headline-xl: 48px;
    --text-headline-md: 32px;
    --text-headline-sm: 24px;
    --text-body-lg: 18px;
    --text-body-md: 16px;
    --text-label-caps: 12px;
    --text-label-md: 14px;

    /* Transitions */
    --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
    --transition-normal: 300ms cubic-bezier(0.4, 0, 0.2, 1);
    --transition-slow: 700ms cubic-bezier(0.4, 0, 0.2, 1);
    --transition-fluid: 500ms cubic-bezier(0.4, 0, 0.2, 1);

    /* Shadows */
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05);
    --shadow-md: 0 4px 16px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06);
    --shadow-lg: 0 8px 32px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.08);
    --shadow-xl: 0 16px 64px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.10);
    --shadow-glow: 0 0 40px rgba(201, 169, 110, 0.25);

    /* Glass */
    --glass-bg: rgba(255, 255, 255, 0.82);
    --glass-border: rgba(139, 105, 20, 0.12);
    --glass-saturate: 180%;
    --nav-bg: rgba(250, 248, 244, 0.92);
  }

  /* ===========================
     DARK MODE DESIGN TOKENS
     =========================== */
  html.dark {
    --color-primary: #C9A96E;
    --color-primary-container: #A07A40;
    --color-primary-fixed: #E8D0A0;
    --color-primary-fixed-dim: #D4B87A;
    --color-on-primary: #1A0F00;
    --color-on-primary-container: #F0E0C0;

    --color-secondary: #C0B8A8;
    --color-secondary-container: #3A3428;
    --color-on-secondary: #1A1610;
    --color-on-secondary-container: #B0A890;

    --color-background: #0A0A0A;
    --color-on-background: #F0EDE8;

    --color-surface: #0A0A0A;
    --color-surface-dim: #0A0A0A;
    --color-surface-variant: #2A2620;
    --color-surface-container: #141210;
    --color-surface-container-low: #111008;
    --color-surface-container-high: #201E18;
    --color-surface-container-highest: #2A2620;
    --color-surface-container-lowest: #050404;
    --color-on-surface: #F0EDE8;
    --color-on-surface-variant: #C8B898;

    --color-outline: #8A7A5A;
    --color-outline-variant: #3A3020;

    --color-error: #ffb4ab;
    --color-error-container: #93000a;
    --color-on-error: #690005;

    --color-success: #7ddb58;
    --color-success-container: #1a4407;

    --shadow-sm: 0 1px 3px rgba(0,0,0,0.4);
    --shadow-md: 0 4px 16px rgba(0,0,0,0.5);
    --shadow-lg: 0 8px 32px rgba(0,0,0,0.6);
    --shadow-xl: 0 16px 64px rgba(0,0,0,0.7);
    --shadow-glow: 0 0 40px rgba(201, 169, 110, 0.18);

    --glass-bg: rgba(20, 18, 16, 0.90);
    --glass-border: rgba(201, 169, 110, 0.18);
    --nav-bg: rgba(5, 4, 4, 0.95);
  }
  ```

- [ ] **Paso 2: Commit**

  ```bash
  git add frontend/src/styles/variables.css
  git commit -m "feat(ui): dark premium theme with gold #C9A96E and Montserrat font"
  ```

---

## Task 6: ThemeContext — default dark

**Archivos:**
- Modificar: `frontend/src/contexts/ThemeContext.tsx`

- [ ] **Paso 1: Cambiar default a dark y renombrar localStorage key**

  Reemplazar el contenido de `frontend/src/contexts/ThemeContext.tsx`:

  ```typescript
  import React, { createContext, useContext, useState, useEffect } from 'react';

  type Theme = 'light' | 'dark';

  interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
  }

  const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

  export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>(() => {
      const saved = localStorage.getItem('atenea-theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return 'dark';
    });

    useEffect(() => {
      const root = document.documentElement;
      root.classList.toggle('dark', theme === 'dark');
      root.classList.toggle('light', theme !== 'dark');
      localStorage.setItem('atenea-theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

    return (
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        {children}
      </ThemeContext.Provider>
    );
  };

  export const useTheme = (): ThemeContextType => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
  };
  ```

- [ ] **Paso 2: Commit**

  ```bash
  git add frontend/src/contexts/ThemeContext.tsx
  git commit -m "feat(ui): default dark theme, rename localStorage key to atenea-theme"
  ```

---

## Task 7: Navbar — branding Atenea Courses

**Archivos:**
- Modificar: `frontend/src/components/layout/Navbar/Navbar.tsx` (solo línea 50)

- [ ] **Paso 1: Cambiar el logo en la navbar**

  En `frontend/src/components/layout/Navbar/Navbar.tsx`, en la línea:
  ```tsx
  <NavLink to="/" className="navbar-logo">Lumière Academy</NavLink>
  ```
  Cambiar a:
  ```tsx
  <NavLink to="/" className="navbar-logo">Atenea Courses</NavLink>
  ```

- [ ] **Paso 2: Commit**

  ```bash
  git add frontend/src/components/layout/Navbar/Navbar.tsx
  git commit -m "feat(ui): rebrand navbar to Atenea Courses"
  ```

---

## Task 8: Footer — branding + tagline barbería

**Archivos:**
- Modificar: `frontend/src/components/layout/Footer/Footer.tsx`

- [ ] **Paso 1: Actualizar footer con branding barbería**

  Reemplazar el contenido de `frontend/src/components/layout/Footer/Footer.tsx`:

  ```tsx
  import React from 'react';
  import { Link } from 'react-router-dom';
  import './Footer.css';

  const Footer: React.FC = () => (
    <footer className="footer">
      <div className="footer-main">
        <div className="footer-top">
          <div className="footer-brand">
            <Link to="/" className="footer-logo">Atenea Courses</Link>
            <p className="footer-tagline">
              La plataforma de educación premium para barberos profesionales. Técnica, arte y negocio en un solo lugar.
            </p>
            <div className="footer-socials">
              <button className="footer-social-btn" title="Web">
                <span className="material-symbols-outlined">public</span>
              </button>
              <button className="footer-social-btn" title="Instagram">
                <span className="material-symbols-outlined">photo_camera</span>
              </button>
              <button className="footer-social-btn" title="YouTube">
                <span className="material-symbols-outlined">movie</span>
              </button>
            </div>
          </div>

          <div className="footer-links">
            <div className="footer-col">
              <span className="footer-col-title">Explorar</span>
              <Link to="/explorer">Cursos</Link>
              <Link to="/explorer">Instructores</Link>
              <Link to="#">Tarjetas de regalo</Link>
            </div>
            <div className="footer-col">
              <span className="footer-col-title">Academia</span>
              <Link to="#">Sobre nosotros</Link>
              <Link to="#">Trabaja con nosotros</Link>
              <Link to="#">Prensa</Link>
            </div>
            <div className="footer-col">
              <span className="footer-col-title">Soporte</span>
              <Link to="#">Política de privacidad</Link>
              <Link to="#">Términos de servicio</Link>
              <Link to="#">Contactar soporte</Link>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copy">© {new Date().getFullYear()} Atenea Courses. Todos los derechos reservados.</p>
          <div className="footer-bottom-links">
            <Link to="#">Instagram</Link>
            <Link to="#">YouTube</Link>
            <Link to="#">TikTok</Link>
          </div>
        </div>
      </div>
    </footer>
  );

  export default Footer;
  ```

- [ ] **Paso 2: Commit**

  ```bash
  git add frontend/src/components/layout/Footer/Footer.tsx
  git commit -m "feat(ui): rebrand footer to Atenea Courses with barbershop tagline"
  ```

---

## Task 9: Home page — contenido barbería

**Archivos:**
- Modificar: `frontend/src/pages/Home/Home.tsx`

- [ ] **Paso 1: Actualizar Home.tsx con hero y stats de barbería**

  Reemplazar el contenido completo de `frontend/src/pages/Home/Home.tsx`:

  ```tsx
  import React, { useEffect, useState } from 'react';
  import { Link, useNavigate } from 'react-router-dom';
  import api from '../../services/api';
  import { Course } from '../../types';
  import './Home.css';
  import '../Membership/Membership.css';

  const HERO_IMG = 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=1600&q=80';

  const Home: React.FC = () => {
    const [courses, setCourses] = useState<Course[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
      api.get<Course[]>('/courses?sort=newest').then(r => setCourses(r.data.slice(0, 3)));
    }, []);

    const [large, ...rest] = courses;

    return (
      <div className="home">
        {/* ── Hero ── */}
        <section className="hero">
          <div className="hero-bg">
            <img src={HERO_IMG} alt="Barbero profesional trabajando" />
            <div className="hero-bg-overlay" />
          </div>
          <div className="hero-content">
            <span className="hero-eyebrow">Técnica • Arte • Negocio</span>
            <h1 className="hero-title">
              Lleva tu barbería al siguiente nivel.
            </h1>
            <p className="hero-subtitle">
              Accedé a masterclasses exclusivas de los mejores barberos del mundo. Técnicas de fade, barba, colorimetría y gestión de negocio para barberos que quieren crecer.
            </p>
            <div className="hero-cta">
              <button className="btn-primary" onClick={() => navigate('/explorer')}>
                Ver Cursos
              </button>
              <button className="btn-outline" onClick={() => navigate('/membership')}>
                Explorar Membresía
              </button>
            </div>
          </div>
        </section>

        {/* ── Stats ── */}
        <div className="stats">
          {[
            { number: '60+', label: 'Lecciones en Video' },
            { number: '6', label: 'Cursos Especializados' },
            { number: '500+', label: 'Barberos Formados' },
            { number: '98%', label: 'Satisfacción' },
          ].map(s => (
            <div key={s.label} className="stat-item">
              <span className="stat-number">{s.number}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* ── Featured Courses ── */}
        {courses.length > 0 && (
          <section className="featured">
            <div className="section-header">
              <div>
                <span className="section-eyebrow">Currículo Curado</span>
                <h2 className="section-title">Domina los Fundamentos</h2>
              </div>
              <Link to="/explorer" className="section-link">Ver todos los cursos</Link>
            </div>

            <div className="featured-grid">
              {large && (
                <div className="featured-large" onClick={() => navigate(`/courses/${large.id}`)}>
                  <div className="featured-large-image">
                    <img src={large.thumbnail_url} alt={large.title} />
                    <div className="featured-large-overlay" />
                    <div className="featured-large-body">
                      {large.badge && (
                        <span className="featured-large-badge">{large.badge}</span>
                      )}
                      <h3 className="featured-large-title">{large.title}</h3>
                      <p className="featured-large-desc">{large.description?.slice(0, 120)}...</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="featured-secondary">
                {rest.map(c => (
                  <div key={c.id} className="secondary-card" onClick={() => navigate(`/courses/${c.id}`)}>
                    <div className="secondary-card-image">
                      <img src={c.thumbnail_url} alt={c.title} />
                      <div className="secondary-card-overlay" />
                      <div className="secondary-card-body">
                        <h4 className="secondary-card-title">{c.title}</h4>
                        <p className="secondary-card-desc">{c.description?.slice(0, 80)}...</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Membership ── */}
        <section className="home-membership">
          <div className="membership-header">
            <span className="membership-eyebrow">Invertí en tu carrera</span>
            <h2 className="membership-title">Elegí tu plan</h2>
            <p className="membership-subtitle">
              Rutas de aprendizaje flexibles diseñadas para barberos que quieren crecer a su propio ritmo.
            </p>
          </div>
          <div className="membership-plans">
            <div className="plan-card glass-card">
              <div className="plan-icon-wrap primary">
                <span className="material-symbols-outlined plan-icon primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  auto_awesome
                </span>
              </div>
              <h2 className="plan-name">Suscripción Mensual</h2>
              <p className="plan-desc">
                Acceso ilimitado a todos los cursos, recursos y contenido nuevo que se agregue cada mes.
              </p>
              <div className="plan-price">
                <span className="plan-price-amount">$49</span>
                <span className="plan-price-period"> / mes</span>
              </div>
              <ul className="plan-features">
                {[
                  'Acceso a todos los cursos',
                  'Nuevos cursos cada mes',
                  'Acceso al foro de la comunidad',
                  'Certificado de finalización',
                  'Soporte prioritario',
                ].map(f => (
                  <li key={f} className="plan-feature">
                    <span className="material-symbols-outlined plan-feature-icon" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button className="plan-btn-primary" onClick={() => navigate('/membership')}>
                Comenzar ahora
              </button>
            </div>

            <div className="plan-card glass-card">
              <div className="plan-icon-wrap secondary">
                <span className="material-symbols-outlined plan-icon secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  local_library
                </span>
              </div>
              <h2 className="plan-name">Curso Individual</h2>
              <p className="plan-desc">
                Comprá el curso que necesitás y tenés acceso de por vida. Ideal para habilidades específicas.
              </p>
              <div className="plan-price">
                <span className="plan-price-from">Desde</span>
                <span className="plan-price-amount">$129</span>
              </div>
              <ul className="plan-features">
                {[
                  'Acceso de por vida al curso',
                  'Videos en alta definición',
                  'Material complementario',
                  'Acceso desde cualquier dispositivo',
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
        </section>
      </div>
    );
  };

  export default Home;
  ```

- [ ] **Paso 2: Commit**

  ```bash
  git add frontend/src/pages/Home/Home.tsx
  git commit -m "feat(ui): adapt home page hero and content to barbershop"
  ```

---

## Task 10: CourseDetail — traducir strings en inglés

**Archivos:**
- Modificar: `frontend/src/pages/CourseDetail/CourseDetail.tsx`

- [ ] **Paso 1: Traducir los 3 objetivos hardcodeados en inglés (líneas ~179-184)**

  En `frontend/src/pages/CourseDetail/CourseDetail.tsx`, reemplazar el array de objetivos:

  ```tsx
  // Viejo:
  {[
    'Domina la técnica profesional con guía paso a paso de expertos de la industria.',
    'Comprende los principios fundamentales de cada método para una retención de habilidades duradera.',
    'Refina tu trabajo con técnicas de acabado editorial para un resultado pulido y profesional.',
  ].map((obj, i) => (
  ```

  Con:

  ```tsx
  {[
    'Dominá la técnica profesional con guía paso a paso de expertos del sector.',
    'Comprendé los fundamentos de cada método para que el aprendizaje sea duradero y aplicable.',
    'Perfeccioná tu trabajo con técnicas de acabado que marcan la diferencia en el resultado final.',
  ].map((obj, i) => (
  ```

- [ ] **Paso 2: Traducir la bio del instructor hardcodeada (~línea 198)**

  Reemplazar:
  ```tsx
  <p className="educator-bio">
    Estilista premiada con más de 15 años de experiencia editorial y de sesión, especializada en técnica de precisión.
  </p>
  ```

  Con:
  ```tsx
  <p className="educator-bio">
    Barbero premiado con más de 10 años de experiencia en competencias internacionales, especializado en técnica de precisión y formación profesional.
  </p>
  ```

- [ ] **Paso 3: Commit**

  ```bash
  git add frontend/src/pages/CourseDetail/CourseDetail.tsx
  git commit -m "feat(ui): translate hardcoded English strings in CourseDetail"
  ```

---

## Task 11: Build y verificación Docker

- [ ] **Paso 1: Limpiar volumes de postgres (si ya existe de runs anteriores)**

  Si el contenedor de postgres ya existía con las categorías viejas, hay que bajar todo y eliminar el volume:

  ```bash
  docker compose down -v
  ```

  Esto elimina los volumes persistidos (base de datos) para que postgres re-ejecute el schema con las categorías nuevas.

- [ ] **Paso 2: Levantar todo**

  ```bash
  docker compose up --build
  ```

  Esperar a ver en los logs:
  - `lumiere-db` → `database system is ready to accept connections`
  - `atenea-seed` → `Database seeded successfully!` seguido de las credenciales
  - `lumiere-backend` → escuchando en puerto 3000
  - `lumiere-frontend` → nginx arriba

- [ ] **Paso 3: Verificar en http://localhost**

  - [ ] Abre http://localhost → debe verse la home de Atenea Courses en dark mode con hero de barbería
  - [ ] Navegar a `/explorer` → deben verse los 6 cursos de barbería con imágenes de Unsplash
  - [ ] Hacer login con `admin@atenea.com` / `Admin123!` → debe funcionar y mostrar "Panel de Admin" en el dropdown
  - [ ] Ir a `/admin` → debe mostrar el dashboard con estadísticas (6 cursos, 2 usuarios)
  - [ ] Hacer logout y login con `user@atenea.com` / `User123!`
  - [ ] Intentar abrir un curso → debe mostrar el lock overlay (sin suscripción)

- [ ] **Paso 4: Verificar protección de video**

  Con el usuario logueado sin suscripción:
  - Abrir DevTools → Network → abrir detalle de un curso
  - Verificar que la respuesta JSON del endpoint `/api/courses/{id}` tiene `"video_url": null` en todas las lecciones
  - Verificar que no hay URLs de YouTube visibles en ninguna respuesta de la API

- [ ] **Paso 5: Commit final**

  ```bash
  git add .
  git commit -m "chore: verified docker build and demo credentials working"
  ```

---

## Credenciales para la demo

| Rol | Email | Contraseña |
|-----|-------|------------|
| Admin | admin@atenea.com | Admin123! |
| Usuario | user@atenea.com | User123! |

```bash
# Levantar para demo:
docker compose down -v && docker compose up --build

# Acceder en:
http://localhost
```
