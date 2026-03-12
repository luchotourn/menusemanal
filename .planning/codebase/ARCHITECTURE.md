# Architecture

**Analysis Date:** 2026-03-12

## Pattern Overview

**Overall:** Monorepo full-stack PWA with client-server-shared architecture

**Key Characteristics:**
- **Layered separation**: Frontend (React + TypeScript), Backend (Express + Node), Shared schemas
- **RESTful API**: Standard HTTP endpoints with Zod validation
- **Session-based authentication**: Passport.js with PostgreSQL session storage
- **Role-based access control**: Creator and Commentator roles with different permissions
- **Family-scoped data**: Multi-family support with family isolation at database and API levels
- **Real-time query management**: TanStack Query for server state synchronization

## Layers

**Client Layer (Frontend):**
- Purpose: React UI for meal planning, recipe management, family collaboration
- Location: `client/src/`
- Contains: Pages, components, hooks, utilities, styles
- Depends on: TanStack Query, Wouter routing, shadcn/ui components
- Used by: End users via browser

**API Layer (Backend Routes):**
- Purpose: Express.js REST endpoints for all operations
- Location: `server/routes.ts` (main endpoint registrations)
- Contains: Recipe CRUD, meal plan management, family operations, ratings, comments, achievements
- Depends on: Express middleware, Zod validation, Storage layer
- Used by: Client layer via HTTP requests

**Authentication Layer:**
- Purpose: Session management, user verification, role enforcement
- Location: `server/auth/` (passport, session, middleware, routes)
- Contains: Passport configuration, session middleware, auth endpoints, role checks
- Depends on: PostgreSQL sessions, bcrypt hashing, express-session
- Used by: All protected routes via middleware

**Storage Layer (Data Access):**
- Purpose: Abstract database operations from routes
- Location: `server/storage.ts` (implements IStorage interface)
- Contains: Recipe queries, meal plan queries, family operations, ratings, comments, achievements
- Depends on: Drizzle ORM, PostgreSQL database
- Used by: Routes layer for all data operations

**Database Layer:**
- Purpose: PostgreSQL connection pooling and Drizzle ORM setup
- Location: `server/db.ts`
- Contains: Neon serverless connection pool configuration, health checks
- Depends on: @neondatabase/serverless, drizzle-orm
- Used by: Storage layer

**Schema/Types Layer:**
- Purpose: Shared TypeScript types and database schema definitions
- Location: `shared/schema.ts`, `shared/utils.ts`
- Contains: Drizzle table definitions, Zod validation schemas, type exports
- Depends on: drizzle-orm, zod, drizzle-zod
- Used by: Both frontend (types) and backend (validation, ORM)

## Data Flow

**Recipe CRUD Flow:**

1. User clicks "Add Recipe" in client
2. Form validation occurs in `client/src/components/add-recipe-modal.tsx`
3. `POST /api/recipes` with Zod-validated payload sent
4. Express middleware checks authentication (`isAuthenticated`) and role (`requireCreatorRole`)
5. Request handler validates schema using `insertRecipeSchema`
6. Storage layer (`storage.createRecipe()`) executes Drizzle ORM insert
7. Response returned to client, TanStack Query cache invalidated
8. UI updates to show new recipe

**Meal Plan Selection Flow:**

1. User selects date and meal type from calendar
2. `MealSelectionModal` opens with recipe list
3. User chooses recipe
4. `POST /api/meal-plans` with date, recipe ID, meal type
5. Route handler validates with `insertMealPlanSchema`
6. Storage creates meal plan record scoped to user's family
7. Query cache invalidated: `["/api/meal-plans"]`
8. Calendar re-renders with new meal

**Family Invitation Flow:**

1. Creator user posts to `POST /api/families/:id/regenerate-code`
2. Random 6-character code generated via `generateInvitationCode()`
3. Family record updated with new code
4. Code displayed in `invitation-code-display.tsx`
5. Other user receives code and posts to `POST /api/families/join`
6. Normalized code checked against family invitation codes
7. User added to family via `familyMembers` junction table
8. Future queries automatically filtered by family context

**Commentary/Rating Flow (Commentator Role):**

1. Commentator views recipe detail modal
2. Posts to `POST /api/recipes/:id/rating` with rating (1-5) and optional comment
3. Route validates against `commentatorRateLimit` middleware
4. Storage creates entry in `recipeRatings` table
5. Average rating calculated from family's ratings
6. UI shows family average and user's rating
7. Comments visible to all family members in `RoleBasedWrapper` component

**Achievement Tracking Flow:**

1. User performs action: tries recipe, eats veggie, leaves feedback
2. Posts to `POST /api/achievements` with meal plan ID and star type
3. Route validates meal plan belongs to user's family
4. Storage creates `mealAchievements` entry (tried_it, ate_veggie, left_feedback)
5. Weekly stats calculated: `GET /api/achievements/stats/:userId`
6. Frontend displays star counts and streak in profile/ratings page
7. Gamification motivates continued family engagement

**State Management:**

- **Server state**: TanStack Query manages all API data with automatic caching
- **UI state**: React `useState` for modals, selections, editing state
- **Auth state**: Express session cookies + query `["auth"]` cache
- **Cache invalidation**: Mutations trigger `queryClient.invalidateQueries()` to refresh affected data

