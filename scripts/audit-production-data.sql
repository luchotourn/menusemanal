-- ============================================================================
-- Pre-Migration Audit Script
-- ============================================================================
-- Purpose: Assess production database state before family-based migration
-- Usage: psql $DATABASE_URL -f scripts/audit-production-data.sql
-- Date: 2025-10-04
-- Issue: #45 - Production Database Migration
-- ============================================================================

\echo '═══════════════════════════════════════════════════════════════════════'
\echo '         PRE-MIGRATION AUDIT - FAMILY SYSTEM MIGRATION'
\echo '═══════════════════════════════════════════════════════════════════════'
\echo ''

-- ============================================================================
-- SECTION 1: USER ANALYSIS
-- ============================================================================
\echo '📊 SECTION 1: USER ANALYSIS'
\echo '─────────────────────────────────────────────────────────────────────'
\echo ''

\echo '1.1 Total Users in System:'
SELECT COUNT(*) as total_users FROM users;
\echo ''

\echo '1.2 Users by Role:'
SELECT
    role,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM users), 2) as percentage
FROM users
GROUP BY role
ORDER BY count DESC;
\echo ''

\echo '1.3 Users WITHOUT Family Association (CRITICAL - WILL BE MIGRATED):'
SELECT COUNT(*) as orphaned_users
FROM users u
LEFT JOIN family_members fm ON u.id = fm.user_id
WHERE fm.user_id IS NULL;
\echo ''

\echo '1.4 Orphaned User Details:'
SELECT
    u.id,
    u.email,
    u.name,
    u.role,
    u.created_at
FROM users u
LEFT JOIN family_members fm ON u.id = fm.user_id
WHERE fm.user_id IS NULL
ORDER BY u.created_at;
\echo ''

-- ============================================================================
-- SECTION 2: FAMILY STRUCTURE ANALYSIS
-- ============================================================================
\echo '📊 SECTION 2: FAMILY STRUCTURE ANALYSIS'
\echo '─────────────────────────────────────────────────────────────────────'
\echo ''

\echo '2.1 Total Families:'
SELECT COUNT(*) as total_families FROM families;
\echo ''

\echo '2.2 Existing Families with Members:'
SELECT
    f.id,
    f.nombre,
    f.codigo_invitacion,
    f.created_at,
    COUNT(fm.user_id) as member_count
FROM families f
LEFT JOIN family_members fm ON f.id = fm.family_id
GROUP BY f.id, f.nombre, f.codigo_invitacion, f.created_at
ORDER BY f.created_at;
\echo ''

\echo '2.3 Family Size Distribution:'
SELECT
    member_count,
    COUNT(*) as families_with_this_size
FROM (
    SELECT
        f.id,
        COUNT(fm.user_id) as member_count
    FROM families f
    LEFT JOIN family_members fm ON f.id = fm.family_id
    GROUP BY f.id
) family_sizes
GROUP BY member_count
ORDER BY member_count;
\echo ''

-- ============================================================================
-- SECTION 3: RECIPE DATA ANALYSIS
-- ============================================================================
\echo '📊 SECTION 3: RECIPE DATA ANALYSIS'
\echo '─────────────────────────────────────────────────────────────────────'
\echo ''

\echo '3.1 Total Recipes:'
SELECT COUNT(*) as total_recipes FROM recipes;
\echo ''

\echo '3.2 Recipes with NULL familyId (CRITICAL - WILL BE MIGRATED):'
SELECT COUNT(*) as orphaned_recipes
FROM recipes
WHERE family_id IS NULL;
\echo ''

\echo '3.3 Recipes with NULL createdBy:'
SELECT COUNT(*) as recipes_without_creator
FROM recipes
WHERE created_by IS NULL;
\echo ''

\echo '3.4 Recipes with NULL userId (backward compatibility field):'
SELECT COUNT(*) as recipes_without_userId
FROM recipes
WHERE user_id IS NULL;
\echo ''

\echo '3.5 Recipe Data Quality Summary:'
SELECT
    CASE
        WHEN family_id IS NOT NULL AND created_by IS NOT NULL THEN 'Complete (family + creator)'
        WHEN family_id IS NULL AND created_by IS NOT NULL THEN 'Missing family only'
        WHEN family_id IS NOT NULL AND created_by IS NULL THEN 'Missing creator only'
        WHEN user_id IS NOT NULL THEN 'Legacy format (userId only)'
        ELSE 'Orphaned (no ownership)'
    END as data_status,
    COUNT(*) as count
FROM recipes
GROUP BY data_status
ORDER BY count DESC;
\echo ''

\echo '3.6 Orphaned Recipe Details (will be assigned to families):'
SELECT
    r.id,
    r.nombre,
    r.categoria,
    r.user_id,
    r.created_by,
    r.family_id,
    r.created_at
FROM recipes r
WHERE r.family_id IS NULL
ORDER BY r.created_at
LIMIT 20;
\echo ''

-- ============================================================================
-- SECTION 4: MEAL PLAN DATA ANALYSIS
-- ============================================================================
\echo '📊 SECTION 4: MEAL PLAN DATA ANALYSIS'
\echo '─────────────────────────────────────────────────────────────────────'
\echo ''

\echo '4.1 Total Meal Plans:'
SELECT COUNT(*) as total_meal_plans FROM meal_plans;
\echo ''

