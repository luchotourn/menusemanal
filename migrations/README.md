# Database Migration Guide - Family System

This directory contains critical database migration scripts for transitioning the Menu Familiar application to a family-based multi-user system.

**⚠️ CRITICAL: These migrations are required before deploying Epic 5 (Gamification features)**

## 📋 Overview

**Issue:** [#45 - Production Database Migration](https://github.com/luchotourn/menusemanal/issues/45)

During Epic 4 implementation, we discovered that orphaned records (recipes and meal plans without `familyId`) become invisible after deploying family-scoped queries. This migration ensures all existing data is properly associated with families.

### Migration Goals

1. ✅ Create default families for users without family associations
2. ✅ Assign all orphaned recipes to appropriate families
3. ✅ Assign all orphaned meal plans to appropriate families
4. ✅ Verify data integrity and foreign key constraints
5. ✅ Enable rollback capability for emergency recovery

---

## 🗂️ Migration Files

### SQL Migrations (Execute in Order)

1. **`0001_add_multi_user_schema.sql`** *(Already deployed)*
   - Creates `families` and `family_members` tables
   - Adds family-related columns to `recipes` and `meal_plans`
   - ✅ Status: Completed during Epic 4

2. **`002_create_default_families.sql`** *(NEW - Production Migration)*
   - Creates "Familia Principal" for each user without a family
   - Generates unique invitation codes
   - Adds users to `family_members` table
   - **Idempotent:** Can be run multiple times safely

3. **`003_fix_orphaned_data.sql`** *(NEW - Production Migration)*
   - Assigns `familyId` to recipes without family association
   - Assigns `familyId` to meal plans without family association
   - Updates `createdBy` fields for ownership tracking
   - **Idempotent:** Can be run multiple times safely

### TypeScript Scripts (Orchestration)

4. **`scripts/run-production-migration.ts`**
   - Main orchestration script with safety checks
   - Runs pre-audit, executes migrations, verifies results
   - Interactive prompts for backup confirmation

5. **`scripts/verify-migration.ts`**
   - Post-migration validation script
   - Checks for orphaned records and data integrity
   - Can be run independently: `npm run migrate:verify`

6. **`scripts/audit-production-data.sql`**
   - Read-only audit script (safe to run anytime)
   - Reports orphaned users, recipes, and meal plans
   - Use before migration to assess scope

7. **`scripts/rollback-family-migration.sql`**
   - Emergency rollback script
   - Reverts `familyId` assignments (preserves data)
   - **⚠️ USE ONLY IF CRITICAL ISSUES ARISE**

---

## 🚀 Quick Start - Production Migration

### Prerequisites

- [ ] Database backup created
- [ ] Issue #38 (role-based permissions) merged and deployed
- [ ] Production `DATABASE_URL` environment variable set
- [ ] `psql` CLI tool installed (for rollback if needed)

### Step 1: Audit Current Data

```bash
npm run migrate:audit
```

This shows how many orphaned records exist and what will be migrated.

### Step 2: Run Production Migration

```bash
npm run migrate:production
```

This interactive script will:
1. Check prerequisites
2. Run pre-migration audit
3. **Prompt for backup confirmation** ⚠️
4. Execute migrations 002 and 003
5. Verify data integrity
6. Generate migration report

**Estimated time:** 5-15 minutes

### Step 3: Verify Migration Success

```bash
npm run migrate:verify
```

Should report:
- ✓ All users have families: 0 orphaned
- ✓ All recipes have familyId: 0 orphaned
- ✓ All meal plans have familyId: 0 orphaned

---

## 📊 Migration Commands Reference

```bash
# RECOMMENDED: Run full automated migration
npm run migrate:production

# Audit database before migration (read-only, safe)
npm run migrate:audit

# Verify migration completed successfully
npm run migrate:verify

# EMERGENCY ONLY: Rollback family system migration
npm run migrate:rollback
```

---

## 🔍 Migration Process Details

### Phase 1: Default Family Creation (`002_create_default_families.sql`)

**What it does:**
- Finds all users without family membership
- Creates a family named "Familia Principal" for each
- Generates unique 8-character invitation code (e.g., `FAM1A2B3`)
- Adds user to `family_members` table with their new family

**Safety features:**
- Checks if migration already completed (idempotent)
- Uses database transactions (all-or-nothing)
- Logs progress to `migration_log` table
- Verifies zero orphaned users at completion

**Example output:**
```
✓ Created family #42 for user: María García (maria@example.com, role: creator)
  └─ Invitation Code: FAMA1B2C
```

### Phase 2: Orphaned Data Fix (`003_fix_orphaned_data.sql`)

**What it does:**

**For Recipes:**
1. Try to use `createdBy` field → find user's family
2. Fallback to `userId` field → find user's family
3. Last resort: assign to oldest family in database

**For Meal Plans:**
1. Try to use associated recipe's `familyId` (preferred)
2. Fallback to `createdBy` → find user's family
3. Fallback to `userId` → find user's family
4. Last resort: assign to oldest family

**Safety features:**
- Prerequisite check: fails if users still without families
- Maintains `userId` and `createdBy` fields (backward compatibility)
- Comprehensive verification at end
- Transaction-based execution

**Example output:**
```
✓ Fixed recipe #123: "Pasta Carbonara" → Family #5
✓ Fixed meal plan #456 (2025-09-15 - almuerzo) → Family #5
```

---

## 🔄 Rollback Procedure

**⚠️ WARNING: Only use rollback if critical production issues arise!**

### When to Rollback

- Authentication failures preventing user login
- Data access errors (recipes/meal plans not loading)
- Database constraint violations
- Critical application errors related to family system

### How to Rollback

```bash
npm run migrate:rollback
```

This will:
1. ⏸️ Give you 10 seconds to cancel (Ctrl+C)
2. Set all `familyId` fields to `NULL` in recipes and meal plans
3. Remove family memberships from `family_members`
4. Delete families created by migration
5. Mark migrations as "rolled_back" in log
6. **Preserve all user data, recipes, and meal plans**

### After Rollback

1. Investigate root cause of issues
2. Fix migration scripts or application code
3. Create new database backup
4. Re-run migration when ready

---

## 📈 Migration Statistics

Track migration progress in the `migration_log` table:

```sql
SELECT
  migration_name,
  status,
  executed_at,
  details
FROM migration_log
WHERE migration_name IN (
  '002_create_default_families',
  '003_fix_orphaned_data',
  'rollback_family_system'
)
ORDER BY executed_at DESC;
```

---

## 🛡️ Safety & Best Practices

### Before Migration

✅ **Create database backup:**
```bash
# Neon database backup (if using Neon)
# Use Neon dashboard: Database → Backup

# Or pg_dump for local/other providers
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

✅ **Test on staging environment first**
- Clone production database to staging
- Run full migration process
- Verify application functionality
- Test with production-like data volume

✅ **Schedule maintenance window**
- Notify users of brief downtime (5-15 min)
- Choose low-traffic time period
- Have rollback plan ready

### During Migration

✅ **Monitor progress:**
- Watch migration logs in terminal
- Check for warnings or errors
- Note generated invitation codes

✅ **Don't interrupt:**
- Migration uses database transactions
- Interrupting may leave database in inconsistent state
- Let it complete fully

### After Migration

✅ **Verify application functionality:**
- [ ] Users can log in
- [ ] Recipes display in family context
- [ ] Meal plans load correctly
- [ ] Family invitation system works
- [ ] No console errors or 500 responses

✅ **Monitor logs:**
```bash
# Application logs
tail -f logs/app.log

# Check for family-related errors
grep -i "family" logs/app.log | grep -i "error"
```

---

## 🐛 Troubleshooting

### Issue: "Users without families" error

**Cause:** Migration 002 didn't complete successfully

**Solution:**
```bash
# Check migration log
psql $DATABASE_URL -c "SELECT * FROM migration_log WHERE migration_name = '002_create_default_families'"

# Re-run migration (it's idempotent)
npm run migrate:production
```

### Issue: "Recipes still have NULL familyId"

**Cause:** Migration 003 failed or was interrupted

**Solution:**
```bash
# Check how many orphaned
psql $DATABASE_URL -c "SELECT COUNT(*) FROM recipes WHERE family_id IS NULL"

# Re-run migration 003 specifically
psql $DATABASE_URL -f migrations/003_fix_orphaned_data.sql
```

### Issue: "Duplicate invitation codes"

**Cause:** Race condition or manual data entry

**Solution:**
```bash
# Find duplicates
psql $DATABASE_URL -c "
  SELECT codigo_invitacion, COUNT(*)
  FROM families
  GROUP BY codigo_invitacion
  HAVING COUNT(*) > 1
"

# Generate new unique codes for duplicates
# (Contact development team for script)
```

### Issue: Application shows "No recipes" after migration

**Cause:** Family-scoped queries filtering out recipes

**Solution:**
```bash
# Verify user has family membership
psql $DATABASE_URL -c "
  SELECT u.email, fm.family_id
  FROM users u
  LEFT JOIN family_members fm ON u.id = fm.user_id
  WHERE u.email = 'user@example.com'
"

# Verify recipes belong to same family
psql $DATABASE_URL -c "
  SELECT r.nombre, r.family_id, fm.family_id as user_family
  FROM recipes r, family_members fm, users u
  WHERE u.email = 'user@example.com'
    AND fm.user_id = u.id
"
```

---

## 📞 Support & Resources

- **Issue Tracker:** [GitHub Issue #45](https://github.com/luchotourn/menusemanal/issues/45)
- **Related Issues:**
  - #38: Role-based permissions
  - #32: Multi-user database schema
  - #33: Family management system
- **Documentation:** `/docs/family-system.md`
- **Architecture:** `shared/schema.ts` (lines 24-49)

---

## 🎯 Success Criteria

Migration is complete when:

- [x] All users belong to exactly one family
- [x] All recipes have valid `familyId` and `createdBy`
- [x] All meal plans have valid `familyId` and `createdBy`
- [x] No orphaned records in any table
- [x] All families have unique invitation codes
- [x] Historical data remains accessible
- [x] Users can login and access their data
- [x] Family invitation system works
- [x] Application functions normally

---

## 🔐 Security Notes

- Migration scripts use parameterized queries (safe from SQL injection)
- All database operations are transactional
- Rollback capability ensures data safety
- Family invitation codes are cryptographically random
- No sensitive data is logged or exposed

---

## 📝 Migration Log Schema

```sql
CREATE TABLE migration_log (
    id SERIAL PRIMARY KEY,
    migration_name TEXT NOT NULL,
    executed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL, -- 'started', 'completed', 'rolled_back', 'failed'
    details JSONB        -- Stores migration statistics and metadata
);
```

**Example log entry:**
```json
{
  "migration_name": "002_create_default_families",
  "status": "completed",
  "details": {
    "users_processed": 15,
    "families_created": 15,
    "started_at": "2025-10-04T12:00:00Z",
    "completed_at": "2025-10-04T12:01:30Z"
  }
}
```

---

## 🏁 Next Steps After Migration

1. **Tag Release:**
   ```bash
   git tag v2.1-family-system
   git push origin v2.1-family-system
   ```

2. **Update Documentation:**
   - Mark Issue #45 as complete
   - Update CHANGELOG.md
   - Document any edge cases encountered

3. **Enable Epic 5 Features:**
   - Recipe rating system (Issue #34)
   - Gamification badges
   - Commentator progress tracking

4. **Monitor Production:**
   - Watch error rates for 48 hours
   - Check user feedback channels
   - Review database performance metrics

---

**Last Updated:** 2025-10-04
**Maintainer:** Development Team
**Status:** Ready for Production Deployment
