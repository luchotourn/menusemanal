#!/usr/bin/env tsx
/**
 * Post-Migration Verification Script
 * ============================================================================
 * Purpose: Validate that all data has been properly migrated to family system
 * Usage: npm run migrate:verify
 * Date: 2025-10-04
 * Issue: #45 - Production Database Migration
 * ============================================================================
 */

import { db } from "../server/db";
import { users, families, familyMembers, recipes, mealPlans, recipeRatings, mealComments } from "@shared/schema";
import { sql } from "drizzle-orm";

interface VerificationResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  details: string;
  count?: number;
}

const results: VerificationResult[] = [];

function logResult(result: VerificationResult) {
  results.push(result);
  const icon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '⚠️';
  const color = result.status === 'PASS' ? '\x1b[32m' : result.status === 'FAIL' ? '\x1b[31m' : '\x1b[33m';
  console.log(`${color}${icon}\x1b[0m ${result.check}: ${result.details}${result.count !== undefined ? ` (${result.count})` : ''}`);
}

async function verifyMigration() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('           POST-MIGRATION VERIFICATION - FAMILY SYSTEM');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('');

  try {
    // ========================================================================
    // CHECK 1: All users have family associations
    // ========================================================================
    console.log('📊 Section 1: User Family Associations');
    console.log('─────────────────────────────────────────────────────────────────────');

    const orphanedUsersResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM users u
      LEFT JOIN family_members fm ON u.id = fm.user_id
      WHERE fm.user_id IS NULL
    `);
    const orphanedUsers = Number(orphanedUsersResult.rows[0]?.count || 0);

    if (orphanedUsers === 0) {
      logResult({
        check: 'Users with families',
        status: 'PASS',
        details: 'All users have family associations',
        count: 0
      });
    } else {
      logResult({
        check: 'Users with families',
        status: 'FAIL',
        details: 'Users without family associations found',
        count: orphanedUsers
      });
    }

    // Total users and families
    const totalUsersResult = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    const totalUsers = Number(totalUsersResult.rows[0]?.count || 0);

    const totalFamiliesResult = await db.execute(sql`SELECT COUNT(*) as count FROM families`);
    const totalFamilies = Number(totalFamiliesResult.rows[0]?.count || 0);

    console.log(`  Total users: ${totalUsers}`);
    console.log(`  Total families: ${totalFamilies}`);
    console.log('');

    // ========================================================================
    // CHECK 2: All recipes have familyId
    // ========================================================================
    console.log('📊 Section 2: Recipe Data Integrity');
    console.log('─────────────────────────────────────────────────────────────────────');

    const orphanedRecipesResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM recipes
      WHERE family_id IS NULL
    `);
    const orphanedRecipes = Number(orphanedRecipesResult.rows[0]?.count || 0);

    if (orphanedRecipes === 0) {
      logResult({
        check: 'Recipes with familyId',
        status: 'PASS',
        details: 'All recipes have family associations',
        count: 0
      });
    } else {
      logResult({
        check: 'Recipes with familyId',
        status: 'FAIL',
        details: 'Recipes without familyId found',
        count: orphanedRecipes
      });
    }

    // Check recipes with createdBy
    const recipesWithoutCreatorResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM recipes
      WHERE created_by IS NULL
    `);
    const recipesWithoutCreator = Number(recipesWithoutCreatorResult.rows[0]?.count || 0);

    if (recipesWithoutCreator === 0) {
      logResult({
        check: 'Recipes with createdBy',
        status: 'PASS',
        details: 'All recipes have creator information',
        count: 0
      });
    } else {
      logResult({
        check: 'Recipes with createdBy',
        status: 'WARNING',
        details: 'Recipes without createdBy (legacy data acceptable)',
        count: recipesWithoutCreator
      });
    }

    const totalRecipesResult = await db.execute(sql`SELECT COUNT(*) as count FROM recipes`);
    const totalRecipes = Number(totalRecipesResult.rows[0]?.count || 0);
    console.log(`  Total recipes: ${totalRecipes}`);
    console.log('');

    // ========================================================================
    // CHECK 3: All meal plans have familyId
    // ========================================================================
    console.log('📊 Section 3: Meal Plan Data Integrity');
    console.log('─────────────────────────────────────────────────────────────────────');

    const orphanedMealPlansResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM meal_plans
      WHERE family_id IS NULL
    `);
    const orphanedMealPlans = Number(orphanedMealPlansResult.rows[0]?.count || 0);

    if (orphanedMealPlans === 0) {
      logResult({
        check: 'Meal plans with familyId',
        status: 'PASS',
        details: 'All meal plans have family associations',
        count: 0
      });
    } else {
      logResult({
        check: 'Meal plans with familyId',
        status: 'FAIL',
        details: 'Meal plans without familyId found',
        count: orphanedMealPlans
      });
    }

    // Check meal plans with createdBy
    const mealPlansWithoutCreatorResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM meal_plans
      WHERE created_by IS NULL
    `);
    const mealPlansWithoutCreator = Number(mealPlansWithoutCreatorResult.rows[0]?.count || 0);

    if (mealPlansWithoutCreator === 0) {
      logResult({
        check: 'Meal plans with createdBy',
        status: 'PASS',
        details: 'All meal plans have creator information',
        count: 0
      });
    } else {
      logResult({
        check: 'Meal plans with createdBy',
        status: 'WARNING',
        details: 'Meal plans without createdBy (legacy data acceptable)',
        count: mealPlansWithoutCreator
      });
    }

    const totalMealPlansResult = await db.execute(sql`SELECT COUNT(*) as count FROM meal_plans`);
    const totalMealPlans = Number(totalMealPlansResult.rows[0]?.count || 0);
    console.log(`  Total meal plans: ${totalMealPlans}`);
    console.log('');

    // ========================================================================
    // CHECK 4: All families have unique invitation codes
    // ========================================================================
    console.log('📊 Section 4: Family Configuration');
    console.log('─────────────────────────────────────────────────────────────────────');

    const familiesWithoutCodesResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM families
      WHERE codigo_invitacion IS NULL OR codigo_invitacion = ''
    `);
    const familiesWithoutCodes = Number(familiesWithoutCodesResult.rows[0]?.count || 0);

    if (familiesWithoutCodes === 0) {
      logResult({
        check: 'Family invitation codes',
        status: 'PASS',
        details: 'All families have invitation codes',
        count: 0
      });
    } else {
      logResult({
        check: 'Family invitation codes',
        status: 'FAIL',
        details: 'Families without invitation codes found',
        count: familiesWithoutCodes
      });
    }

    // Check for duplicate invitation codes
    const duplicateCodesResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM (
        SELECT codigo_invitacion
        FROM families
        GROUP BY codigo_invitacion
        HAVING COUNT(*) > 1
      ) duplicates
    `);
    const duplicateCodes = Number(duplicateCodesResult.rows[0]?.count || 0);

    if (duplicateCodes === 0) {
      logResult({
        check: 'Unique invitation codes',
        status: 'PASS',
        details: 'All invitation codes are unique',
        count: 0
      });
    } else {
      logResult({
        check: 'Unique invitation codes',
        status: 'FAIL',
        details: 'Duplicate invitation codes found',
        count: duplicateCodes
      });
    }

    console.log('');

    // ========================================================================
    // CHECK 5: Foreign key integrity
    // ========================================================================
    console.log('📊 Section 5: Foreign Key Integrity');
    console.log('─────────────────────────────────────────────────────────────────────');

    // Check recipes with invalid familyId
    const invalidRecipeFamilyResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM recipes r
      WHERE r.family_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM families f WHERE f.id = r.family_id)
    `);
    const invalidRecipeFamily = Number(invalidRecipeFamilyResult.rows[0]?.count || 0);

    if (invalidRecipeFamily === 0) {
      logResult({
        check: 'Recipe family references',
        status: 'PASS',
        details: 'All recipe familyId references are valid',
        count: 0
      });
    } else {
      logResult({
        check: 'Recipe family references',
        status: 'FAIL',
        details: 'Invalid recipe familyId references found',
        count: invalidRecipeFamily
      });
    }

    // Check meal plans with invalid familyId
    const invalidMealPlanFamilyResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM meal_plans mp
      WHERE mp.family_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM families f WHERE f.id = mp.family_id)
    `);
    const invalidMealPlanFamily = Number(invalidMealPlanFamilyResult.rows[0]?.count || 0);

    if (invalidMealPlanFamily === 0) {
      logResult({
        check: 'Meal plan family references',
        status: 'PASS',
        details: 'All meal plan familyId references are valid',
        count: 0
      });
    } else {
      logResult({
        check: 'Meal plan family references',
        status: 'FAIL',
        details: 'Invalid meal plan familyId references found',
        count: invalidMealPlanFamily
      });
    }

    // Check meal plans with invalid recipe references
    const invalidRecipeRefsResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM meal_plans mp
      WHERE mp.receta_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM recipes r WHERE r.id = mp.receta_id)
    `);
    const invalidRecipeRefs = Number(invalidRecipeRefsResult.rows[0]?.count || 0);

    if (invalidRecipeRefs === 0) {
      logResult({
        check: 'Meal plan recipe references',
        status: 'PASS',
        details: 'All meal plan recipe references are valid',
        count: 0
      });
    } else {
      logResult({
        check: 'Meal plan recipe references',
        status: 'WARNING',
        details: 'Meal plans with invalid recipe references',
        count: invalidRecipeRefs
      });
    }

    console.log('');

    // ========================================================================
    // CHECK 6: Commentator features integrity
    // ========================================================================
    console.log('📊 Section 6: Commentator Features Integrity');
    console.log('─────────────────────────────────────────────────────────────────────');

    const totalRatingsResult = await db.execute(sql`SELECT COUNT(*) as count FROM recipe_ratings`);
    const totalRatings = Number(totalRatingsResult.rows[0]?.count || 0);

    const totalCommentsResult = await db.execute(sql`SELECT COUNT(*) as count FROM meal_comments`);
    const totalComments = Number(totalCommentsResult.rows[0]?.count || 0);

    if (totalRatings > 0 || totalComments > 0) {
      // Check recipe ratings with invalid familyId
      const invalidRatingFamilyResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM recipe_ratings rr
        WHERE rr.family_id IS NULL
      `);
      const invalidRatingFamily = Number(invalidRatingFamilyResult.rows[0]?.count || 0);

      if (invalidRatingFamily === 0) {
        logResult({
          check: 'Recipe ratings with familyId',
          status: 'PASS',
          details: 'All recipe ratings have family associations',
          count: 0
        });
      } else {
        logResult({
          check: 'Recipe ratings with familyId',
          status: 'FAIL',
          details: 'Recipe ratings without familyId found',
          count: invalidRatingFamily
        });
      }

      // Check meal comments with invalid familyId
      const invalidCommentFamilyResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM meal_comments mc
        WHERE mc.family_id IS NULL
      `);
      const invalidCommentFamily = Number(invalidCommentFamilyResult.rows[0]?.count || 0);

      if (invalidCommentFamily === 0) {
        logResult({
          check: 'Meal comments with familyId',
          status: 'PASS',
          details: 'All meal comments have family associations',
          count: 0
        });
      } else {
        logResult({
          check: 'Meal comments with familyId',
          status: 'FAIL',
          details: 'Meal comments without familyId found',
          count: invalidCommentFamily
        });
      }

      console.log(`  Total recipe ratings: ${totalRatings}`);
      console.log(`  Total meal comments: ${totalComments}`);
    } else {
      logResult({
        check: 'Commentator features',
        status: 'PASS',
        details: 'No commentator data to verify (new system)',
        count: 0
      });
    }

    console.log('');

    // ========================================================================
    // FINAL SUMMARY
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('                      VERIFICATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('');

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const warnings = results.filter(r => r.status === 'WARNING').length;

    console.log(`\x1b[32m✓ Passed:\x1b[0m ${passed}`);
    console.log(`\x1b[31m✗ Failed:\x1b[0m ${failed}`);
    console.log(`\x1b[33m⚠️  Warnings:\x1b[0m ${warnings}`);
    console.log('');

    if (failed > 0) {
      console.log('\x1b[31m✗ VERIFICATION FAILED\x1b[0m');
      console.log('');
      console.log('Critical issues detected. Please review the failed checks above.');
      console.log('Migration may need to be re-run or data manually corrected.');
      console.log('');
      process.exit(1);
    } else if (warnings > 0) {
      console.log('\x1b[33m⚠️  VERIFICATION PASSED WITH WARNINGS\x1b[0m');
      console.log('');
      console.log('Migration completed successfully, but some non-critical issues detected.');
      console.log('Review warnings above to ensure they are expected (e.g., legacy data).');
      console.log('');
      process.exit(0);
    } else {
      console.log('\x1b[32m✓ VERIFICATION PASSED\x1b[0m');
      console.log('');
      console.log('All checks passed! Migration completed successfully.');
      console.log('The family-based system is ready for production use.');
      console.log('');
      process.exit(0);
    }

  } catch (error) {
    console.error('\x1b[31m✗ Verification script error:\x1b[0m', error);
    process.exit(1);
  }
}

// Run verification
verifyMigration().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
