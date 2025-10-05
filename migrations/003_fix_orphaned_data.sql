-- ============================================================================
-- Migration 003: Fix Orphaned Recipes and Meal Plans
-- ============================================================================
-- Purpose: Assign familyId and createdBy to orphaned recipes and meal plans
-- Date: 2025-10-04
-- Issue: #45 - Production Database Migration
-- Dependencies: Requires 002_create_default_families.sql to be run first
-- Idempotent: Yes - can be run multiple times safely
-- ============================================================================

BEGIN;

-- Set transaction isolation level for consistency
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- ============================================================================
-- Check Prerequisites
-- ============================================================================

DO $$
DECLARE
    orphaned_users_count INTEGER;
BEGIN
    -- Ensure all users have families before proceeding
    SELECT COUNT(*) INTO orphaned_users_count
    FROM users u
    LEFT JOIN family_members fm ON u.id = fm.user_id
    WHERE fm.user_id IS NULL;

    IF orphaned_users_count > 0 THEN
        RAISE EXCEPTION 'PREREQUISITE FAILED: % users still without families. Run migration 002 first!', orphaned_users_count;
    END IF;

    RAISE NOTICE '✓ Prerequisite check passed: All users have family associations';
END $$;

-- ============================================================================
-- Log Migration Start
-- ============================================================================

INSERT INTO migration_log (migration_name, status, details)
VALUES ('003_fix_orphaned_data', 'started', jsonb_build_object(
    'description', 'Fixing orphaned recipes and meal plans',
    'started_at', NOW()
));

-- ============================================================================
-- PHASE 1: Fix Orphaned Recipes
-- ============================================================================

DO $$
DECLARE
    orphaned_recipe RECORD;
    target_family_id INTEGER;
    target_creator_id INTEGER;
    recipes_fixed INTEGER := 0;
    recipes_skipped INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE 'PHASE 1: Fixing Orphaned Recipes';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '';

    -- Process each recipe with NULL familyId
    FOR orphaned_recipe IN
        SELECT
            r.id,
            r.nombre,
            r.user_id,
            r.created_by,
            r.family_id,
            r.created_at
        FROM recipes r
        WHERE r.family_id IS NULL
        ORDER BY r.created_at
    LOOP
        target_family_id := NULL;
        target_creator_id := NULL;

        -- Strategy 1: Use createdBy if available
        IF orphaned_recipe.created_by IS NOT NULL THEN
            -- Get the family of the creator
            SELECT fm.family_id INTO target_family_id
            FROM family_members fm
            WHERE fm.user_id = orphaned_recipe.created_by
            LIMIT 1;

            target_creator_id := orphaned_recipe.created_by;

        -- Strategy 2: Use userId (backward compatibility field)
        ELSIF orphaned_recipe.user_id IS NOT NULL THEN
            -- Get the family of the user
            SELECT fm.family_id INTO target_family_id
            FROM family_members fm
            WHERE fm.user_id = orphaned_recipe.user_id
            LIMIT 1;

            target_creator_id := orphaned_recipe.user_id;

        -- Strategy 3: Assign to oldest family (fallback)
        ELSE
            -- Get the oldest family as fallback
            SELECT f.id, f.created_by INTO target_family_id, target_creator_id
            FROM families f
            ORDER BY f.created_at ASC
            LIMIT 1;

            RAISE WARNING 'Recipe #% ("%") has no owner. Assigned to oldest family #%',
                orphaned_recipe.id,
                orphaned_recipe.nombre,
                target_family_id;
        END IF;

        -- Update the recipe if we found a target family
        IF target_family_id IS NOT NULL THEN
            UPDATE recipes
            SET
                family_id = target_family_id,
                created_by = COALESCE(created_by, target_creator_id),
                user_id = COALESCE(user_id, target_creator_id),  -- Maintain backward compatibility
                updated_at = NOW()
            WHERE id = orphaned_recipe.id;

            recipes_fixed := recipes_fixed + 1;

            IF recipes_fixed <= 10 OR recipes_fixed % 100 = 0 THEN
                RAISE NOTICE '✓ Fixed recipe #%: "%" → Family #%',
                    orphaned_recipe.id,
                    LEFT(orphaned_recipe.nombre, 40),
                    target_family_id;
            END IF;
        ELSE
            recipes_skipped := recipes_skipped + 1;
            RAISE WARNING '⚠️  Could not assign recipe #% to any family!', orphaned_recipe.id;
        END IF;

    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE 'Recipe Migration Summary:';
    RAISE NOTICE '  • Recipes Fixed: %', recipes_fixed;
    RAISE NOTICE '  • Recipes Skipped: %', recipes_skipped;
    RAISE NOTICE '';

    -- Update migration log
    UPDATE migration_log
    SET details = details || jsonb_build_object(
        'recipes_fixed', recipes_fixed,
        'recipes_skipped', recipes_skipped
    )
    WHERE migration_name = '003_fix_orphaned_data'
    AND status = 'started';

