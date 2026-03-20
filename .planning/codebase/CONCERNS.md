# Codebase Concerns

**Analysis Date:** 2026-03-12

## Tech Debt

**Large Monolithic Routes File:**
- Issue: `server/routes.ts` is 1287 lines, handling recipe CRUD, meal plans, authentication, family management, commentator features, and gamification in a single file
- Files: `server/routes.ts`
- Impact: Difficult to maintain, test, and reason about. Changes in one feature can affect others unintentionally. Debugging is harder due to length.
- Fix approach: Split into feature-based route modules (e.g., `routes/recipes.ts`, `routes/mealPlans.ts`, `routes/achievements.ts`, `routes/families.ts`) and compose them in the main export function. Use Express Router for each module.

**Large Storage Class:**
- Issue: `server/storage.ts` is 1122 lines with both memory and database implementations mixed. DatabaseStorage has 730+ lines of implementation.
- Files: `server/storage.ts`
- Impact: Hard to extend with new features, difficult to test edge cases, memory overhead with unused MemStorage methods that throw errors
- Fix approach: Split DatabaseStorage into separate files (recipes, mealPlans, families, ratings, comments, achievements, waitlist operations). Create a layer for common operations (family filtering, error handling).

**Incomplete Achievement Streak Calculation:**
- Issue: `storage.ts` line 1095 - `streakDays` is hardcoded to 0 with a comment "Placeholder - would need more complex date comparison logic"
- Files: `server/storage.ts` (lines 1093-1095)
- Impact: Feature is incomplete - streaks cannot be tracked. Users won't see accurate streak statistics in gamification features.
- Fix approach: Implement proper streak calculation by analyzing meal achievement dates consecutively. Join with meal_plans on fecha to check if user has stars on consecutive days.

**Inconsistent Error Handling:**
- Issue: Routes use generic try-catch with `console.error` logging, which prints to stdout without structured logging
- Files: Multiple routes throughout `server/routes.ts` (scattered try-catch blocks)
- Impact: Production errors are hard to trace, aggregate, or monitor. No error codes beyond HTTP status. Spanish error messages can't be easily searched/tracked
- Fix approach: Implement a centralized error handling middleware using a custom error class hierarchy (RecipeNotFoundError, UnauthorizedError, etc.) with structured logging (Winston/Pino)

**Backward Compatibility Columns Not Used:**
- Issue: Schema retains legacy `userId` field in recipes and meal_plans (lines 65, 83 in schema.ts) marked "Kept for backward compatibility"
- Files: `shared/schema.ts` (lines 65, 83), migration queries update both fields redundantly
- Impact: Extra database columns, query confusion (when to use `createdBy` vs `userId`), potential data consistency bugs where one is updated but not the other
- Fix approach: Set a removal deadline (e.g., 3 months). Run migration to consolidate. Deprecation period should be documented in CLAUDE.md

## Known Bugs

**NaN Check on Recipe ID:**
- Issue: Route checks `isNaN(recipeId)` after `parseInt()` but parseInt can return NaN silently on invalid input
- Files: `server/routes.ts` (line 319)
- Trigger: Non-numeric recipe IDs (e.g., `/api/recipes/abc` returns 400, but `/api/recipes/` returns NaN which is caught)
- Workaround: The check itself prevents the bug from propagating, but error message is generic

**Orphaned Data Migration Risk:**
- Issue: Migration script `003_fix_orphaned_data.sql` assumes all users have families (prerequisite check at line 31), but this can fail silently if migration 002 wasn't run
- Files: `scripts/migrate-multi-user.ts`, `migrations/003_fix_orphaned_data.sql`
- Trigger: If migration is re-run before verification, or if migration 002 failed partially
- Workaround: Verification script exists (`scripts/verify-migration.ts`) but is manual

**Missing Database Cascade Delete on User Deletion:**
- Issue: Schema defines `onDelete: "cascade"` for family_members (line 41 in schema.ts), but deleting a user doesn't cascade to dependent data
- Files: `shared/schema.ts` (line 41)
- Trigger: Manual user deletion without proper cleanup leaves orphaned recipes, meal_plans, comments, ratings, and achievements
- Workaround: None currently implemented - must use database constraints

