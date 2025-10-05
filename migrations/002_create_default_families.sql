-- ============================================================================
-- Migration 002: Create Default Families for Orphaned Users
-- ============================================================================
-- Purpose: Create a default family for each user without family association
-- Date: 2025-10-04
-- Issue: #45 - Production Database Migration
-- Dependencies: Requires 0001_add_multi_user_schema.sql to be run first
-- Idempotent: Yes - can be run multiple times safely
-- ============================================================================

BEGIN;

-- Set transaction isolation level for consistency
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- ============================================================================
-- Create Migration Tracking Table (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS migration_log (
    id SERIAL PRIMARY KEY,
    migration_name TEXT NOT NULL,
    executed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL,
    details JSONB
);

-- Check if this migration has already been run
DO $$
DECLARE
    migration_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM migration_log
        WHERE migration_name = '002_create_default_families'
        AND status = 'completed'
    ) INTO migration_exists;

    IF migration_exists THEN
        RAISE NOTICE '✓ Migration 002 already completed. Skipping...';
        -- Exit the transaction
        ROLLBACK;
        RETURN;
    END IF;
END $$;

-- ============================================================================
-- Log Migration Start
-- ============================================================================
INSERT INTO migration_log (migration_name, status, details)
VALUES ('002_create_default_families', 'started', jsonb_build_object(
    'description', 'Creating default families for orphaned users',
    'started_at', NOW()
));

-- ============================================================================
-- Create Default Families for Orphaned Users
-- ============================================================================

DO $$
DECLARE
    orphaned_user RECORD;
    new_family_id INTEGER;
    unique_code TEXT;
    families_created INTEGER := 0;
    users_processed INTEGER := 0;
BEGIN
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE 'Starting Default Family Creation for Orphaned Users';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '';

    -- Loop through each user without a family
    FOR orphaned_user IN
        SELECT u.id, u.email, u.name, u.role, u.created_at
        FROM users u
        LEFT JOIN family_members fm ON u.id = fm.user_id
        WHERE fm.user_id IS NULL
        ORDER BY u.created_at
    LOOP
        users_processed := users_processed + 1;

        -- Generate a unique 8-character invitation code
        LOOP
            unique_code := 'FAM' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || orphaned_user.id::TEXT), 1, 5));

            -- Check if code is unique
            EXIT WHEN NOT EXISTS (
                SELECT 1 FROM families WHERE codigo_invitacion = unique_code
            );
        END LOOP;

        -- Create the family for this user
        INSERT INTO families (nombre, codigo_invitacion, created_by, created_at)
        VALUES (
            'Familia Principal',  -- Default family name
            unique_code,
            orphaned_user.id,
            NOW()
        )
        RETURNING id INTO new_family_id;

        -- Add the user to their new family
        INSERT INTO family_members (family_id, user_id, joined_at)
        VALUES (new_family_id, orphaned_user.id, NOW())
        ON CONFLICT (user_id) DO NOTHING;  -- Skip if already in a family (safety check)

        families_created := families_created + 1;

        RAISE NOTICE '✓ Created family #% for user: % (%, role: %)',
            new_family_id,
            orphaned_user.name,
            orphaned_user.email,
            orphaned_user.role;
        RAISE NOTICE '  └─ Invitation Code: %', unique_code;
        RAISE NOTICE '';

    END LOOP;

    -- Summary
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE 'Default Family Creation Summary:';
    RAISE NOTICE '  • Users Processed: %', users_processed;
    RAISE NOTICE '  • Families Created: %', families_created;
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '';

    -- Update migration log with results
    UPDATE migration_log
    SET details = details || jsonb_build_object(
        'users_processed', users_processed,
        'families_created', families_created,
        'completed_at', NOW()
    )
    WHERE migration_name = '002_create_default_families'
    AND status = 'started';

END $$;

-- ============================================================================
-- Verification: Ensure all users now have a family
-- ============================================================================

DO $$
DECLARE
    remaining_orphaned INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_orphaned
    FROM users u
    LEFT JOIN family_members fm ON u.id = fm.user_id
    WHERE fm.user_id IS NULL;

    IF remaining_orphaned > 0 THEN
        RAISE WARNING '⚠️  WARNING: % users still without families!', remaining_orphaned;
        RAISE EXCEPTION 'Migration verification failed: orphaned users remain';
    ELSE
        RAISE NOTICE '✓ VERIFICATION PASSED: All users have family associations';
    END IF;
END $$;

-- ============================================================================
-- Mark Migration as Completed
-- ============================================================================

UPDATE migration_log
SET status = 'completed'
WHERE migration_name = '002_create_default_families'
AND status = 'started';

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✓ Migration 002 completed successfully!';
    RAISE NOTICE '';
END $$;

COMMIT;
