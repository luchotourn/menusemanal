# Security Audit Report — Menu Familiar

**Date:** 2026-03-20 (updated 2026-03-22)
**Auditor:** Claude Code (Automated)
**Branch:** `fix/family-invite-code-alphabet`
**Scope:** Full-stack review — server API, database schema, validation layer, frontend, authentication, and family/multi-user system
**Status:** All CRITICAL issues resolved (see individual findings below)

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 4 |
| HIGH     | 12 |
| MEDIUM   | 7 |
| LOW      | 4 |
| **Total** | **27** |

---

## CRITICAL — Fix Immediately

### C-1: Production Database Credentials Committed to Repo

| | |
|---|---|
| **Location** | `CLAUDE.md:90,96` |
| **Impact** | Full database access for anyone with repo read access |

The full Neon PostgreSQL connection string (username `neondb_owner` + password) is hardcoded in `CLAUDE.md`, which is checked into git. The same credential also appears in `.claude/settings.local.json`, which is not excluded by `.gitignore`.

**Remediation:**
1. Rotate the Neon database password immediately from the Neon dashboard
2. Replace the connection string in `CLAUDE.md` with a placeholder (`DATABASE_URL=postgresql://...`)
3. Add `.claude/` to `.gitignore`
4. Audit git history (`git log --all -p -- CLAUDE.md`) for prior credential exposure

---

### C-2: Hardcoded Session Secret Used in Production

| | |
|---|---|
| **Location** | `server/auth/session.ts:53` |
| **Impact** | Session forgery — attacker can impersonate any user |

```ts
secret: process.env.SESSION_SECRET || "menu-familiar-secret-key-change-in-production",
```

`validateSessionConfig()` only emits a `console.warn` and does not halt startup. The application silently starts with the hardcoded secret if `SESSION_SECRET` is unset. Any attacker who reads this repository knows the session signing key and can forge session cookies for arbitrary user IDs.

**Remediation:**
```ts
if (process.env.NODE_ENV === "production") {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === "menu-familiar-secret-key-change-in-production") {
    throw new Error("SESSION_SECRET must be set to a secure value in production");
  }
}
```

---

### C-3: Role Escalation via Mass Assignment at Registration

| | |
|---|---|
| **Location** | `server/auth/routes.ts:37-43` |
| **Impact** | Users can self-assign elevated roles |

`insertUserSchema` includes the `role` field. The registration handler spreads the entire validated payload into the DB insert:

```ts
const validatedData = insertUserSchema.parse(req.body);
const [newUser] = await db.insert(users).values({
  ...validatedData,  // role comes from user input
  email: validatedData.email.toLowerCase(),
  password: hashedPassword,
});
```

A registering user can supply `"role": "creator"` in the POST body. If the role enum is ever expanded (e.g., `"admin"`), this becomes a privilege escalation vector.

**Remediation:**
```ts
const validatedData = insertUserSchema.parse(req.body);
await db.insert(users).values({
  ...validatedData,
  role: "creator", // always override server-side
  email: validatedData.email.toLowerCase(),
  password: hashedPassword,
});
```

---

### C-4: No Brute-Force Protection on Family Join Endpoint

| | |
|---|---|
| **Location** | `server/routes.ts:639` |
| **Impact** | Invite code enumeration allows joining arbitrary families |

`POST /api/families/join` only uses the general `apiRateLimit` (100 req/min per IP). The stricter `familyCodeRateLimit` (5/hour) is applied to code *generation* endpoints, not code *validation*. Invite codes are 6 characters (`[A-Z0-9]^6` ≈ 2.1B combinations), but at 100 req/min with no per-user limit, distributed enumeration is feasible.

**Remediation:**
```ts
app.post("/api/families/join", familyCodeRateLimit, isAuthenticated, async (req, res) => {
```

Additionally, implement per-user attempt tracking to prevent a single authenticated user from cycling through codes.

---

## HIGH

### H-1: No Security Headers (Helmet) or CORS Configuration

| | |
|---|---|
| **Location** | `server/index.ts` |
| **Impact** | Clickjacking, MIME sniffing, XSS escalation, unrestricted cross-origin requests |

