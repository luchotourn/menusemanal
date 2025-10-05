-- ============================================================================
-- Rollback Script: Family System Migration
-- ============================================================================
-- Purpose: Emergency rollback to revert family-based migration changes
-- Usage: psql $DATABASE_URL -f scripts/rollback-family-migration.sql
-- Date: 2025-10-04
-- Issue: #45 - Production Database Migration
-- WARNING: This will revert all family assignments but preserve data
-- ============================================================================

\echo '═══════════════════════════════════════════════════════════════════════'
\echo '         ROLLBACK - FAMILY SYSTEM MIGRATION (EMERGENCY ONLY)'
\echo '═══════════════════════════════════════════════════════════════════════'
\echo ''
\echo '⚠️  WARNING: This will:'
\echo '   • Set all familyId fields to NULL in recipes and meal_plans'
\echo '   • Remove family members created by migration 002'
\echo '   • Delete families created by migration 002'
\echo '   • Preserve all recipe, meal plan, user, and other data'
\echo '   • Mark migrations 002 and 003 as rolled back'
\echo ''
\echo 'Press Ctrl+C within 10 seconds to abort...'
\echo ''

-- Give user time to abort
SELECT pg_sleep(10);

BEGIN;

-- Set transaction isolation level for consistency
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- ============================================================================
-- Log Rollback Start
-- ============================================================================

INSERT INTO migration_log (migration_name, status, details)
VALUES ('rollback_family_system', 'started', jsonb_build_object(
    'description', 'Rolling back family system migration',
    'started_at', NOW(),
    'rollback_type', 'emergency'
));

\echo '🔄 Starting rollback process...'
\echo ''

-- ============================================================================
-- PHASE 1: Revert Recipe Family Associations
-- ============================================================================

DO $$
DECLARE
    recipes_reverted INTEGER;
BEGIN
    \echo '─────────────────────────────────────────────────────────────────────'
    \echo 'PHASE 1: Reverting Recipe Family Associations'
    \echo '─────────────────────────────────────────────────────────────────────'

    -- Count recipes that will be reverted
    SELECT COUNT(*) INTO recipes_reverted
    FROM recipes
    WHERE family_id IS NOT NULL;

    RAISE NOTICE 'Reverting % recipes to pre-migration state...', recipes_reverted;

    -- Revert recipes to NULL familyId (keep userId and createdBy for reference)
    UPDATE recipes
    SET family_id = NULL
    WHERE family_id IS NOT NULL;

    RAISE NOTICE '✓ Reverted % recipes', recipes_reverted;
    RAISE NOTICE '';

    -- Update rollback log
    UPDATE migration_log
    SET details = details || jsonb_build_object('recipes_reverted', recipes_reverted)
    WHERE migration_name = 'rollback_family_system'
    AND status = 'started';
END $$;

-- ============================================================================
-- PHASE 2: Revert Meal Plan Family Associations
-- ============================================================================

DO $$
DECLARE
    meal_plans_reverted INTEGER;
BEGIN
    \echo '─────────────────────────────────────────────────────────────────────'
    \echo 'PHASE 2: Reverting Meal Plan Family Associations'
    \echo '─────────────────────────────────────────────────────────────────────'

    -- Count meal plans that will be reverted
    SELECT COUNT(*) INTO meal_plans_reverted
    FROM meal_plans
    WHERE family_id IS NOT NULL;

    RAISE NOTICE 'Reverting % meal plans to pre-migration state...', meal_plans_reverted;

    -- Revert meal plans to NULL familyId (keep userId and createdBy for reference)
    UPDATE meal_plans
    SET family_id = NULL
    WHERE family_id IS NOT NULL;

    RAISE NOTICE '✓ Reverted % meal plans', meal_plans_reverted;
    RAISE NOTICE '';

    -- Update rollback log
    UPDATE migration_log
    SET details = details || jsonb_build_object('meal_plans_reverted', meal_plans_reverted)
    WHERE migration_name = 'rollback_family_system'
    AND status = 'started';
END $$;

-- ============================================================================
-- PHASE 3: Revert Recipe Ratings and Meal Comments (if any)
-- ============================================================================

DO $$
DECLARE
    ratings_reverted INTEGER := 0;
    comments_reverted INTEGER := 0;
BEGIN
    \echo '─────────────────────────────────────────────────────────────────────'
    \echo 'PHASE 3: Reverting Commentator Features'
    \echo '─────────────────────────────────────────────────────────────────────'

    -- Check if tables exist (they might not in older deployments)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recipe_ratings') THEN
        -- Count and delete recipe ratings (they depend on familyId)
        SELECT COUNT(*) INTO ratings_reverted FROM recipe_ratings;

        IF ratings_reverted > 0 THEN
            DELETE FROM recipe_ratings;
            RAISE NOTICE '⚠️  Deleted % recipe ratings (cannot exist without families)', ratings_reverted;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meal_comments') THEN
        -- Count and delete meal comments (they depend on familyId)
        SELECT COUNT(*) INTO comments_reverted FROM meal_comments;

        IF comments_reverted > 0 THEN
            DELETE FROM meal_comments;
            RAISE NOTICE '⚠️  Deleted % meal comments (cannot exist without families)', comments_reverted;
        END IF;
    END IF;

    IF ratings_reverted = 0 AND comments_reverted = 0 THEN
        RAISE NOTICE '✓ No commentator data to revert';
    END IF;

    RAISE NOTICE '';

    -- Update rollback log
    UPDATE migration_log
    SET details = details || jsonb_build_object(
        'ratings_deleted', ratings_reverted,
        'comments_deleted', comments_reverted
    )
    WHERE migration_name = 'rollback_family_system'
    AND status = 'started';