END $$;

-- ============================================================================
-- PHASE 2: Fix Orphaned Meal Plans
-- ============================================================================

DO $$
DECLARE
    orphaned_meal_plan RECORD;
    target_family_id INTEGER;
    target_creator_id INTEGER;
    recipe_family_id INTEGER;
    meal_plans_fixed INTEGER := 0;
    meal_plans_skipped INTEGER := 0;
BEGIN
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE 'PHASE 2: Fixing Orphaned Meal Plans';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '';

    -- Process each meal plan with NULL familyId
    FOR orphaned_meal_plan IN
        SELECT
            mp.id,
            mp.fecha,
            mp.tipo_comida,
            mp.receta_id,
            mp.user_id,
            mp.created_by,
            mp.family_id,
            r.nombre as recipe_name,
            r.family_id as recipe_family_id
        FROM meal_plans mp
        LEFT JOIN recipes r ON mp.receta_id = r.id
        WHERE mp.family_id IS NULL
        ORDER BY mp.fecha DESC
    LOOP
        target_family_id := NULL;
        target_creator_id := NULL;

        -- Strategy 1: Use the recipe's family (meal plans should be in same family as recipe)
        IF orphaned_meal_plan.recipe_family_id IS NOT NULL THEN
            target_family_id := orphaned_meal_plan.recipe_family_id;

            -- Try to get creator from createdBy or userId
            IF orphaned_meal_plan.created_by IS NOT NULL THEN
                target_creator_id := orphaned_meal_plan.created_by;
            ELSIF orphaned_meal_plan.user_id IS NOT NULL THEN
                target_creator_id := orphaned_meal_plan.user_id;
            ELSE
                -- Use the recipe creator as fallback
                SELECT r.created_by INTO target_creator_id
                FROM recipes r
                WHERE r.id = orphaned_meal_plan.receta_id;
            END IF;

        -- Strategy 2: Use createdBy's family
        ELSIF orphaned_meal_plan.created_by IS NOT NULL THEN
            SELECT fm.family_id INTO target_family_id
            FROM family_members fm
            WHERE fm.user_id = orphaned_meal_plan.created_by
            LIMIT 1;

            target_creator_id := orphaned_meal_plan.created_by;

        -- Strategy 3: Use userId's family (backward compatibility)
        ELSIF orphaned_meal_plan.user_id IS NOT NULL THEN
            SELECT fm.family_id INTO target_family_id
            FROM family_members fm
            WHERE fm.user_id = orphaned_meal_plan.user_id
            LIMIT 1;

            target_creator_id := orphaned_meal_plan.user_id;

        -- Strategy 4: Assign to oldest family (last resort)
        ELSE
            SELECT f.id, f.created_by INTO target_family_id, target_creator_id
            FROM families f
            ORDER BY f.created_at ASC
            LIMIT 1;

            RAISE WARNING 'Meal plan #% (%) has no traceable owner. Assigned to oldest family #%',
                orphaned_meal_plan.id,
                orphaned_meal_plan.fecha,
                target_family_id;
        END IF;

        -- Update the meal plan if we found a target family
        IF target_family_id IS NOT NULL THEN
            UPDATE meal_plans
            SET
                family_id = target_family_id,
                created_by = COALESCE(created_by, target_creator_id),
                user_id = COALESCE(user_id, target_creator_id),  -- Maintain backward compatibility
                updated_at = NOW()
            WHERE id = orphaned_meal_plan.id;

            meal_plans_fixed := meal_plans_fixed + 1;

            IF meal_plans_fixed <= 10 OR meal_plans_fixed % 100 = 0 THEN
                RAISE NOTICE '✓ Fixed meal plan #% (% - %) → Family #%',
                    orphaned_meal_plan.id,
                    orphaned_meal_plan.fecha,
                    orphaned_meal_plan.tipo_comida,
                    target_family_id;
            END IF;
        ELSE
            meal_plans_skipped := meal_plans_skipped + 1;
            RAISE WARNING '⚠️  Could not assign meal plan #% to any family!', orphaned_meal_plan.id;
        END IF;

    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE 'Meal Plan Migration Summary:';
    RAISE NOTICE '  • Meal Plans Fixed: %', meal_plans_fixed;
    RAISE NOTICE '  • Meal Plans Skipped: %', meal_plans_skipped;
    RAISE NOTICE '';

    -- Update migration log
    UPDATE migration_log
    SET details = details || jsonb_build_object(
        'meal_plans_fixed', meal_plans_fixed,
        'meal_plans_skipped', meal_plans_skipped,
        'completed_at', NOW()
    )
    WHERE migration_name = '003_fix_orphaned_data'
    AND status = 'started';