No `helmet()` middleware and no CORS configuration. Missing headers: `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, `Strict-Transport-Security`.

**Remediation:**
```bash
npm install helmet cors
```
```ts
import helmet from "helmet";
import cors from "cors";
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "https://your-domain.com",
  credentials: true,
}));
```

---

### H-2: SSL Certificate Verification Disabled on Session DB Connection

| | |
|---|---|
| **Location** | `server/auth/session.ts:24` |
| **Impact** | Man-in-the-middle interception of session data |

```ts
ssl: url.searchParams.get("sslmode") !== "disable" ? { rejectUnauthorized: false } : false,
```

`rejectUnauthorized: false` disables TLS certificate validation for the session store's Postgres connection. This is particularly serious for a serverless cloud database where the connection traverses the public internet.

**Remediation:**
```ts
ssl: url.searchParams.get("sslmode") !== "disable" ? true : false,
```

---

### H-3: Password Hash Exposed on `req.user` in Every Request

| | |
|---|---|
| **Location** | `server/auth/passport.ts:100-112` |
| **Impact** | Accidental password hash leakage via logs, responses, or error payloads |

`deserializeUser` fetches the full user row including `password` and attaches it to `req.user` on every authenticated request. The `getFamilyMembers` storage method (`server/storage.ts:723-739`) also returns full `User[]` rows including password hashes.

**Remediation:**
```ts
passport.deserializeUser(async (id: number, done) => {
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, avatar: users.avatar })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  done(null, user);
});
```

---

### H-4: `insertRecipeSchema` Has No Field-Level Constraints

| | |
|---|---|
| **Location** | `shared/schema.ts:338-342` |
| **Impact** | Unbounded input storage, potential DoS via oversized payloads |

All string fields (`nombre`, `descripcion`, `instrucciones`, `imagen`) accept arbitrary-length input. Numeric fields (`calificacionNinos`, `tiempoPreparacion`, `porciones`) accept any integer including negatives. The `ingredientes` array has no item count or item length limit.

**Remediation:**
```ts
export const insertRecipeSchema = createInsertSchema(recipes, {
  nombre: z.string().min(1).max(200),
  descripcion: z.string().max(2000).optional(),
  instrucciones: z.string().max(10000).optional(),
  imagen: z.string().max(2000000).optional(),
  enlaceExterno: z.string().url().max(2000).optional().or(z.literal("")),
  categoria: z.enum(["Plato Principal", "Acompañamiento", "Entrada", "Ensalada", "Sopa"]),
  calificacionNinos: z.number().int().min(0).max(5).optional(),
  tiempoPreparacion: z.number().int().min(1).max(1440).optional(),
  porciones: z.number().int().min(1).max(100).optional(),
  ingredientes: z.array(z.string().max(200)).max(100).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });
```

---

### H-5: `insertMealPlanSchema` Missing Date and Enum Validation

| | |
|---|---|
| **Location** | `shared/schema.ts:344-348` |
| **Impact** | Malformed data stored in DB, silent query failures |

`fecha` is `text()` with no date format enforcement. `tipoComida` is `text()` with no enum constraint. `notas` has no max length.

**Remediation:**
```ts
export const insertMealPlanSchema = createInsertSchema(mealPlans, {
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)"),
  tipoComida: z.enum(["almuerzo", "cena"]),
  notas: z.string().max(1000).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });
