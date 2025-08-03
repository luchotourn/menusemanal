# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development server (runs both frontend and backend)
npm run dev

# Production build and deployment
npm run build
npm start

# Database operations
npm run db:push    # Push schema changes to database

# Type checking
npm run check
```

## Project Architecture

**Menu Familiar** is a full-stack PWA for family meal planning built with a monorepo structure:

### Core Structure
- `client/` - React 18 + TypeScript frontend with Vite
- `server/` - Express.js API backend
- `shared/` - Shared TypeScript types and database schema
- `attached_assets/` - Static assets and screenshots

### Tech Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui components, Wouter routing, TanStack Query
- **Backend**: Express.js, Drizzle ORM, PostgreSQL (Neon Serverless)
- **Database**: PostgreSQL with two main tables: `recipes` and `meal_plans`
- **Deployment**: Replit-optimized with custom Vite plugins

### Key Architecture Patterns

**Database Layer**: 
- Schema defined in `shared/schema.ts` using Drizzle ORM
- Storage abstraction in `server/storage.ts` with interface `IStorage`
- Database connection in `server/db.ts`

**API Structure**:
- RESTful endpoints in `server/routes.ts`:
  - `/api/recipes` - CRUD operations with search, category filtering, favorites
  - `/api/meal-plans` - Weekly meal planning with date-based queries
- Zod validation using schemas from `shared/schema.ts`
- Error handling with Spanish localized messages

**Frontend Architecture**:
- Component-based with shadcn/ui component library
- State management via TanStack Query for server state
- Mobile-first responsive design with bottom navigation
- Path aliases: `@/` for client/src, `@shared/` for shared

### Database Schema
- `recipes`: nombre, descripcion, imagen, categoria, calificacionNinos (0-5 stars), ingredientes (array), instrucciones, tiempoPreparacion, porciones, esFavorita
- `meal_plans`: fecha (YYYY-MM-DD), recetaId (FK), tipoComida (almuerzo/cena), notas

### Environment Setup
- Requires `DATABASE_URL` environment variable
- Development server runs on port 5000
- Vite dev server integrated for development
- Production serves static files from `dist/public`

### Key Features
- Recipe CRUD with categories, kid ratings, and favorites
- Weekly calendar meal planning with drag-and-drop
- Search and filtering across recipes
- Spanish-localized UI and error messages
- PWA capabilities with offline support