\echo '4.2 Meal Plans with NULL familyId (CRITICAL - WILL BE MIGRATED):'
SELECT COUNT(*) as orphaned_meal_plans
FROM meal_plans
WHERE family_id IS NULL;
\echo ''

\echo '4.3 Meal Plans with NULL createdBy:'
SELECT COUNT(*) as meal_plans_without_creator
FROM meal_plans
WHERE created_by IS NULL;
\echo ''

\echo '4.4 Meal Plan Data Quality Summary:'
SELECT
    CASE
        WHEN family_id IS NOT NULL AND created_by IS NOT NULL THEN 'Complete (family + creator)'
        WHEN family_id IS NULL AND created_by IS NOT NULL THEN 'Missing family only'
        WHEN family_id IS NOT NULL AND created_by IS NULL THEN 'Missing creator only'
        WHEN user_id IS NOT NULL THEN 'Legacy format (userId only)'
        ELSE 'Orphaned (no ownership)'
    END as data_status,
    COUNT(*) as count
FROM meal_plans
GROUP BY data_status
ORDER BY count DESC;
\echo ''

\echo '4.5 Recent Orphaned Meal Plans (sample):'
SELECT
    mp.id,
    mp.fecha,
    mp.tipo_comida,
    mp.user_id,
    mp.created_by,
    mp.family_id,
    r.nombre as receta_nombre
FROM meal_plans mp
LEFT JOIN recipes r ON mp.receta_id = r.id
WHERE mp.family_id IS NULL
ORDER BY mp.fecha DESC
LIMIT 20;
\echo ''

-- ============================================================================
-- SECTION 5: COMMENTATOR FEATURES ANALYSIS
-- ============================================================================
\echo '📊 SECTION 5: COMMENTATOR FEATURES (RECIPE RATINGS & COMMENTS)'
\echo '─────────────────────────────────────────────────────────────────────'
\echo ''

\echo '5.1 Recipe Ratings:'
SELECT COUNT(*) as total_ratings FROM recipe_ratings;
\echo ''

\echo '5.2 Meal Comments:'
SELECT COUNT(*) as total_comments FROM meal_comments;
\echo ''

\echo '5.3 Recipe Ratings by Family (should all have familyId):'
SELECT
    CASE
        WHEN family_id IS NOT NULL THEN 'Has family'
        ELSE 'Missing family (ERROR)'
    END as status,
    COUNT(*) as count
FROM recipe_ratings
GROUP BY status;
\echo ''

\echo '5.4 Meal Comments by Family (should all have familyId):'
SELECT
    CASE
        WHEN family_id IS NOT NULL THEN 'Has family'
        ELSE 'Missing family (ERROR)'
    END as status,
    COUNT(*) as count
FROM meal_comments
GROUP BY status;
\echo ''

-- ============================================================================
-- SECTION 6: FOREIGN KEY INTEGRITY CHECK
-- ============================================================================
\echo '📊 SECTION 6: FOREIGN KEY INTEGRITY ANALYSIS'
\echo '─────────────────────────────────────────────────────────────────────'
\echo ''

\echo '6.1 Recipes with Invalid userId References:'
SELECT COUNT(*) as invalid_user_refs
FROM recipes r
WHERE r.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.user_id);
\echo ''

\echo '6.2 Recipes with Invalid createdBy References:'
SELECT COUNT(*) as invalid_creator_refs
FROM recipes r
WHERE r.created_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.created_by);
\echo ''

\echo '6.3 Meal Plans with Invalid Recipe References:'
SELECT COUNT(*) as invalid_recipe_refs
FROM meal_plans mp
WHERE mp.receta_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM recipes r WHERE r.id = mp.receta_id);
\echo ''

-- ============================================================================
-- SECTION 7: MIGRATION READINESS SUMMARY
-- ============================================================================
\echo '📊 SECTION 7: MIGRATION READINESS SUMMARY'
\echo '─────────────────────────────────────────────────────────────────────'
\echo ''

\echo '✓ MIGRATION ACTION ITEMS:'
\echo ''

-- Calculate values for summary
WITH migration_stats AS (
    SELECT
        (SELECT COUNT(*) FROM users u
         LEFT JOIN family_members fm ON u.id = fm.user_id
         WHERE fm.user_id IS NULL) as orphaned_users,
        (SELECT COUNT(*) FROM recipes WHERE family_id IS NULL) as orphaned_recipes,
        (SELECT COUNT(*) FROM meal_plans WHERE family_id IS NULL) as orphaned_meal_plans,
        (SELECT COUNT(*) FROM families) as existing_families
)
SELECT
    '• Users needing family assignment: ' || orphaned_users as action_1,
    '• Recipes to migrate: ' || orphaned_recipes as action_2,
    '• Meal plans to migrate: ' || orphaned_meal_plans as action_3,
    '• Families already created: ' || existing_families as action_4
FROM migration_stats;

\echo ''
\echo '═══════════════════════════════════════════════════════════════════════'
\echo '                      AUDIT COMPLETE'
\echo '═══════════════════════════════════════════════════════════════════════'
\echo ''
\echo '⚠️  NEXT STEPS:'
\echo '   1. Review the orphaned data counts above'
\echo '   2. Ensure production database backup is current'
\echo '   3. Run migration: npm run migrate:production'
\echo ''