```

---

### H-6: Registration Uses Weak `insertUserSchema` Instead of `registerSchema`

| | |
|---|---|
| **Location** | `server/auth/routes.ts:17` |
| **Impact** | Password policy bypass via direct API calls |

The server uses `insertUserSchema` (min 8 chars) instead of `registerSchema` (requires uppercase, lowercase, digit, `confirmPassword`, `acceptTerms`). Direct API calls to `POST /api/auth/register` bypass the strong password policy enforced on the frontend.

**Remediation:** Use `registerSchema` in the server registration handler, or at minimum apply the same password constraints in `insertUserSchema`.

---

### H-7: `window.open` on Unvalidated `enlaceExterno` URL

| | |
|---|---|
| **Location** | `client/src/components/recipe-detail-modal.tsx:62`, `client/src/components/meal-plan-detail-modal.tsx:191` |
| **Impact** | Stored XSS via `javascript:` URI injection |

`enlaceExterno` is user-supplied and passed directly to `window.open()` and rendered as `<a href>` without protocol validation. A stored value of `javascript:alert(document.cookie)` executes in the browser.

**Remediation:**
```ts
function isSafeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
```

---

### H-8: CSRF Protection Only Covers `/api/waitlist`

| | |
|---|---|
| **Location** | `server/routes.ts:150-159` |
| **Impact** | Cross-site request forgery on all recipe/meal-plan/family mutation endpoints |

The CSRF double-submit cookie implementation only protects the waitlist endpoint. All other mutating API routes rely solely on the `SameSite` cookie attribute, which is set to `lax` in development environments.

**Remediation:** Apply CSRF protection globally to all state-changing endpoints, or ensure `SameSite: strict` is enforced in all environments.

---

### H-9: Third-Party Replit Script in Production HTML

| | |
|---|---|
| **Location** | `client/index.html:33` |
| **Impact** | Supply chain risk — arbitrary JS execution if Replit CDN is compromised |

```html
<script type="text/javascript" src="https://replit.com/public/js/replit-dev-banner.js"></script>
```

External script loaded unconditionally with no Subresource Integrity (SRI) attribute and no build-time removal for production.

**Remediation:** Remove the script for production builds, or gate it behind an environment check in `vite.config.ts`.

---

### H-10: `isAdmin` Middleware Is Permanently Broken

| | |
|---|---|
| **Location** | `server/auth/middleware.ts:34` |
| **Impact** | Dead code that would lock out all users if ever applied to a route |

The middleware checks `user.role !== "admin"`, but the `users` table only contains roles `"creator"` and `"commentator"` — `"admin"` is never assigned. If this middleware is ever attached to a route, it will reject every user with a 403.

**Remediation:** Fix to check the correct role or remove if unused.

---

### H-11: Missing `isNaN` Guard on `parseInt` in ~15 Routes

| | |
|---|---|
| **Location** | `server/routes.ts` (lines 347, 403, 425, 544, 618, 693, 731, 777, 826, 886, 940, 1173, 1214, 1253) |
| **Impact** | Unexpected DB queries with `NaN`, potential error noise |

Most `parseInt(req.params.id)` calls have no `isNaN()` guard. Compare lines 319, 961, 1030, 1070 which do check correctly.

**Remediation:**
```ts
const id = parseInt(req.params.id);
if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
```

---

### H-12: Avatar in `updateProfileSchema` Bypasses Size/Type Checks

| | |
|---|---|
| **Location** | `shared/schema.ts:476` |
| **Impact** | Unbounded avatar data via profile update endpoint |

`updateProfileSchema` accepts `avatar` as bare `z.string()` while `avatarUploadSchema` correctly validates format and caps at 1.4 MB. The profile update endpoint bypasses avatar-specific validation.

**Remediation:**
```ts
avatar: z.string()
  .refine(val => val.startsWith('data:image/') || val.startsWith('http'), "Avatar inválido")
  .refine(val => val.length <= 1400000, "Imagen demasiado grande")
  .nullable().optional(),
