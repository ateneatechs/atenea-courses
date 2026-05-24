# Atenea Courses

Plataforma premium de educación para barberos profesionales. Construida con React + TypeScript + Node.js + PostgreSQL.

## Credenciales por defecto

| Rol   | Email                  | Contraseña |
|-------|------------------------|------------|
| Admin | admin@atenea.com       | Admin123!  |
| User  | user@atenea.com        | User123!   |

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, React Router v6, CSS custom properties
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL 16
- **Server**: Nginx
- **Auth**: JWT (tokens de 7 días)

## Quick Start (Desarrollo local)

### 1. Levantar PostgreSQL con Docker

```bash
docker compose up postgres -d
```

### 2. Inicializar esquema de base de datos

El esquema se aplica automáticamente cuando postgres arranca (via `docker-entrypoint-initdb.d`).

### 3. Seedear la base de datos (usuarios + cursos de ejemplo)

```bash
cd backend
npm install
npm run seed
```

### 4. Levantar el backend

```bash
cd backend
npm run dev   # corre en http://localhost:3000
```

### 5. Levantar el frontend

```bash
cd frontend
npm install
npm run dev   # corre en http://localhost:5173
```

## Producción (Docker Compose)

```bash
docker compose up --build
# Acceder en http://localhost
```

> El servicio `seed` crea automáticamente los usuarios y cursos de ejemplo al primer arranque. Si ya existe una base de datos anterior, corré `docker compose down -v` antes para limpiar los volúmenes.

## Estructura del proyecto

```
atenea-courses/
├── frontend/                    # React + TypeScript
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/          # Navbar, Footer
│   │   │   ├── auth/            # LoginModal, RegisterModal
│   │   │   └── courses/         # CourseCard
│   │   ├── pages/
│   │   │   ├── Home/
│   │   │   ├── Explorer/
│   │   │   ├── CourseDetail/
│   │   │   ├── Membership/
│   │   │   └── Admin/
│   │   ├── contexts/            # AuthContext, ThemeContext
│   │   ├── services/            # api.ts (Axios)
│   │   ├── styles/              # variables.css, globals.css
│   │   └── types/               # Interfaces TypeScript
│   └── Dockerfile
├── backend/                     # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── config/              # database, multer
│   │   ├── controllers/         # auth, courses, admin
│   │   ├── middleware/          # auth (JWT)
│   │   ├── routes/              # auth, courses, admin
│   │   └── types/
│   └── Dockerfile
├── database/
│   ├── schema.sql               # Tablas + índices + categorías
│   └── seed.ts                  # Datos de ejemplo + usuarios por defecto
├── nginx/
│   └── nginx.conf
└── docker-compose.yml
```

## Features

### Estudiante
- Explorar y buscar cursos
- Filtrar por categoría (Fade, Barba, Corte Clásico, Colorimetría, Negocio)
- Suscripción mensual ($49/mes) o compra individual
- Reproductor de video con sidebar de contenido
- Seguimiento de progreso

### Admin
- Dashboard con estadísticas clave (usuarios, cursos, suscripciones, ingresos)
- CRUD completo de cursos (título, descripción, instructor, categoría, precio, miniatura)
- Gestión de lecciones por curso (agregar/editar/eliminar, URL de YouTube)
- Gestión de usuarios con estado de suscripción
- Sistema de publicación/borrador para cursos

### Protección de video
- Los URLs de YouTube **nunca se envían** al frontend si el usuario no tiene acceso (verificado en el backend)
- El embed usa `youtube-nocookie.com` para reducir tracking
- El admin carga los videos como **No listados** en YouTube — los usuarios no pueden acceder directamente

### Diseño
- Tema oscuro premium por defecto (toggle a modo claro)
- Responsive (mobile + desktop)
- Cards con glassmorphism
- Efecto hover escala de grises → color en imágenes
- Playfair Display (títulos) + Montserrat (cuerpo)
- Color primario dorado `#C9A96E`
- Íconos Material Symbols
