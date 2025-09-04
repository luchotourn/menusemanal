-- Migration: Add multi-user and family support
-- Date: 2025-09-03
-- Description: Adds families, family_members tables and updates existing tables for multi-user support

BEGIN;

-- Create families table
CREATE TABLE IF NOT EXISTS families (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    codigo_invitacion TEXT NOT NULL UNIQUE,
    created_by INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create family_members junction table
CREATE TABLE IF NOT EXISTS family_members (
    id SERIAL PRIMARY KEY,
    family_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Update users table to support creator/commentator roles
DO $$ 
BEGIN
    -- First update existing roles
    UPDATE users 
    SET role = CASE 
        WHEN role = 'admin' THEN 'creator'
        WHEN role = 'member' THEN 'commentator'
        ELSE 'creator'
    END
    WHERE role IN ('admin', 'member');
    
    -- Add check constraint for new role values
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check 
        CHECK (role IN ('creator', 'commentator'));
END $$;

-- Add new columns to recipes table
ALTER TABLE recipes 
    ADD COLUMN IF NOT EXISTS created_by INTEGER,
    ADD COLUMN IF NOT EXISTS family_id INTEGER;

-- Add new columns to meal_plans table
ALTER TABLE meal_plans 
    ADD COLUMN IF NOT EXISTS created_by INTEGER,
    ADD COLUMN IF NOT EXISTS family_id INTEGER;

-- Create indexes for better performance
CREATE UNIQUE INDEX IF NOT EXISTS families_codigo_invitacion_idx ON families(codigo_invitacion);
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS family_members_family_user_idx ON family_members(family_id, user_id);
CREATE INDEX IF NOT EXISTS family_members_user_idx ON family_members(user_id);
CREATE INDEX IF NOT EXISTS recipes_family_idx ON recipes(family_id);
CREATE INDEX IF NOT EXISTS recipes_created_by_idx ON recipes(created_by);
CREATE INDEX IF NOT EXISTS meal_plans_family_idx ON meal_plans(family_id);
CREATE INDEX IF NOT EXISTS meal_plans_fecha_idx ON meal_plans(fecha);
CREATE INDEX IF NOT EXISTS meal_plans_family_fecha_idx ON meal_plans(family_id, fecha);

-- Add foreign key constraints
ALTER TABLE families 
    ADD CONSTRAINT families_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES users(id);

ALTER TABLE family_members 
    ADD CONSTRAINT family_members_family_id_fkey 
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    ADD CONSTRAINT family_members_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE recipes 
    ADD CONSTRAINT recipes_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES users(id),
    ADD CONSTRAINT recipes_family_id_fkey 
    FOREIGN KEY (family_id) REFERENCES families(id);

ALTER TABLE meal_plans 
    ADD CONSTRAINT meal_plans_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES users(id),
    ADD CONSTRAINT meal_plans_family_id_fkey 
    FOREIGN KEY (family_id) REFERENCES families(id);

-- Migrate existing data to default family
DO $$
DECLARE
    default_family_id INTEGER;
    admin_user_id INTEGER;
    invite_code TEXT;
BEGIN
    -- Generate a unique invite code for the default family
    invite_code := 'DEFAULT_' || substr(md5(random()::text), 1, 8);
    
    -- Find or create an admin user for the default family
    SELECT id INTO admin_user_id FROM users 
    WHERE role = 'creator' 
    LIMIT 1;
    
    -- If no admin exists, use the first user
    IF admin_user_id IS NULL THEN
        SELECT id INTO admin_user_id FROM users 
        ORDER BY id 
        LIMIT 1;
    END IF;
    
    -- Only create default family if there are existing users
    IF admin_user_id IS NOT NULL THEN
        -- Create the default family
        INSERT INTO families (nombre, codigo_invitacion, created_by)
        VALUES ('Familia Principal', invite_code, admin_user_id)
        RETURNING id INTO default_family_id;
        
        -- Add all existing users to the default family
        INSERT INTO family_members (family_id, user_id)
        SELECT default_family_id, id FROM users;
        
        -- Update recipes with the default family
        UPDATE recipes 
        SET family_id = default_family_id,
            created_by = COALESCE(user_id, admin_user_id)
        WHERE family_id IS NULL;
        
        -- Update meal_plans with the default family
        UPDATE meal_plans 
        SET family_id = default_family_id,
            created_by = COALESCE(user_id, admin_user_id)
        WHERE family_id IS NULL;
        
        RAISE NOTICE 'Default family created with ID % and invite code %', default_family_id, invite_code;
    END IF;
END $$;

COMMIT;