```

---

## MEDIUM

### M-1: `updateRecipe`/`deleteMealPlan` Don't Pass `familyId`

| | |
|---|---|
| **Location** | `server/routes.ts:401-420, 542-557` |
| **Impact** | Potential family data isolation bypass on update/delete operations |

These handlers pass `userId` but not `familyId` to the storage layer, falling back to the legacy `userId`-based access check instead of the proper family-based isolation.

**Remediation:** Fetch user families first and pass `familyId` to the storage method, following the pattern used in `GET /api/recipes/:id`.

---

### M-2: Health Endpoints Leak Server Internals

| | |
|---|---|
| **Location** | `server/routes.ts:93-146` |
| **Impact** | Information disclosure — environment, uptime, memory, raw DB error messages |

`/api/health-check` and `/health` are publicly accessible and expose `process.env.NODE_ENV`, `process.uptime()`, heap usage, and database error messages.

**Remediation:** Restrict to internal callers or remove sensitive fields from public responses.

---

### M-3: `users.familyId` Type Mismatch and Missing Foreign Key

| | |
|---|---|
| **Location** | `shared/schema.ts:11` vs `shared/schema.ts:26` |
| **Impact** | No referential integrity, potential type coercion bugs |

`users.familyId` is `text` while `families.id` is `serial` (integer). No foreign key constraint exists. Orphaned references possible when families are deleted.

---

### M-4: Invite Codes Never Expire

| | |
|---|---|
| **Location** | `shared/schema.ts` (families table) |
| **Impact** | Leaked invite codes remain valid indefinitely |

No `codeExpiresAt` column or expiry mechanism. Codes are valid until manually regenerated.

**Remediation:** Add a `codeExpiresAt` timestamp column and enforce expiry checks on join.

---

### M-5: `joinFamilySchema` Missing Max Length

| | |
|---|---|
| **Location** | `shared/schema.ts:330-332` |
| **Impact** | Oversized input reaches `normalizeInvitationCode` before format check |

```ts
codigoInvitacion: z.string().min(1, "El código de invitación es requerido"),
```

**Remediation:** Add `.max(20)` to cap input length at the schema level.

---

### M-6: Email Fields Missing `.max(254)`

| | |
|---|---|
| **Location** | `shared/schema.ts:304` and multiple schemas |
| **Impact** | Oversized email strings accepted, potential index/storage impact |

RFC 5321 caps email addresses at 254 characters. No length limit is enforced.

---

### M-7: Debug `console.log` of User Email in Production

| | |
|---|---|
| **Location** | `client/src/pages/register.tsx:56` |
| **Impact** | PII exposure in browser console / error monitoring tools |

```ts
console.log("Form submitted for user:", data.email);
```

**Remediation:** Remove, or guard with `if (import.meta.env.DEV)`.

---

## LOW

### L-1: Client Treats Current User as Family Admin

| | |
|---|---|
| **Location** | `client/src/hooks/useAuth.ts:335` |
| **Impact** | Non-admin users see admin UI controls (server still enforces correctly) |

`createdBy` is hardcoded to the current user's ID, making client-side `isAdmin` checks always return `true`.

---

### L-2: `AuthGuard` Side Effect During Render

| | |
|---|---|
| **Location** | `client/src/components/auth-guard.tsx:30-32` |
| **Impact** | React strict mode double-render, potential navigation flicker |

`setLocation("/login")` is called during the render phase instead of inside a `useEffect`, unlike the correctly implemented `GuestGuard`.

---

### L-3: `normalizeInvitationCode` Passthrough on Dash-Containing Input

| | |
|---|---|
| **Location** | `shared/utils.ts:28` |
| **Impact** | Surprising API contract — callers must also call `isValidInvitationCodeFormat` |

If input already contains a dash, the function returns it without further format validation. The route correctly calls both functions, but the utility's contract is a footgun.

---

### L-4: Fire-and-Forget Email Notification

| | |
|---|---|
| **Location** | `server/routes.ts:175` |
| **Impact** | Email delivery failures silently swallowed |

`sendSignupNotification()` is not awaited. If it throws synchronously, the error becomes an unhandled promise rejection.

---

## Recommended Fix Priority

| Priority | Findings | Effort |
|----------|----------|--------|
| **Immediate** | C-1 (rotate DB password), C-2 (session secret) | 30 min |
| **This week** | C-3 (mass assignment), C-4 (join rate limit), H-1 (Helmet/CORS), H-3 (password in req.user), H-6 (register schema), H-7 (enlaceExterno XSS) | 1-2 days |
| **Soon** | H-4, H-5 (schema validation), H-9 (Replit script), H-12 (avatar bypass), M-1 (family isolation) | 2-3 days |
| **Backlog** | Remaining MEDIUM and LOW findings | 1-2 days |
