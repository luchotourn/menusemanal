#!/usr/bin/env tsx
/**
 * Production Database Migration Orchestrator
 * ============================================================================
 * Purpose: Coordinate execution of family-based system migration
 * Usage: npm run migrate:production
 * Date: 2025-10-04
 * Issue: #45 - Production Database Migration
 * ============================================================================
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('');
  log('═══════════════════════════════════════════════════════════════════════', 'cyan');
  log(`  ${title}`, 'bright');
  log('═══════════════════════════════════════════════════════════════════════', 'cyan');
  console.log('');
}

function logStep(step: string, substep: string) {
  log(`${step} ${substep}`, 'blue');
}

async function promptUser(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${colors.yellow}${question} (yes/no): ${colors.reset}`, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function executeSQLFile(filePath: string, description: string): Promise<void> {
  try {
    log(`\n📄 Executing: ${description}`, 'blue');
    log(`   File: ${path.basename(filePath)}`, 'cyan');

    const sqlContent = fs.readFileSync(filePath, 'utf-8');

    // Execute the SQL
    await db.execute(sql.raw(sqlContent));

    log(`✓ ${description} completed successfully`, 'green');
  } catch (error) {
    log(`✗ ${description} failed!`, 'red');
    throw error;
  }
}

async function checkPrerequisites(): Promise<boolean> {
  logSection('PREREQUISITE CHECKS');

  try {
    // Check 1: Database connection
    logStep('1.', 'Checking database connection...');
    await db.execute(sql`SELECT 1`);
    log('  ✓ Database connection successful', 'green');

    // Check 2: Check if tables exist
    logStep('2.', 'Verifying database schema...');
    const tablesResult = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'recipes', 'meal_plans', 'families', 'family_members')
    `);

    const tableNames = tablesResult.rows.map((row: any) => row.table_name);
    const requiredTables = ['users', 'recipes', 'meal_plans', 'families', 'family_members'];
    const missingTables = requiredTables.filter(t => !tableNames.includes(t));

    if (missingTables.length > 0) {
      log(`  ✗ Missing required tables: ${missingTables.join(', ')}`, 'red');
      log('  Run migration 0001_add_multi_user_schema.sql first!', 'yellow');
      return false;
    }
    log('  ✓ All required tables exist', 'green');

    // Check 3: Check if migration_log table exists
    logStep('3.', 'Checking migration tracking...');
    const migrationLogExists = tableNames.includes('migration_log');
    if (!migrationLogExists) {
      log('  ℹ️  Migration log table will be created automatically', 'cyan');
    } else {
      log('  ✓ Migration tracking table exists', 'green');
    }

    // Check 4: Check if migrations were already run
    if (migrationLogExists) {
      logStep('4.', 'Checking previous migration status...');
      const previousMigrations = await db.execute(sql`
        SELECT migration_name, status
        FROM migration_log
        WHERE migration_name IN ('002_create_default_families', '003_fix_orphaned_data')
        AND status = 'completed'
        ORDER BY executed_at DESC
      `);

      if (previousMigrations.rows.length > 0) {
        log('  ⚠️  WARNING: These migrations have already been run:', 'yellow');
        previousMigrations.rows.forEach((row: any) => {
          log(`     - ${row.migration_name} (${row.status})`, 'yellow');
        });
        log('  Migration scripts are idempotent and can be re-run safely.', 'cyan');
        console.log('');

        const proceed = await promptUser('Do you want to proceed anyway?');
        if (!proceed) {
          log('\nMigration cancelled by user.', 'yellow');
          return false;
        }
      } else {
        log('  ✓ No previous migrations detected', 'green');
      }
    }

    log('\n✓ All prerequisite checks passed!', 'green');
    return true;

  } catch (error) {
    log('✗ Prerequisite check failed!', 'red');
    console.error(error);
    return false;
  }
}

async function runPreMigrationAudit(): Promise<void> {
  logSection('PRE-MIGRATION AUDIT');

  try {
    log('Running audit to assess current data state...', 'blue');
    log('This will help identify orphaned records and migration scope.\n', 'cyan');

    // Get counts of orphaned data
    const orphanedUsersResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM users u
      LEFT JOIN family_members fm ON u.id = fm.user_id
      WHERE fm.user_id IS NULL
    `);
    const orphanedUsers = Number(orphanedUsersResult.rows[0]?.count || 0);

    const orphanedRecipesResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM recipes
      WHERE family_id IS NULL
    `);
    const orphanedRecipes = Number(orphanedRecipesResult.rows[0]?.count || 0);

    const orphanedMealPlansResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM meal_plans
      WHERE family_id IS NULL
    `);
    const orphanedMealPlans = Number(orphanedMealPlansResult.rows[0]?.count || 0);

    const totalUsersResult = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    const totalUsers = Number(totalUsersResult.rows[0]?.count || 0);

    const totalRecipesResult = await db.execute(sql`SELECT COUNT(*) as count FROM recipes`);
    const totalRecipes = Number(totalRecipesResult.rows[0]?.count || 0);

    const totalMealPlansResult = await db.execute(sql`SELECT COUNT(*) as count FROM meal_plans`);
    const totalMealPlans = Number(totalMealPlansResult.rows[0]?.count || 0);

    // Display audit summary
    log('📊 AUDIT SUMMARY:', 'bright');
    console.log('');
    log(`   Total Users: ${totalUsers}`, 'cyan');
    log(`   Users without families: ${orphanedUsers}`, orphanedUsers > 0 ? 'yellow' : 'green');
    console.log('');
    log(`   Total Recipes: ${totalRecipes}`, 'cyan');
    log(`   Recipes without familyId: ${orphanedRecipes}`, orphanedRecipes > 0 ? 'yellow' : 'green');
    console.log('');
    log(`   Total Meal Plans: ${totalMealPlans}`, 'cyan');
    log(`   Meal plans without familyId: ${orphanedMealPlans}`, orphanedMealPlans > 0 ? 'yellow' : 'green');
    console.log('');

    if (orphanedUsers === 0 && orphanedRecipes === 0 && orphanedMealPlans === 0) {
      log('✓ No orphaned data detected. Migration may not be necessary.', 'green');
      log('  All data already has family associations.', 'cyan');
      console.log('');

      const proceed = await promptUser('Continue with migration anyway?');
      if (!proceed) {
        log('\nMigration cancelled by user.', 'yellow');
        process.exit(0);
      }
    } else {
      log('⚠️  Migration Required:', 'yellow');
      if (orphanedUsers > 0) {
        log(`   • Will create ${orphanedUsers} default families for users`, 'yellow');
      }
      if (orphanedRecipes > 0) {
        log(`   • Will assign ${orphanedRecipes} recipes to families`, 'yellow');
      }
      if (orphanedMealPlans > 0) {
        log(`   • Will assign ${orphanedMealPlans} meal plans to families`, 'yellow');
      }
    }

  } catch (error) {
    log('✗ Pre-migration audit failed!', 'red');
    throw error;
  }
}

async function confirmMigration(): Promise<boolean> {
  logSection('MIGRATION CONFIRMATION');

  log('⚠️  CRITICAL WARNINGS:', 'red');
  log('   • This migration will modify production data', 'yellow');
  log('   • Ensure you have a current database backup', 'yellow');
  log('   • The migration can be rolled back if needed', 'cyan');
  log('   • Estimated downtime: 5-15 minutes', 'cyan');
  console.log('');

  const hasBackup = await promptUser('✓ Do you have a current database backup?');
  if (!hasBackup) {
    log('\n✗ Migration cancelled. Please create a backup first!', 'red');
    log('  Create backup: pg_dump $DATABASE_URL > backup.sql', 'cyan');
    return false;
  }

  console.log('');
  const confirmProceed = await promptUser('✓ Ready to proceed with migration?');
  if (!confirmProceed) {
    log('\nMigration cancelled by user.', 'yellow');
    return false;
  }

  return true;
}

async function runMigrations(): Promise<void> {
  logSection('EXECUTING MIGRATIONS');

  // Migration 002: Create default families
  await executeSQLFile(
    path.join(__dirname, '../migrations/002_create_default_families.sql'),
    'Migration 002: Creating default families for users'
  );

  console.log('');

  // Migration 003: Fix orphaned data
  await executeSQLFile(
    path.join(__dirname, '../migrations/003_fix_orphaned_data.sql'),
    'Migration 003: Fixing orphaned recipes and meal plans'
  );

  log('\n✓ All migrations executed successfully!', 'green');
}

async function runVerification(): Promise<boolean> {
  logSection('POST-MIGRATION VERIFICATION');

  try {
    log('Running comprehensive verification checks...', 'blue');
    console.log('');

    // Import and run verification checks inline
    const orphanedUsersResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM users u
      LEFT JOIN family_members fm ON u.id = fm.user_id
      WHERE fm.user_id IS NULL
    `);
    const orphanedUsers = Number(orphanedUsersResult.rows[0]?.count || 0);

    const orphanedRecipesResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM recipes
      WHERE family_id IS NULL
    `);
    const orphanedRecipes = Number(orphanedRecipesResult.rows[0]?.count || 0);

    const orphanedMealPlansResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM meal_plans
      WHERE family_id IS NULL
    `);
    const orphanedMealPlans = Number(orphanedMealPlansResult.rows[0]?.count || 0);

    // Display verification results
    const checks = [
      { name: 'Users without families', count: orphanedUsers, critical: true },
      { name: 'Recipes without familyId', count: orphanedRecipes, critical: true },
      { name: 'Meal plans without familyId', count: orphanedMealPlans, critical: true },
    ];

    let allPassed = true;
    checks.forEach(check => {
      if (check.count === 0) {
        log(`✓ ${check.name}: 0`, 'green');
      } else {
        log(`✗ ${check.name}: ${check.count}`, 'red');
        if (check.critical) allPassed = false;
      }
    });

    console.log('');

    if (allPassed) {
      log('✓ VERIFICATION PASSED', 'green');
      log('  All data has been successfully migrated to the family system.', 'cyan');
      return true;
    } else {
      log('✗ VERIFICATION FAILED', 'red');
      log('  Some data was not migrated correctly.', 'yellow');
      log('  Review the migration logs above for details.', 'yellow');
      return false;
    }

  } catch (error) {
    log('✗ Verification failed with error!', 'red');
    console.error(error);
    return false;
  }
}

async function generateMigrationReport(): Promise<void> {
  logSection('MIGRATION COMPLETE');

  try {
    // Get migration statistics
    const statsResult = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM families) as total_families,
        (SELECT COUNT(*) FROM recipes) as total_recipes,
        (SELECT COUNT(*) FROM meal_plans) as total_meal_plans,
        (SELECT COUNT(*) FROM family_members) as total_memberships
    `);

    const stats = statsResult.rows[0] as any;

    log('📊 FINAL STATISTICS:', 'bright');
    console.log('');
    log(`   Users: ${stats.total_users}`, 'cyan');
    log(`   Families: ${stats.total_families}`, 'cyan');
    log(`   Family Memberships: ${stats.total_memberships}`, 'cyan');
    log(`   Recipes: ${stats.total_recipes}`, 'cyan');
    log(`   Meal Plans: ${stats.total_meal_plans}`, 'cyan');
    console.log('');

    log('✓ Migration completed successfully!', 'green');
    log('  The family-based system is now active.', 'cyan');
    console.log('');

    log('📋 NEXT STEPS:', 'bright');
    log('   1. Test user authentication flow', 'cyan');
    log('   2. Verify recipes display correctly', 'cyan');
    log('   3. Check meal plans load properly', 'cyan');
    log('   4. Test family invitation system', 'cyan');
    log('   5. Monitor application logs for errors', 'cyan');
    log('   6. Consider running: npm run migrate:verify', 'cyan');
    console.log('');

    log('💡 ROLLBACK (if needed):', 'yellow');
    log('   npm run migrate:rollback', 'yellow');
    console.log('');

  } catch (error) {
    log('Warning: Could not generate full migration report', 'yellow');
    console.error(error);
  }
}

// ============================================================================
// Main Migration Flow
// ============================================================================

async function main() {
  console.clear();
  logSection('PRODUCTION DATABASE MIGRATION - FAMILY SYSTEM');

  log('This script will migrate your database to the family-based system.', 'cyan');
  log('Issue #45 - Production Database Migration', 'cyan');
  console.log('');

  try {
    // Step 1: Check prerequisites
    const prerequisitesPassed = await checkPrerequisites();
    if (!prerequisitesPassed) {
      process.exit(1);
    }

    // Step 2: Run pre-migration audit
    await runPreMigrationAudit();

    // Step 3: Get user confirmation
    const confirmed = await confirmMigration();
    if (!confirmed) {
      process.exit(0);
    }

    // Step 4: Execute migrations
    await runMigrations();

    // Step 5: Verify migration
    const verificationPassed = await runVerification();
    if (!verificationPassed) {
      log('\n⚠️  Verification failed. Consider running rollback.', 'yellow');
      process.exit(1);
    }

    // Step 6: Generate report
    await generateMigrationReport();

    log('🎉 Migration completed successfully!', 'green');
    process.exit(0);

  } catch (error) {
    console.log('');
    log('═══════════════════════════════════════════════════════════════════════', 'red');
    log('  MIGRATION FAILED', 'red');
    log('═══════════════════════════════════════════════════════════════════════', 'red');
    console.log('');
    console.error('Error details:', error);
    console.log('');
    log('💡 TROUBLESHOOTING:', 'yellow');
    log('   1. Check the error message above', 'yellow');
    log('   2. Verify DATABASE_URL is correct', 'yellow');
    log('   3. Ensure database is accessible', 'yellow');
    log('   4. Review migration logs', 'yellow');
    log('   5. Consider running rollback: npm run migrate:rollback', 'yellow');
    console.log('');
    process.exit(1);
  }
}

// Run the migration
main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
