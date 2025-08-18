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
- Development server runs on port 3001
- Vite dev server integrated for development
- Production serves static files from `dist/public`

### Key Features
- Recipe CRUD with categories, kid ratings, and favorites
- Weekly calendar meal planning with drag-and-drop
- Search and filtering across recipes
- Spanish-localized UI and error messages
- PWA capabilities with offline support

## Developer Preferences

- **Commit Messages**: The user prefers to write their own commit messages. When ready to commit:
  1. Stage changes with `git add .`
  2. Show what's being committed with `git status` or `git diff --cached`
  3. Ask: "Ready to commit. What commit message would you like to use?"
  4. Wait for user's message before committing

- **Issue Resolution**: When resolving GitHub issues, always comment on the issue before closing it:
  1. Summarize what was implemented/fixed
  2. Mention any key technical decisions made
  3. Reference the commit(s) that resolved it
  4. Ask user to review and close if satisfied

- **Database Queries**: When asked to list database table contents, use this format:
  1. Use `DATABASE_URL=postgresql://neondb_owner:npg_5Mg0pPLNfshC@ep-old-heart-a6k4918t.us-west-2.aws.neon.tech/neondb?sslmode=require npx tsx -e` with database connection
  2. Format output concisely for terminal viewing - avoid overwhelming detail
  3. For recipes table: show numbered list with favorites (⭐), ratings (★☆), categories, and prep time
  4. Include summary of totals and favorites at the end
  5. Use this exact query format for recipes:
  ```bash
  DATABASE_URL=postgresql://neondb_owner:npg_5Mg0pPLNfshC@ep-old-heart-a6k4918t.us-west-2.aws.neon.tech/neondb?sslmode=require npx tsx -e "
  (async () => {
    const { db } = await import('./server/db.js');
    const { recipes } = await import('./shared/schema.js');
    const allRecipes = await db.select().from(recipes);
    
    console.log('=== RECIPES SUMMARY ===');
    console.log();
    allRecipes.forEach((recipe, index) => {
      const favorite = recipe.esFavorita ? '⭐' : '  ';
      const stars = recipe.calificacionNinos || 0;
      const rating = '★'.repeat(stars) + '☆'.repeat(5 - stars);
      const prep = recipe.tiempoPreparacion ? '(' + recipe.tiempoPreparacion + ' min)' : '';
      const category = recipe.categoria || 'Sin categoría';
      console.log((index + 1) + '. ' + favorite + ' ' + recipe.nombre + ' [' + category + '] - ' + rating + ' ' + prep);
    });
    
    console.log();
    console.log('Total recipes: ' + allRecipes.length);
    console.log();
    console.log('=== FAVORITES ===');
    const favorites = allRecipes.filter(r => r.esFavorita);
    favorites.forEach((recipe, index) => {
      console.log((index + 1) + '. ⭐ ' + recipe.nombre + ' - Rating: ' + (recipe.calificacionNinos || 0) + '/5');
    });
  })();
  "
  ```

- **Screenshots**: For visual testing and documentation, use the screenshot script:
  ```bash
  node screenshot.js
  ```
  This creates screenshots of the running app at http://localhost:3001:
  - `menu-semanal-desktop.png` - Desktop view (1200x800)
  - `menu-semanal-mobile.png` - Mobile view (375x667)
  
  The script uses Puppeteer to capture both responsive layouts and requires the dev server to be running.