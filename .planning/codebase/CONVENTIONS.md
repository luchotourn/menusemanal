# Coding Conventions

## Language & Style

- **TypeScript strict mode** everywhere (`"strict": true` in tsconfig)
- **ESM modules** throughout (`"type": "module"` in package.json)
- No ESLint/Prettier configured — conventions enforced by TypeScript and developer practice
- Spanish used for domain terms (recipes, meals, families); English for infrastructure code

## Frontend Patterns

### Component Structure
- Functional components with hooks, no class components
- shadcn/ui for all primitive UI elements (`client/src/components/ui/`)
- Custom components co-located in `client/src/components/`
- Pages in `client/src/pages/` — one component per route

### State Management
- **Server state**: TanStack Query (`@tanstack/react-query`) exclusively
  - Query keys follow convention: `["/api/resource"]` or `["/api/resource", params]`
  - API helper `apiRequest()` and `jsonApiRequest<T>()` in `client/src/lib/queryClient.ts`
  - Mutations invalidate related queries on success
- **Local state**: React `useState`/`useReducer` for form state and UI toggles
- No global state management library (no Redux/Zustand)

### Routing
- Wouter for client-side routing (lightweight alternative to React Router)
- Route guards: `AuthGuard` (requires login), `GuestGuard` (redirects if logged in)
- Role-based UI via `RoleBasedWrapper` component and `RoleBasedBottomNavigation`

### Forms
- `react-hook-form` with `@hookform/resolvers` for Zod validation
- Zod schemas from `shared/schema.ts` reused on both client and server
- Form components use shadcn/ui `Form` primitives

### Styling
- Tailwind CSS with `tw-animate-css` and `tailwindcss-animate` for animations
- `cn()` utility from `client/src/lib/utils.ts` for conditional class merging (clsx + tailwind-merge)
- Mobile-first responsive design
- `framer-motion` for complex animations (star effects, transitions)

## Backend Patterns

### API Design
- RESTful JSON API under `/api/` prefix
- Express.js with typed request handlers
- Zod validation for all incoming request bodies using `insertRecipeSchema`, `insertMealPlanSchema`, etc.
- Error responses in Spanish: `{ message: "Error en español" }`
- HTTP status codes: 200 (success), 201 (created), 400 (validation), 401 (unauth), 403 (forbidden), 404 (not found), 500 (server error)

### Authentication & Authorization
- Passport.js local strategy with bcrypt password hashing
- Express sessions stored in PostgreSQL (`connect-pg-simple`) or memory (`memorystore` for dev)
- Rate limiting on auth endpoints (`express-rate-limit`)
- Middleware chain: `isAuthenticated` → `attachUser` → `requireRole`/`requireCreatorRole`
- Two roles: `creator` (full CRUD) and `commentator` (read + rate/comment only)

### Data Access Layer
- `IStorage` interface in `server/storage.ts` defines all data operations
- Single `DatabaseStorage` class implements the interface
- All queries scoped by `userId` and/or `familyId` for data isolation
- Drizzle ORM with `drizzle-zod` for schema-to-validator generation

### Database
- PostgreSQL via Neon Serverless (`@neondatabase/serverless`)
- Schema in `shared/schema.ts` using Drizzle `pgTable` definitions
- Migrations via `drizzle-kit push` (schema push, not migration files)
- Indexes on frequently queried columns (email, familyId, fecha)

## Error Handling

### Backend
- Try/catch in route handlers with 500 fallback
- Zod validation errors caught and returned as 400 with details
- Database errors logged and returned as generic server errors
- Spanish error messages for user-facing errors

### Frontend
- TanStack Query `onError` callbacks with toast notifications
- `queryClient` configured with retry logic
- Auth failures redirect to login page via `useAuth` hook

## Shared Code

- `shared/schema.ts`: Single source of truth for types, schemas, and validators
- `shared/utils.ts`: Invitation code generation/validation (used by both client and server)
- Type exports: `Recipe`, `MealPlan`, `User`, `Family`, `InsertRecipe`, etc.
- Zod schemas: `insertRecipeSchema`, `loginSchema`, `registerSchema`, etc.

## Feature Organization

Features span client/server without strict feature-folder boundaries:
- **Commentator system**: `client/src/components/commentator/` + API routes in `server/routes.ts` + schema tables
- **Auth system**: `server/auth/` directory + `client/src/hooks/useAuth.ts` + guard components
- **Family system**: Spread across schema, storage, routes, and multiple UI components
