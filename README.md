# Lumière Academy

Premium hairdressing education platform built with React + TypeScript + Node.js + PostgreSQL.

## Default Credentials

| Role  | Email                  | Password   |
|-------|------------------------|------------|
| Admin | admin@lumiere.com      | Admin123!  |
| User  | user@lumiere.com       | User123!   |

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, React Router v6, CSS custom properties
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL 16
- **Server**: Nginx
- **Auth**: JWT (7-day tokens)

## Quick Start (Development)

### 1. Start PostgreSQL
```bash
# With Docker
docker run -d --name lumiere-db \
  -e POSTGRES_DB=lumiere_academy \
  -e POSTGRES_USER=lumiere \
  -e POSTGRES_PASSWORD=lumiere_pass \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. Initialize Database
```bash
psql postgres://lumiere:lumiere_pass@localhost:5432/lumiere_academy -f database/schema.sql
```

### 3. Seed Database (creates default users + sample courses)
```bash
cd backend
npm install
npm run seed
```

### 4. Start Backend
```bash
cd backend
cp ../.env.example .env   # already created
npm run dev               # runs on http://localhost:3000
```

### 5. Start Frontend
```bash
cd frontend
npm install
npm run dev               # runs on http://localhost:5173
```

## Production (Docker Compose)

```bash
docker-compose up --build
# Access at http://localhost
```

## Project Structure

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
│   │   └── types/               # TypeScript interfaces
│   └── Dockerfile
├── backend/                     # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── config/              # database, multer
│   │   ├── controllers/         # auth, courses, admin
│   │   ├── middleware/          # auth (JWT), error handler
│   │   ├── routes/              # auth, courses, admin
│   │   └── types/
│   └── Dockerfile
├── database/
│   ├── schema.sql               # Tables + indexes
│   └── seed.ts                  # Sample data + default users
├── nginx/
│   └── nginx.conf
└── docker-compose.yml
```

## Features

### Student
- Browse and search courses
- Filter by category (Cut, Color, Styling, Bridal, Business)
- Monthly subscription ($49/month) or individual purchase
- Video player with curriculum sidebar
- Progress tracking

### Admin
- Dashboard with key stats (users, courses, subscriptions, revenue)
- Full course CRUD (title, description, instructor, category, price, thumbnail)
- Lesson management per course (add/edit/delete, video upload)
- User management with subscription status
- Publish/draft system for courses

### Design
- Light/Dark mode toggle (persisted in localStorage)
- Responsive (mobile + desktop)
- Glass morphism cards
- Grayscale → color image hover effect
- Playfair Display (headings) + Inter (body)
- Material Symbols icons
