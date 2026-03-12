# Technology Stack

**Analysis Date:** 2026-03-12

## Languages

**Primary:**
- TypeScript 5.6.3 - Used across entire codebase (client, server, shared)

**Secondary:**
- JavaScript - Used in configuration files, build scripts, and testing utilities
- HTML/CSS - Landing page and frontend UI

## Runtime

**Environment:**
- Node.js (version specified via .nvmrc if present, currently supporting ES modules)

**Package Manager:**
- npm - Primary package manager
- Lockfile: package-lock.json (present)

## Frameworks

**Core:**
- React 18.3.1 - Frontend library with hooks support
- Express.js 4.21.2 - Backend API framework
- Drizzle ORM 0.39.1 - Type-safe database ORM with migration support

**Frontend UI:**
- Radix UI (v1.1-1.2.x) - Unstyled, accessible component primitives
  - Components: Accordion, Dialog, Dropdown, Form, Popover, Select, Tabs, Toast, Tooltip, and 20+ more
- shadcn/ui - Pre-built Radix components with Tailwind styling (component library at `client/src/components/ui/`)
- Tailwind CSS 3.4.17 - Utility-first CSS framework

**Routing:**
- Wouter 3.3.5 - Lightweight client-side router for React

**State Management & Data Fetching:**
- TanStack Query (React Query) 5.60.5 - Server state management and caching
  - Custom QueryClient configured in `client/src/lib/queryClient.ts`
  - Default staleTime: Infinity, refetchOnWindowFocus: false
  - 401 errors throw by default (configurable)

**Form Management:**
- React Hook Form 7.55.0 - Performant, flexible form validation
- @hookform/resolvers 3.10.0 - Schema validation with Zod integration

**Styling & Theming:**
- Tailwind CSS 3.4.17 - Primary styling system
- CSS Modules/vanilla CSS - Custom styles in `client/src/styles/`
- next-themes 0.4.6 - Dark mode and theme management
- tailwindcss-animate 1.0.7 - Tailwind animation utilities
- tw-animate-css 1.2.5 - CSS animation support
- class-variance-authority 0.7.1 - Type-safe CSS variant generation
- clsx 2.1.1 - Conditional class name utility

**Animations & Motion:**
- Framer Motion 11.13.1 - React animation library
- Embla Carousel 8.6.0 - Carousel/slider component library

**Icons & UI:**
- lucide-react 0.453.0 - Modern icon library
- react-icons 5.4.0 - Icon set library
- react-resizable-panels 2.1.7 - Resizable panel component
- Recharts 2.15.2 - Chart/visualization library
- vaul 1.1.2 - Drawer component library
- react-day-picker 8.10.1 - Date picker component
- cmdk 1.1.1 - Command palette/search component
- input-otp 1.4.2 - OTP input component

## Database

**Type:** PostgreSQL (serverless)

**Provider:** Neon Serverless Database

**Connection Library:**
- @neondatabase/serverless 0.10.4 - HTTP-based PostgreSQL client optimized for serverless
- pg 8.16.3 - Traditional PostgreSQL client (used for session store)
- ws 8.18.0 - WebSocket support for Neon connections

**ORM:**
- Drizzle ORM 0.39.1
- drizzle-kit 0.30.4 - Migration and introspection CLI
- Configuration: `drizzle.config.ts`
- Migrations directory: `migrations/`

**Sessions:**
- express-session 1.18.1 - Session middleware
- connect-pg-simple 10.0.0 - PostgreSQL session store
- Session table: `user_sessions` (managed by connect-pg-simple)

## Authentication & Security

**Authentication:**
- Passport.js 0.7.0 - Authentication framework
- passport-local 1.0.0 - Local username/password strategy
- Custom strategy in `server/auth/passport.ts` with email-based authentication

**Password Hashing:**
- bcrypt 6.0.0 - Password hashing and verification

**Security Middleware:**
- express-rate-limit 8.0.1 - Rate limiting for API endpoints
  - Configured with per-endpoint limits in `server/auth/middleware.ts`
- CSRF protection - Token-based validation in routes
- Session security - httpOnly, sameSite cookies with environment-aware secure flag

**Login Protection:**
- Brute force prevention with login attempt tracking
- Temporary account lockout after 5 failed attempts (15-minute window)

## Build & Development Tools

**Build System:**
- Vite 5.4.19 - Frontend bundler and dev server
- ESBuild 0.25.0 - Backend bundler for production

**Build Plugins:**
- @vitejs/plugin-react 4.3.2 - React fast refresh support
- @replit/vite-plugin-runtime-error-modal 0.0.3 - Development error overlay
- @replit/vite-plugin-cartographer 0.2.7 - Optional Replit-specific plugin

**PostCSS & CSS Processing:**
- PostCSS 8.4.47
- autoprefixer 10.4.20 - Browser prefixing
- @tailwindcss/vite 4.1.3 - Vite-native Tailwind integration
- @tailwindcss/typography 0.5.15 - Typography plugin for prose styling

**TypeScript:**
- typescript 5.6.3 - Strict mode enabled across codebase
- Type checking via `npm run check`

**Development & Execution:**
- tsx 4.19.1 - TypeScript execution for Node.js
- Puppeteer 24.16.1 - Headless browser testing (used in `screenshot.js`)

**Testing:**
- Vitest 4.0.18 - Unit testing framework
- Run: `npm test` or `npm run test:watch`

**Validation:**
- Zod 3.24.2 - TypeScript-first schema validation
- drizzle-zod 0.7.0 - Zod schema generation from Drizzle ORM
- zod-validation-error 3.4.0 - Formatted error messages for Zod

## Utilities & Helpers

**Date/Time:**
- date-fns 3.6.0 - Modern date manipulation library

**Data Generation:**
- nanoid 5.1.5 - Tiny, secure URL-friendly ID generator

## Configuration

**Environment:**
- dotenv 17.2.2 - Environment variable loading
- `.env` file required for local development
- Critical variable: `DATABASE_URL` (PostgreSQL connection string)
- Optional: `RESEND_API_KEY`, `SESSION_SECRET`, `NOTIFY_EMAIL`

**TypeScript Configuration:**
- `tsconfig.json` - Strict mode, ESNext modules, path aliases configured
- Path aliases: `@/` → `client/src/`, `@shared/` → `shared/`

**Build Outputs:**
- Frontend: `dist/public/` (Vite output)
- Backend: `dist/index.js` (ESBuild output)
- Landing page: `dist/landing.html`
- Database migrations: `migrations/`

**Development Server:**
- Port: 5000 (or via PORT environment variable)
- Vite dev server integrated for hot module replacement
- Express serves both API and static files

**Production Server:**
- Node.js production mode
- Static file serving from `dist/public/`
- No Vite dev server

## Platform Requirements

**Development:**
- Node.js with ES module support
- PostgreSQL database (via Neon or local)
- npm installed

**Production:**
- Node.js runtime
- PostgreSQL database connection (Neon recommended for serverless)
- Environment variables: DATABASE_URL, SESSION_SECRET (recommended)
- Optional: RESEND_API_KEY for email notifications

**Deployment:**
- Replit-optimized (custom Vite plugins available)
- Compatible with any Node.js hosting (Vercel, Render, Railway, etc.)
- Health check endpoints: `/`, `/health`, `/api/health-check`

---

*Stack analysis: 2026-03-12*
