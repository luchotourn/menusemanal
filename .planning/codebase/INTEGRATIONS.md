# External Integrations

**Analysis Date:** 2026-03-12

## APIs & External Services

**Email Notifications:**
- Resend 6.9.3 - Email service provider
  - SDK: `resend` package
  - Auth: Environment variable `RESEND_API_KEY`
  - From: "Menu Semanal <notificaciones@menusemanal.app>"
  - Usage: Sends signup notifications for waitlist registrations
  - Implementation: `server/email.ts`
  - Optional: Skipped if RESEND_API_KEY or NOTIFY_EMAIL not configured

## Data Storage

**Databases:**
- PostgreSQL (Neon Serverless)
  - Connection: `DATABASE_URL` environment variable
  - Client: @neondatabase/serverless (HTTP-based for serverless)
  - ORM: Drizzle ORM with type-safe schema
  - Connection pool: Max 10, idle timeout 30s, connection timeout 10s
  - Health check: `checkDatabaseHealth()` function tests connectivity

**Database Schema Tables:**

Primary data tables:
- `users` - User accounts with bcrypt-hashed passwords, family associations, login attempt tracking
- `families` - Family groupings with unique invitation codes
- `family_members` - Junction table for user-family associations
- `recipes` - Recipe data with categories, kid ratings (0-5 stars), preparation time, images
- `meal_plans` - Weekly meal planning with date-based queries (YYYY-MM-DD format)
- `recipe_ratings` - Commentator feature: user ratings and comments on recipes
- `meal_comments` - Commentator feature: comments and emoji reactions on meal plans
- `meal_achievements` - Gamification: kid achievements (tried it, ate veggie, left feedback)
- `waitlist_signups` - Landing page signups with source tracking
- `user_sessions` - Session store (managed by connect-pg-simple)
- `migration_log` - Internal Drizzle migration tracking

**File Storage:**
- Local filesystem only - Images stored as base64 in `avatar` and `imagen` fields
- No external file storage service configured

**Caching:**
- None - Direct database queries with TanStack Query client-side caching
- Session-based caching via Express session store (PostgreSQL)

## Authentication & Identity

**Auth Provider:**
- Custom local authentication (email/password)
  - Implementation: Passport.js with LocalStrategy
  - Password hashing: bcrypt
  - Strategy file: `server/auth/passport.ts`

**Session Management:**
- Express-session with PostgreSQL store
- Session store: `connect-pg-simple` (creates `user_sessions` table automatically)
- Session ID cookie: `menu.sid`
- TTL: 7 days
- Security: httpOnly, sameSite cookies, secure flag in production

**Authorization & Roles:**
- Role-based access control: "creator" and "commentator" roles
- Middleware: `server/auth/middleware.ts`
  - `requireCreatorRole` - Restricts recipe/meal plan creation
  - `requireRole` - Generic role validation
  - `requireFamilyEditAccess` - Family-level access control
- Login attempt tracking: Max 5 attempts per 15-minute window

## Monitoring & Observability

**Error Tracking:**
- Console logging in development and production
- Error details logged to console with stack traces in development only
- Request/response logging: API calls logged with status code, response time, and response body (truncated)
- File: `server/index.ts` - Custom middleware for request logging

**Logs:**
- Standard output (console) - all logs go to stdout
- Log format: `[METHOD] [PATH] [STATUS] in [DURATIONms] :: [JSON_RESPONSE]`
- Production: Error stack traces suppressed, graceful error handling enabled
- Health check endpoint returns: status, uptime, memory usage, timestamp

**Database Health Monitoring:**
- Health check endpoints: `/`, `/health`, `/api/health-check`
- Returns: Database connectivity status, uptime, memory usage
- Used by deployment systems (Replit, Railway, Vercel, etc.)

## CI/CD & Deployment

**Hosting:**
- Replit (optimized with custom Vite plugins)
- Compatible with: Vercel, Railway, Render, or any Node.js hosting

**CI Pipeline:**
- None detected - no GitHub Actions, GitLab CI, or similar configured
- Manual deployment recommended

**Build Process:**
```bash
npm run build              # Vite frontend + ESBuild backend + landing page copy
npm start                  # Production server
npm run db:push           # Push schema changes to database
```

**Database Migrations:**
- Drizzle Kit for migrations
- Migration files: `migrations/` directory
- Commands:
  - `npm run db:push` - Push schema changes
  - `npm run migrate:multi-user` - Multi-family data migration
  - `npm run migrate:production` - Production migration script
  - `npm run migrate:verify` - Verify migration success
  - `npm run migrate:rollback` - Rollback using SQL script
  - `npm run migrate:audit` - Audit production data

## Environment Configuration

**Required Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string (critical, validated in production)
- `NODE_ENV` - Set to "production" or "development"
- `PORT` - Server port (defaults to 5000)

**Optional Environment Variables:**
- `SESSION_SECRET` - Session encryption secret (defaults to insecure value in dev)
- `RESEND_API_KEY` - Resend API key for email notifications
- `NOTIFY_EMAIL` - Recipient email for signup notifications
- `REPL_ID` - Set by Replit, enables Cartographer plugin

**Secrets Location:**
- `.env` file (local development)
- Environment variables (production deployment systems)
- Never committed to git (in `.gitignore`)

**Security Notes:**
- Production validation warns about:
  - Missing SESSION_SECRET
  - Using default SESSION_SECRET
  - SESSION_SECRET less than 32 characters

## Webhooks & Callbacks

**Incoming:**
- None configured

**Outgoing:**
- Resend email service calls (one-way)
- Health check responses to deployment monitors

## Security & Rate Limiting

**Rate Limiting:**
- API endpoints: `apiRateLimit` middleware
- Family code operations: `familyCodeRateLimit` middleware
- Waitlist signups: `waitlistRateLimit` middleware
- Commentator actions: `commentatorRateLimit` middleware
- Configured in: `server/auth/middleware.ts`

**CSRF Protection:**
- Token-based validation on unauthenticated routes
- CSRF token generated per request and stored in httpOnly cookie
- Validation middleware: `validateCsrf` in `server/routes.ts`

**Authentication Middleware:**
- `isAuthenticated` - Requires active session
- `attachUser` - Adds user to request context
- `getCurrentUser` - Gets authenticated user details
- All protected endpoints require authentication

## Content & Data Services

**Landing Page:**
- Waitlist signup collection: `POST /api/waitlist`
- Email notification on signup via Resend
- Source tracking: "hero", "footer", "landing"

**Image Handling:**
- Base64 encoding for recipe images and user avatars
- Size limit: 1MB max (validated via Zod schema)
- Stored directly in database as text fields

**External Links:**
- Recipes can have `enlaceExterno` (external recipe URL field)
- No automatic link validation or preview generation

---

*Integration audit: 2026-03-12*
