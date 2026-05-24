# Atenea Courses — Demo Launch Design
**Fecha:** 2026-05-24

## Objetivo

Dejar el sistema funcionando vía Docker Compose con branding de barbería premium (dark + dorado) para demo con el cliente el 2026-05-25.

## Arquitectura (sin cambios)

- **Frontend**: React 18 + TypeScript + Vite, servido por Nginx en container
- **Backend**: Node.js + Express + TypeScript, compilado a JS
- **DB**: PostgreSQL 16 con schema y seed automáticos
- **Proxy**: Nginx reverso en puerto 80 → frontend:80 y backend:3000
- **4 servicios Docker**: postgres, backend, frontend, nginx  
- **+1 servicio nuevo**: seed (corre una vez, luego sale)

## Fix Docker — Servicio Seed (Opción B)

**Problema**: `docker-compose up` levanta la DB y aplica el schema, pero no crea usuarios ni cursos de ejemplo. La app arranca vacía.

**Solución**: Agregar un quinto servicio `seed` al `docker-compose.yml`:

```yaml
seed:
  image: node:20-alpine
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

El servicio usa `ts-node` para ejecutar el seed existente (`backend/src/seed.ts`) directamente, sin necesitar compilar. Corre una vez y sale (exit 0). Los datos son idempotentes (`ON CONFLICT DO NOTHING`), por lo que re-ejecutar es seguro.

## Cambios de Contenido del Seed

Actualizar `backend/src/seed.ts` (y el duplicado `database/seed.ts`) con:
- Nombre de admin: "Atenea Admin"
- Emails: admin@atenea.com / user@atenea.com
- 6 cursos de barbería en español con descripciones realistas
- Categorías adaptadas al mundo barbería

## Cambios Visuales

### 1. Branding
- Reemplazar "Lumière Academy" / "Lumiere" → **"Atenea Courses"** en todo el frontend
- Actualizar `<title>` en `frontend/index.html`

### 2. Tema Dark como Default
- En `ThemeContext.tsx`: cambiar el valor inicial de `theme` a `'dark'` en lugar de leer `localStorage` con fallback a `'light'`
- El usuario puede seguir toggling, pero arranca en dark

### 3. Variables CSS — Dark + Gold
Actualizar `frontend/src/styles/variables.css`:
- Color primario: `#C9A96E` (dorado)
- Fondos dark: `#0A0A0A`, `#111111`, `#1A1A1A`
- Surface containers más oscuros
- Remover dependencia de `color-mix` en valores críticos para compatibilidad

### 4. Tipografía
- Actualizar `frontend/index.html` Google Fonts import: agregar **Montserrat** (body), mantener **Playfair Display** (headings)
- Actualizar `variables.css` para usar Montserrat como fuente body en lugar de Inter

### 5. Categorías Barbería
Actualizar `database/schema.sql` INSERT de categories:
- Fade
- Beard (Barba)
- Corte Clásico
- Colorimetría
- Negocio

### 6. Textos
- Revisar strings en inglés que quedaron (principalmente en CourseDetail.tsx — learning objectives, educator bio) y traducirlos

## Protección de Video (ya implementada — sin cambios)

La protección actual es correcta y suficiente para el cliente:
- URLs de YouTube **nunca se envían** al frontend si el usuario no tiene acceso (lógica en `courseController.ts:getCourseById`)
- El embed usa `youtube-nocookie.com` que reduce tracking
- El overlay CSS `yt-overlay-title` y `yt-overlay-logo` ocultan elementos de la UI de YouTube

**Limitación conocida**: Un usuario con suscripción activa puede inspeccionar el DOM o las peticiones de red y ver la URL de YouTube. Esto es inherente a cualquier embed de YouTube. Para mayor protección en el futuro se podría implementar un proxy de video, pero para la demo es aceptable.

## Credenciales para la Demo

| Rol | Email | Password |
|-----|-------|----------|
| Admin | admin@atenea.com | Admin123! |
| Usuario | user@atenea.com | User123! |

## Comando para Levantar

```bash
docker-compose up --build
# Acceder en http://localhost
```

El servicio `seed` corre ~45 segundos después que postgres está listo. Los cursos aparecen una vez que el seed termina.