**Duplicate Unique Index Constraint:**
- Issue: `family_members_family_user_idx` is uniqueIndex on (familyId, userId) (schema.ts line 47), but user can only belong to one family - the constraint should enforce uniqueness on userId alone
- Files: `shared/schema.ts` (lines 46-49)
- Trigger: Currently works because business logic enforces it, but schema doesn't match requirements
- Workaround: Enforce in middleware with `requireFamilyAccess`

## Security Considerations

**Missing CSRF Protection on Non-GET Requests:**
- Risk: CSRF tokens are checked only on `/api/waitlist/signup` (line 156 in routes.ts) but not on other POST/PUT/DELETE endpoints
- Files: `server/routes.ts` (line 156)
- Current mitigation: Session-based authentication via Passport, but CSRF token validation should be consistent
- Recommendations: Implement CSRF middleware globally for all state-changing operations (POST, PUT, DELETE)

**Raw parseInt Without Bounds Checking:**
- Risk: `parseInt(req.params.id)` can accept very large numbers. No validation that IDs are reasonable database IDs
- Files: `server/routes.ts` (scattered: lines 318, 347, 403, 425, 522, 544, 618, 693, 731, 777, 826, 886, 940, 960, 1029, 1069, 1173, 1214, 1253)
- Current mitigation: Database will return 0 results for invalid IDs (fail-safe), but could log many error records
- Recommendations: Validate IDs are positive integers < 2147483647 (max 32-bit signed int). Create a reusable `parsePositiveInt` helper.

**Email Input Sanitization Inconsistent:**
- Risk: Email validation uses Zod schema with `.toLowerCase()` and `.replace(/<[^>]*>/g, '')` (schema.ts line 410) to strip HTML tags, but other email inputs may not go through this
- Files: `shared/schema.ts` (line 410), `server/auth/routes.ts` (email endpoints)
- Current mitigation: Zod validation catches most cases, but pattern is not enforced everywhere
- Recommendations: Create a centralized email validation schema used by all email endpoints

