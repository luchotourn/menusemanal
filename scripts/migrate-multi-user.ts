#!/usr/bin/env tsx
/**
 * Migration script for multi-user database schema
 * Run with: npm run migrate:multi-user
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log("🚀 Starting multi-user schema migration...");
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, "../migrations/0001_add_multi_user_schema.sql");
    const migrationSQL = fs.readFileSync(migrationPath, "utf-8");
    
    console.log("📄 Executing migration script...");
    
    // Execute the migration
    await db.execute(sql.raw(migrationSQL));
    
    console.log("✅ Migration completed successfully!");
    console.log("");
    console.log("📝 Summary:");
    console.log("- Created families table");
    console.log("- Created family_members junction table");
    console.log("- Updated users roles (admin→creator, member→commentator)");
    console.log("- Added created_by and family_id to recipes and meal_plans");
    console.log("- Created indexes for performance");
    console.log("- Migrated existing data to default family");
    console.log("");
    console.log("⚠️  Important: Check the logs above for the default family invite code");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    console.error("");
    console.error("💡 Troubleshooting tips:");
    console.error("1. Ensure DATABASE_URL is set correctly");
    console.error("2. Check that the database is accessible");
    console.error("3. Verify no conflicting schema changes exist");
    console.error("4. Review the error message above for specific issues");
    process.exit(1);
  }
}

// Run the migration
runMigration().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});