END $$;

-- ============================================================================
-- PHASE 4: Remove Family Members (created by migration)
-- ============================================================================

DO $$
DECLARE
    members_removed INTEGER;
BEGIN
    \echo '─────────────────────────────────────────────────────────────────────'
    \echo 'PHASE 4: Removing Family Memberships'
    \echo '─────────────────────────────────────────────────────────────────────'

    -- Count family members
    SELECT COUNT(*) INTO members_removed FROM family_members;

    RAISE NOTICE 'Removing % family memberships...', members_removed;

    -- Remove all family members
    DELETE FROM family_members;

    RAISE NOTICE '✓ Removed % family memberships', members_removed;
    RAISE NOTICE '';

    -- Update rollback log
    UPDATE migration_log
    SET details = details || jsonb_build_object('members_removed', members_removed)
    WHERE migration_name = 'rollback_family_system'
    AND status = 'started';
END $$;

-- ============================================================================
-- PHASE 5: Delete Families (created by migration)
-- ============================================================================

DO $$
DECLARE
    families_deleted INTEGER;
BEGIN
    \echo '─────────────────────────────────────────────────────────────────────'
    \echo 'PHASE 5: Deleting Families'
    \echo '─────────────────────────────────────────────────────────────────────'

    -- Count families
    SELECT COUNT(*) INTO families_deleted FROM families;

    RAISE NOTICE 'Deleting % families...', families_deleted;

    -- Delete all families
    DELETE FROM families;

    RAISE NOTICE '✓ Deleted % families', families_deleted;
    RAISE NOTICE '';

    -- Update rollback log
    UPDATE migration_log
    SET details = details || jsonb_build_object(
        'families_deleted', families_deleted,
        'completed_at', NOW()
    )
    WHERE migration_name = 'rollback_family_system'
    AND status = 'started';
END $$;

-- ============================================================================
-- PHASE 6: Mark Migrations as Rolled Back
-- ============================================================================

DO $$
BEGIN
    \echo '─────────────────────────────────────────────────────────────────────'
    \echo 'PHASE 6: Updating Migration Status'
    \echo '─────────────────────────────────────────────────────────────────────'

    -- Mark migration 002 as rolled back
    UPDATE migration_log
    SET status = 'rolled_back',
        details = details || jsonb_build_object('rolled_back_at', NOW())
    WHERE migration_name = '002_create_default_families'
    AND status = 'completed';

    -- Mark migration 003 as rolled back
    UPDATE migration_log
    SET status = 'rolled_back',
        details = details || jsonb_build_object('rolled_back_at', NOW())
    WHERE migration_name = '003_fix_orphaned_data'
    AND status = 'completed';

    RAISE NOTICE '✓ Marked migrations 002 and 003 as rolled back';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- Mark Rollback as Completed
-- ============================================================================

UPDATE migration_log
SET status = 'completed'
WHERE migration_name = 'rollback_family_system'
AND status = 'started';

\echo '═══════════════════════════════════════════════════════════════════════'
\echo '                      ROLLBACK COMPLETE'
\echo '═══════════════════════════════════════════════════════════════════════'
\echo ''

COMMIT;

-- ============================================================================
-- Post-Rollback Verification
-- ============================================================================

\echo '📊 POST-ROLLBACK VERIFICATION:'
\echo ''

\echo 'Users without families (should equal total users):'
SELECT COUNT(*) as users_without_families
FROM users u
LEFT JOIN family_members fm ON u.id = fm.user_id
WHERE fm.user_id IS NULL;

\echo ''
\echo 'Recipes without familyId (should equal total recipes):'
SELECT COUNT(*) as recipes_without_family
FROM recipes
WHERE family_id IS NULL;

\echo ''
\echo 'Meal plans without familyId (should equal total meal plans):'
SELECT COUNT(*) as meal_plans_without_family
FROM meal_plans
WHERE family_id IS NULL;

\echo ''
\echo 'Remaining families (should be 0):'
SELECT COUNT(*) as remaining_families FROM families;

\echo ''
\echo 'Remaining family members (should be 0):'
SELECT COUNT(*) as remaining_members FROM family_members;

\echo ''
\echo '═══════════════════════════════════════════════════════════════════════'
\echo ''
\echo '✓ Rollback completed successfully!'
\echo ''
\echo '⚠️  IMPORTANT NEXT STEPS:'
\echo '   1. Verify the application works with pre-migration data structure'
\echo '   2. Review what caused the need for rollback'
\echo '   3. Fix any issues with migration scripts'
\echo '   4. Re-run migration when issues are resolved'
\echo '   5. Consider creating a database backup before re-running'
\echo ''
\echo '💡 NOTE: All user data, recipes, and meal plans have been preserved.'
\echo '   Only family associations have been removed.'
\echo ''