**No Rate Limiting on Recipe/Meal Plan Operations:**
- Risk: Recipe CRUD and meal plan endpoints use generic `apiRateLimit` (100 req/min per IP) but no per-user or per-family limits
- Files: `server/auth/middleware.ts` (line 67), `server/routes.ts` (recipe/meal plan endpoints don't use stricter limits)
- Current mitigation: 100 req/min is reasonable, but bulk operations could be exploited
- Recommendations: Add stricter rate limits for mutation endpoints (POST/PUT/DELETE) or track by authenticated user, not just IP

**Session Configuration Warnings:**
- Risk: `validateSessionConfig()` in `server/auth/session.ts` only warns but doesn't fail if Redis is misconfigured for session persistence
- Files: `server/auth/session.ts` (line 22), `server/index.ts` (line 22)
- Current mitigation: Falls back to in-memory sessions (insecure in production)
- Recommendations: Fail startup in production if session store is not properly configured

## Performance Bottlenecks

**N+1 Query Pattern in Family Member Retrieval:**
- Problem: `getFamilyMembers()` first queries family_members, then separately queries users table
- Files: `server/storage.ts` (lines 723-740)
- Cause: Two database round trips instead of one JOIN operation
- Improvement path: Rewrite to use a single JOIN query: `SELECT u.* FROM users u INNER JOIN family_members fm ON u.id = fm.user_id WHERE fm.family_id = $1`

**Missing Index on Frequently Filtered Columns:**
- Problem: Queries filter on `recipes.nombre` (like search) and `meal_plans.fecha` range queries, but only indexes exist on `familia_id` and `fecha`
- Files: `shared/schema.ts` (recipe table definition), queries in `server/storage.ts`
- Cause: Full table scans on search, even with family filtering
- Improvement path: Add indexes on `recipes.nombre` and composite index for common filter combinations (family_id, fecha)

**Synchronous Password Hashing in Authentication:**
- Problem: Passport bcrypt operations are async but error handling assumes sync behavior in some paths
- Files: `server/auth/passport.ts` (lines 88-90, 113-114)
- Cause: Bcrypt operations can block event loop for a few milliseconds per user
- Improvement path: Ensure all bcrypt operations complete in worker threads (bcrypt already does this, but monitor with profiler)

**Family Lookup on Every Request:**
- Problem: Many routes call `storage.getUserFamilies(user.id)` repeatedly (lines 1217, 1257 in routes.ts) without caching
- Files: `server/routes.ts` (scattered getUserFamilies calls)
- Cause: Database query on every API call for endpoints that need family context
- Improvement path: Cache family ID in session after login. Update cache on family join/leave. Add to `req.user` object or middleware locals.

**Large Result Sets from `getMealCommentsByFamily`:**
- Problem: Query joins meal_comments with meal_plans without pagination (line 905 in storage.ts)
- Files: `server/storage.ts` (lines 899-921)
- Cause: Could return thousands of comments for active families, all in memory at once
- Improvement path: Add limit/offset parameters, or paginate in the route handler

## Fragile Areas

**Database Migration Scripts Are Manual:**
- Files: `scripts/migrate-multi-user.ts`, `migrations/003_fix_orphaned_data.sql`, `scripts/verify-migration.ts`, `scripts/run-production-migration.ts`
- Why fragile: Three separate scripts that must be run in order. No automation or integration with Drizzle migrations. Can fail partially and leave database in inconsistent state.
- Safe modification: Use Drizzle's native migration system. Create a single migration file per version. Automate verification in post-migration hook.
- Test coverage: Migration verification script is comprehensive but manual. No pre-deployment tests.

**Family Invitation Code Generation:**
- Files: `shared/utils.ts` (lines 4-55), `server/routes.ts` (code generation on family creation)
- Why fragile: Code format validation uses regex pattern (XXX-XXX) in three places separately. If pattern changes, must update everywhere. No centralized constant.
- Safe modification: Export `INVITATION_CODE_FORMAT` constant and use it in both validation and generation. Add unit tests for edge cases.
- Test coverage: No tests for code generation/validation currently

**Meal Plan Date Handling with Timezone Issues:**
- Files: `server/storage.ts` (lines 549-562 calculate end date), `server/routes.ts` (date string handling)
- Why fragile: Uses JavaScript `Date` objects with `.getDate()` which is timezone-sensitive. Dates stored as strings in ISO format (YYYY-MM-DD) but calculations are in local timezone.
- Safe modification: Use a date library (date-fns or Day.js) for all date operations. Use UTC consistently. Store all dates in ISO format.
- Test coverage: No tests for date boundary cases (end of month, daylight saving time transitions)

**Commentator Features Depend on Role:**
- Files: `server/routes.ts` (commentator endpoints like rating and comments), `shared/schema.ts` (role enum)
- Why fragile: Some endpoints check `role === "commentator"` but no validation that only commentators can use commentator features. Creator role can still create ratings/comments without explicit permission checks in routes.
- Safe modification: Create role-specific middleware that validates user.role matches endpoint requirements. Document which features require which roles.
- Test coverage: Security tests exist (tests/security/) but not fully documented what they verify

## Scaling Limits

**Single Family Per User:**
- Current capacity: Users can belong to exactly one family (enforced by uniqueIndex in schema line 47)
- Limit: If product expands to allow users in multiple families (e.g., main family + extended family group), database schema breaks
- Scaling path: Remove uniqueIndex, update all queries to accept familyId parameter instead of deriving from user. Add a "current family" field to user preferences.

**Connection Pool Size:**
- Current capacity: Pool has max 10 connections (server/db.ts line 16)
- Limit: With ~100 concurrent requests, many will wait for connections. Neon Serverless has different pooling behavior.
- Scaling path: Increase pool size based on Neon tier. Use PgBoss or similar for job queue to handle spikes.

**In-Memory Session Storage (Development):**
- Current capacity: MemStorage for sessions holds all sessions in memory
- Limit: Server restarts lose all sessions. Multiple server instances can't share sessions.
- Scaling path: Force PostgreSQL session store in production. Production config should validate this at startup.

**Recipe Image Storage:**
- Current capacity: Recipes store images as base64 or URLs (schema.ts line 56). Base64 images limited to 1MB in avatar schema (schema.ts line 512)
- Limit: 1000 recipes with 1MB images = 1GB database. No limit on recipe images.
- Scaling path: Move images to cloud storage (S3). Store only URL/key in database. Implement image CDN caching.

## Dependencies at Risk

**Passport.js Session Serialization:**
- Risk: Session strategy depends on passport session callback returning user object. If user is deleted from database, session still exists with stale user data
- Files: `server/auth/passport.ts` (lines 50-58)
- Impact: Deleted users might still access app if session isn't cleared. User profile changes don't reflect immediately.
- Migration plan: Add user version/timestamp to session. Validate user still exists on each request. Clear session on account deletion.

**Drizzle ORM Query Building:**
- Risk: Manual condition building with `and()` can return undefined/null, then used directly in `.where()` causing errors
- Files: `server/storage.ts` (scattered: `and(...conditions) ?? conditions` at lines 449, 461, 500, 518, 536, 566)
- Impact: Defensive null-coalescing exists but pattern is fragile - could break if Drizzle changes behavior
- Migration plan: Extract query-building logic to helper functions that guarantee non-null returns

**Zod Validation Library:**
- Risk: If Zod version is updated, validation behavior might change. Currently no version lock detailed.
- Files: `shared/schema.ts` (all createInsertSchema calls)
- Impact: Silent validation changes could break API contracts
- Migration plan: Pin Zod to exact version. Document validation rules separately. Add integration tests that verify expected validation failures.

## Missing Critical Features

**No Audit Logging:**
- Problem: No tracking of who changed recipes/meal plans/settings. Deletions are permanent without recovery.
- Blocks: Debugging user issues, rolling back mistakes, compliance audits
- Workaround: None - manual database inspection required

**No Bulk Operations:**
- Problem: Users must add recipes/meal plans one at a time. No import/export or copy-week feature
- Blocks: Power users, data migration, backup capabilities
- Workaround: Manual API calls or direct database manipulation

**No Soft Deletes:**
- Problem: Deletions are permanent. No undelete capability.
- Blocks: User recovery from accidental deletion, data archaeology
- Workaround: None - backups only

**No Search Pagination:**
- Problem: `searchRecipes()` returns all matching results without limit
- Blocks: Large recipe collections will return thousands of results to client
- Workaround: Frontend must manually filter/paginate results

## Test Coverage Gaps

**Recipe Creation and Validation:**
- What's not tested: Edge cases for recipe fields (empty strings, null values, very long names, special characters). Image upload size limits. Ingredient array handling.
- Files: `server/storage.ts` (createRecipe), `server/routes.ts` (POST /api/recipes)
- Risk: Invalid recipes could be created, affecting family's data
- Priority: Medium

**Family Invitation Code Uniqueness:**
- What's not tested: Code collision possibility. Code regeneration. Code format validation across all inputs.
- Files: `shared/utils.ts`, `server/routes.ts` (family creation/code regeneration)
- Risk: Duplicate codes could allow unintended family joins
- Priority: High

**Permission Boundary Testing:**
- What's not tested: Commentator can't create recipes. Commentator can rate but not modify creator-made recipes. Family isolation (user A can't access family B's data).
- Files: `server/routes.ts` (family-scoped endpoints)
- Risk: Authorization bypass, cross-family data exposure
- Priority: Critical - security tests exist but coverage unclear

**Meal Plan Date Filtering:**
- What's not tested: Week boundary conditions. Daylight saving time transitions. Leap years. Dates at month/year boundaries.
- Files: `server/storage.ts` (getMealPlansForWeek)
- Risk: Dates off by one, missing/duplicate meals during DST
- Priority: Medium

**Achievement Streak Calculation:**
- What's not tested: Feature is not fully implemented (hardcoded 0 return)
- Files: `server/storage.ts` (getUserStats)
- Risk: Streaks never work correctly
- Priority: Critical

**Migration Data Integrity:**
- What's not tested: Orphaned data is correctly assigned. No data loss. All foreign keys maintained.
- Files: `migrations/003_fix_orphaned_data.sql`
- Risk: Silent data corruption or loss during migration
- Priority: Critical - verification script exists but is manual

---

*Concerns audit: 2026-03-12*