END $$;

-- ============================================================================
-- PHASE 3: Verification
-- ============================================================================

DO $$
DECLARE
    orphaned_recipes_count INTEGER;
    orphaned_meal_plans_count INTEGER;
    recipes_missing_creator INTEGER;
    meal_plans_missing_creator INTEGER;
BEGIN
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE 'VERIFICATION: Checking Data Integrity';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '';

    -- Check for remaining orphaned recipes
    SELECT COUNT(*) INTO orphaned_recipes_count
    FROM recipes
    WHERE family_id IS NULL;

    -- Check for remaining orphaned meal plans
    SELECT COUNT(*) INTO orphaned_meal_plans_count
    FROM meal_plans
    WHERE family_id IS NULL;

    -- Check for recipes without creators
    SELECT COUNT(*) INTO recipes_missing_creator
    FROM recipes
    WHERE created_by IS NULL;

    -- Check for meal plans without creators
    SELECT COUNT(*) INTO meal_plans_missing_creator
    FROM meal_plans
    WHERE created_by IS NULL;

    -- Report results
    IF orphaned_recipes_count = 0 THEN
        RAISE NOTICE '✓ PASS: All recipes have familyId';
    ELSE
        RAISE WARNING '✗ FAIL: % recipes still without familyId', orphaned_recipes_count;
    END IF;

    IF orphaned_meal_plans_count = 0 THEN
        RAISE NOTICE '✓ PASS: All meal plans have familyId';
    ELSE
        RAISE WARNING '✗ FAIL: % meal plans still without familyId', orphaned_meal_plans_count;
    END IF;

    IF recipes_missing_creator = 0 THEN
        RAISE NOTICE '✓ PASS: All recipes have createdBy';
    ELSE
        RAISE WARNING '⚠️  WARNING: % recipes without createdBy (acceptable if legacy data)', recipes_missing_creator;
    END IF;

    IF meal_plans_missing_creator = 0 THEN
        RAISE NOTICE '✓ PASS: All meal plans have createdBy';
    ELSE
        RAISE WARNING '⚠️  WARNING: % meal plans without createdBy (acceptable if legacy data)', meal_plans_missing_creator;
    END IF;

    RAISE NOTICE '';

    -- Fail migration if critical orphaned data remains
    IF orphaned_recipes_count > 0 OR orphaned_meal_plans_count > 0 THEN
        RAISE EXCEPTION 'Migration verification failed: orphaned data remains';
    END IF;

    RAISE NOTICE '✓ VERIFICATION PASSED: All data has been migrated to families';
    RAISE NOTICE '';

END $$;

-- ============================================================================
-- Mark Migration as Completed
-- ============================================================================

UPDATE migration_log
SET status = 'completed'
WHERE migration_name = '003_fix_orphaned_data'
AND status = 'started';

DO $$
BEGIN
    RAISE NOTICE '✓ Migration 003 completed successfully!';
    RAISE NOTICE '';
END $$;

COMMIT;