## Key Abstractions

**IStorage Interface:**
- Purpose: Abstract database implementation from routes
- Examples: `MemStorage` (in-memory), Production uses Drizzle queries
- Pattern: Methods return typed Promises (`Promise<Recipe[]>`, `Promise<Family>`)
- Enables easy testing and future database swaps

**Zod Schemas:**
- Purpose: Runtime validation and type safety
- Examples: `insertRecipeSchema`, `insertMealPlanSchema`, `createFamilySchema`
- Pattern: Schemas defined in `shared/schema.ts`, used in routes for validation, infer types
- Enables single source of truth for validation and TypeScript types

**Middleware Chain:**
- Purpose: Progressive authentication and rate limiting
- Examples: `isAuthenticated`, `requireCreatorRole`, `apiRateLimit`
- Pattern: Each middleware either calls `next()` or responds with error
- Applied selectively to routes: auth endpoints get rate limits, protected routes get auth checks

**Components with State Management:**
- Purpose: Encapsulate UI logic and API integration
- Examples: `WeeklyCalendar`, `RecipeCard`, `MealPlanDetailModal`
- Pattern: Use TanStack Query hooks for server state, local `useState` for UI state
- Enables reusable, testable component logic

## Entry Points

**Server Entry Point:**
- Location: `server/index.ts`
- Triggers: `npm run dev` or `node dist/index.js`
- Responsibilities:
  - Validate environment variables
  - Configure Express app (JSON parsing, trust proxy, sessions)
  - Initialize Passport authentication
  - Register request logging middleware
  - Register all API routes via `registerRoutes(app)`
  - Setup Vite dev server (development) or static file serving (production)
  - Start HTTP listener on port 5000 (or PORT env var)

**Client Entry Point:**
- Location: `client/src/main.tsx`
- Triggers: Vite dev server or built static files
- Responsibilities:
  - Mount React app to DOM element
  - Setup QueryClientProvider for TanStack Query
  - Initialize TooltipProvider from shadcn/ui
  - Mount Router component

**Router Entry Point (Frontend):**
- Location: `client/src/App.tsx`, Router component
- Responsibilities:
  - Define all routes (login, register, /app, /recipes, etc.)
  - Apply AuthGuard to protected routes
  - Apply GuestGuard to authentication routes
  - Render RoleBasedBottomNavigation for authenticated users
  - Catch-all 404 handler

**API Health Check Entry Point:**
- Location: `server/routes.ts`, GET `/` and `/api/health-check`
- Triggers: Deployment systems or `curl localhost:5000/health`
- Responsibilities:
  - Verify database connectivity
  - Return status JSON
  - Detect requests from deployment systems vs browsers
  - Serve landing.html to unauthenticated browsers

## Error Handling

**Strategy:** Centralized error handlers with Spanish localized messages for user-facing errors

**Patterns:**

- **Validation errors**: Zod schema validation in routes, returns 400 with error details
- **Authentication errors**: Middleware returns 401 "No autorizado. Por favor inicie sesión."
- **Authorization errors**: Middleware returns 403 "Acceso denegado. Se requieren permisos de administrador."
- **Not found errors**: Route handlers return 404 or catch-all 404 page
- **Server errors**: Express error handler catches errors, logs details, returns 500
- **Rate limit errors**: 429 response with "Demasiados intentos" message
- **Unhandled errors**: Process-level handlers log but don't crash in production

Error responses include:
- Status code (4xx for client errors, 5xx for server)
- Message in Spanish (user-facing)
- Error code if applicable (e.g., "UNAUTHORIZED", "FORBIDDEN")
- Stack trace in development only

## Cross-Cutting Concerns

**Logging:**
- Request/response logging via middleware in `server/index.ts`
- Logs method, path, status, duration, response body for `/api` calls
- Truncates long responses to 80 characters
- Console output for startup, configuration, errors

**Validation:**
- All user inputs validated by Zod schemas before processing
- Schemas defined in `shared/schema.ts` and used in routes
- Front-end form validation via React Hook Form + Zod resolvers
- Server-side validation always enforced regardless of client

**Authentication:**
- Passport.js with local strategy (email/password)
- Sessions stored in PostgreSQL via connect-pg-simple
- Secure cookies with `httpOnly`, `sameSite: strict`, `secure` in production
- Login attempts tracked: `loginAttempts` field prevents brute force
- CSRF tokens generated for landing page to prevent attacks

**Authorization:**
- Role-based: "creator" (full access) vs "commentator" (read-only, rating/feedback)
- Family-scoped: Data filtered by `familyId` in all queries
- User isolation: Queries include `createdBy` or family checks
- Middleware enforces at route level: `requireCreatorRole`, `requireRole`

**Rate Limiting:**
- Auth endpoints: 5 requests per 15 minutes per IP
- General API: 100 requests per minute per IP
- Family code generation: 5 requests per hour per IP
- Commentator actions: 10 requests per minute per IP (ratings, comments, achievements)
- Rate limit errors return 429 status and Spanish message

**Error Monitoring:**
- Console errors with context (status, message, stack)
- Unhandled promise rejections caught and logged
- Uncaught exceptions logged but don't crash production
- Database health checks available via `/health` endpoint

---

*Architecture analysis: 2026-03-12*
