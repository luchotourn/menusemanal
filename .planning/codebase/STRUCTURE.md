# Codebase Structure

## Directory Layout

```
menusemanal/
├── client/                    # React frontend (Vite root)
│   ├── public/                # Static assets
│   │   ├── manifest.json      # PWA manifest
│   │   ├── sw.js              # Service worker
│   │   └── icons/             # PWA icons
│   └── src/
│       ├── App.tsx            # Root component with routing
│       ├── main.tsx           # Entry point
│       ├── index.css          # Global styles (Tailwind)
│       ├── components/
│       │   ├── ui/            # shadcn/ui primitives (~50 components)
│       │   ├── commentator/   # Kid rating/feedback feature module
│       │   │   ├── index.ts
│       │   │   ├── commentator-layout.tsx
│       │   │   ├── emoji-reactions.tsx
│       │   │   ├── kid-button.tsx
│       │   │   ├── progress-tracker.tsx
│       │   │   └── star-rating.tsx
│       │   ├── auth-guard.tsx           # Route protection (AuthGuard, GuestGuard)
│       │   ├── role-based-navigation.tsx # Nav filtered by user role
│       │   ├── role-based-wrapper.tsx   # Conditional UI by role
│       │   ├── weekly-calendar.tsx      # Main meal plan calendar
│       │   ├── recipe-card.tsx          # Recipe list item
│       │   ├── recipe-detail-modal.tsx  # Full recipe view
│       │   ├── add-recipe-modal.tsx     # Recipe creation form
│       │   ├── meal-selection-modal.tsx  # Add meal to plan
│       │   ├── meal-plan-detail-modal.tsx # Meal plan details
│       │   ├── meal-comment-sheet.tsx   # Comment drawer
│       │   ├── add-meal-button.tsx      # Floating action button
│       │   ├── bottom-navigation.tsx    # Mobile nav bar
│       │   ├── header.tsx              # App header
│       │   ├── create-family-modal.tsx  # Family creation
│       │   ├── join-family-modal.tsx    # Join via invite code
│       │   ├── invite-member-modal.tsx  # Send invitations
│       │   ├── invitation-code-display.tsx
│       │   ├── avatar-upload.tsx
│       │   ├── change-password-modal.tsx
│       │   ├── password-strength.tsx
│       │   ├── star-animations.tsx      # Visual effects
│       │   ├── star-rating-buttons.tsx
│       │   ├── recipe-rating.tsx
│       │   └── week-selection-modal.tsx
│       ├── pages/
│       │   ├── home.tsx                # Weekly calendar (main view)
│       │   ├── recipes.tsx             # Recipe library
│       │   ├── favorites.tsx           # Favorite recipes
│       │   ├── ratings.tsx             # Recipe ratings view
│       │   ├── family.tsx              # Family management
│       │   ├── family-settings.tsx     # Family admin settings
│       │   ├── settings.tsx            # App settings
│       │   ├── profile.tsx             # User profile
│       │   ├── login.tsx               # Login page
│       │   ├── register.tsx            # Registration page
│       │   └── not-found.tsx           # 404 page
│       ├── hooks/
│       │   ├── useAuth.ts              # Auth mutations & queries
│       │   ├── use-meal-comments.ts    # Comment CRUD hooks
│       │   ├── use-meal-achievements.ts # Gamification hooks
│       │   ├── use-mobile.tsx          # Responsive detection
│       │   └── use-toast.ts            # Toast notifications
│       ├── lib/
│       │   ├── queryClient.ts          # TanStack Query config + API helpers
│       │   ├── utils.ts                # cn() utility
│       │   ├── share-utils.ts          # Invite message builders
│       │   └── __tests__/
│       │       └── share-utils.test.ts # Unit tests (Vitest)
│       └── styles/
│           └── commentator-theme.css   # Kid-friendly theme overrides
├── server/
│   ├── index.ts               # Express app bootstrap
│   ├── routes.ts              # All API route handlers
│   ├── storage.ts             # Data access layer (IStorage interface + impl)
│   ├── db.ts                  # Neon PostgreSQL connection
│   ├── vite.ts                # Vite dev server integration
│   ├── email.ts               # Resend email integration
│   ├── landing.html           # Marketing landing page
│   └── auth/
│       ├── routes.ts          # Auth endpoints (login, register, profile)
│       ├── middleware.ts       # Auth guards, rate limiters, role checks
│       ├── passport.ts        # Passport.js local strategy config
│       └── session.ts         # Session store config (pg or memory)
├── shared/
│   ├── schema.ts              # Drizzle ORM schema + Zod validators
│   └── utils.ts               # Shared utilities (invitation codes)
├── scripts/
│   ├── migrate-multi-user.ts        # Multi-family migration script
│   ├── run-production-migration.ts  # Production migration runner
│   └── verify-migration.ts         # Migration verification
├── tests/
│   ├── run-security-tests.js        # Security test runner
│   ├── email-notification.test.js   # Email notification tests
│   └── security/
│       ├── role-based-security.test.js   # API auth/authz tests
│       ├── frontend-security.test.js     # Frontend security checks
│       └── waitlist-api.test.js          # Waitlist endpoint tests
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript config (strict mode)
├── vite.config.ts             # Vite build config
├── tailwind.config.ts         # Tailwind CSS config
├── drizzle.config.ts          # Drizzle Kit config
├── postcss.config.js          # PostCSS config
├── components.json            # shadcn/ui config
└── screenshot.js              # Puppeteer screenshot utility
```

## Key Locations

| What | Where |
|------|-------|
| Database schema | `shared/schema.ts` |
| API routes | `server/routes.ts` |
| Auth routes | `server/auth/routes.ts` |
| Data access | `server/storage.ts` |
| DB connection | `server/db.ts` |
| Frontend entry | `client/src/main.tsx` |
| App routing | `client/src/App.tsx` |
| Auth hooks | `client/src/hooks/useAuth.ts` |
| API client | `client/src/lib/queryClient.ts` |
| UI primitives | `client/src/components/ui/` |
| Shared types | `shared/schema.ts` (exported types) |

## Naming Conventions

- **Files**: kebab-case for components (`recipe-card.tsx`), camelCase for hooks (`useAuth.ts`)
- **Components**: PascalCase exports (`RecipeCard`, `AuthGuard`)
- **Database columns**: snake_case in SQL (`calificacion_ninos`), camelCase in TypeScript (`calificacionNinos`)
- **API paths**: `/api/` prefix, kebab-case resources (`/api/meal-plans`)
- **Spanish naming**: Domain entities use Spanish names (receta, familia, comida), UI/infra in English
- **Pages**: One file per route in `pages/`, lowercase kebab-case
- **Hooks**: `use-` prefix for custom hooks

## Path Aliases

Configured in `tsconfig.json` and `vite.config.ts`:
- `@/` → `client/src/`
- `@shared/` → `shared/`
- `@assets/` → `attached_assets/`

## Build Output

- Frontend: `dist/public/` (Vite build)
- Backend: `dist/index.js` (esbuild bundle)
- Landing page: `dist/landing.html` (copied during build)
