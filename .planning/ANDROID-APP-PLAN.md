# Menu Semanal — Android App Implementation Plan

Status: **Approved design, not started**
Approach: **Capacitor** wrapping the existing React/Vite app (one codebase; web + Android stay peers)
Headline native feature: **Push notifications (FCM)**

---

## 1. Decision Record

| Area | Decision |
|---|---|
| **Packaging** | Capacitor; web assets **bundled in the APK**; app calls the remote API |
| **API endpoint** | `https://menusemanal.app` (same origin as web), via build-time `VITE_API_BASE_URL` (empty for web) |
| **Auth** | `CapacitorHttp` native layer rides the existing cookie/session auth via its native cookie jar. **No change to web auth** (sessions, `sameSite:strict`, CSRF untouched) |
| **Push — Tier 1 (launch)** | weekly-menu-ready, review sign-off, new comment, new proposal |
| **Push — Tier 2 (later)** | proposal decisions, ratings, achievements |
| **Device tokens** | New `device_tokens` table `(id, userId FK, token unique, platform, createdAt, lastSeenAt)`; multi-device; prune stale tokens |
| **Push preferences** | Add `push` boolean to `notificationPreferences` → `{email, push, recipes, mealPlans}`; send when **channel AND category** are both on |
| **Permission prompt** | On first launch + Settings re-enable path (deep-links to OS app settings) |
| **Notification tap** | Structured `data` payload → deep-link to the **exact item** (week + meal + sheet) |
| **Foreground push** | Local toast + TanStack Query cache invalidation (live update) |
| **Native polish (Must)** | Splash + adaptive icon, status/nav bar theming, safe-area insets, hardware back button, keyboard handling, disable overscroll/text-select/long-press |
| **Native polish (Plus)** | Haptics, native share sheet |
| **Offline** | Read-cached: persist TanStack Query cache; last menu/recipes/comments viewable offline; writes need network with clear offline state |
| **Package id** | `app.menusemanal` (**irreversible — locked**) |
| **App name** | "Menú Semanal" (accented) |
| **App icon** | New custom icon (2 concepts to be proposed during build) |
| **Distribution** | Sideload signed APK first; Play Console + privacy policy + data-safety in parallel → internal testing → production |
| **Repo** | Commit `android/`; exclude keystore + `google-services.json` as secrets |
| **Build** | Local first, then GitHub Actions workflow for signed release artifacts (secrets in CI) |
| **Testing** | Vitest for backend push pipeline (mocked FCM), shared schema/gating, client URL/deep-link logic; manual on-device checklist for native bridge |

---

## 2. Prerequisites (user-owned, run in parallel — not dev blockers)

- [ ] **Firebase project** created → `google-services.json` for the app + FCM service credentials stored as a backend secret.
- [ ] **Google Play Console** account ($25 + identity verification — start ASAP, it's slow). *Not needed for sideload.*
- [ ] **Privacy policy** hosted at `menusemanal.app/privacy` (accounts, push tokens, AI inputs collected).
- [ ] **Dev machine** with Android SDK + JDK (toolchain setup is part of Phase 0).

---

## 3. Phased Implementation

### Phase 0 — Toolchain & Capacitor scaffold
- Install Android SDK + JDK; verify `npx cap` works.
- Add Capacitor deps; `capacitor.config.ts` (appId `app.menusemanal`, appName "Menú Semanal", `server.androidScheme: 'https'`).
- `npx cap add android`; commit `android/` (gitignore keystore + `google-services.json`).
- **Exit criteria:** empty shell builds and launches the bundled web app on a device/emulator.

### Phase 1 — API base URL + auth over CapacitorHttp (riskiest; do first)
- Introduce `VITE_API_BASE_URL`; refactor relative `/api/...` calls in `client/src/lib/queryClient.ts` (and any direct `fetch`) to prepend the base.
- Enable `CapacitorHttp` so WebView fetch is proxied natively (cookie jar persists session across restarts).
- Verify CORS/cookie behavior server-side for the Capacitor origin (no weakening of web `sameSite`/CSRF).
- **Tests:** Vitest for base-URL resolution (web vs Capacitor).
- **Exit criteria:** log in on a real device, session persists across app restart, authed `/api` calls succeed.

### Phase 2 — Native polish bundle ("feels like an app")
- Splash screen + adaptive icon placeholder; status/nav bar theming; safe-area insets; hardware back button → in-app nav/modal-close; keyboard handling; disable overscroll/text-select/long-press.
- Haptics on rating/button interactions; route existing `share-utils` through the native share sheet.
- **Exit criteria:** on-device pass of the "Must" + "Plus" polish checklist.

### Phase 3 — Push pipeline (backend + DB + FCM)
- Schema: `device_tokens` table; add `push` to `notificationPreferences` (default `true`); `db:push` + migration mindful of multi-family integrity.
- Endpoints: register/refresh/delete device token (authed).
- FCM send service (server) with mockable interface.
- Wire **Tier-1 events**: menu-ready, sign-off (extend existing email triggers in `routes.ts`/`email.ts`), new-comment, new-proposal. Apply **channel-AND-category** gating + recipient resolution. Prune stale tokens on FCM `unregistered`.
- Client: request permission on first launch; register token; Settings re-enable path.
- **Tests:** Vitest — token register/dedupe/prune, recipient resolution per event, gating matrix, FCM payload shape (FCM SDK mocked).
- **Exit criteria:** each Tier-1 event delivers a push to the right recipients (and not opted-out ones) on a real device.

### Phase 4 — Deep-link tap routing + foreground handling
- Push `data` payload carries `{type, weekStart, mealId, ...}`.
- Home page reads launch params → select week + auto-open the relevant modal/sheet.
- Foreground: local toast + invalidate relevant TanStack Query keys.
- **Tests:** Vitest — payload → route/week/sheet parsing.
- **Exit criteria:** tapping each notification type lands on the exact item.

### Phase 5 — Offline read-cache
- Add `@tanstack/query-persist-client` + Capacitor storage adapter; persist cache.
- Clear offline-state messaging on write attempts without network.
- **Exit criteria:** airplane-mode open shows last menu/recipes/comments; writes show offline state.

### Phase 6 — Identity, icon, signed APK (sideload)
- Final custom icon (pick from 2 concepts) → full Android icon/splash set.
- Generate upload keystore (**back it up securely — losing it blocks all future updates**).
- Build signed release APK; verify install via direct download.
- **Exit criteria:** sideloadable signed APK on real devices.

### Phase 7 — CI + Play track (when account ready)
- GitHub Actions: `vite build` → `cap sync` → signed APK/AAB on git tag; keystore + `google-services.json` as CI secrets.
- Play Console: data-safety form, store listing (Spanish), upload AAB to **internal testing** → production.

---

## 4. Key Risks / Watch-items
- **Cross-origin auth over CapacitorHttp** — the make-or-break assumption; validated early in Phase 1.
- **Keystore loss** — irrecoverable; back up immediately on creation.
- **DB migration** — `device_tokens` + `notificationPreferences` change must respect existing multi-family integrity / orphaned-record concerns (see `.planning/codebase/CONCERNS.md`).
- **Package id `app.menusemanal`** — permanent after first Play upload.

---

## 5. Open micro-decisions (defaults chosen)
- App name accent: **"Menú Semanal"** (default; change if undesired).
- Icon concepts: 2 to be proposed in Phase 6 (likely calendar + plate/fork motif in brand colors).
