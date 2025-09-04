# Multi-User Database Schema Migration Guide

## Overview

This document provides step-by-step instructions for migrating the Menu Familiar application to support multiple users, families, and role-based access control.

## What's New

### Database Schema Changes

1. **New Tables**:
   - `families` - Central table for family groups with unique invite codes
   - `family_members` - Junction table linking users to families (many-to-many)

2. **Updated Tables**:
   - `users` - Role field updated from "admin/member" to "creator/commentator"
   - `recipes` - Added `created_by` and `family_id` fields
   - `meal_plans` - Added `created_by` and `family_id` fields

3. **New Features**:
   - Family-based data isolation
   - Role-based permissions (creators can edit, commentators can view)
   - Invitation system using unique codes
   - Proper foreign key relationships with cascade deletes

## Migration Instructions

### Prerequisites

- Ensure your `DATABASE_URL` environment variable is set
- Take a backup of your current database before proceeding
- Ensure the application is not running during migration

### Step 1: Run the Migration

```bash
# Run the multi-user schema migration
npm run migrate:multi-user
```

This will:
- Create the new `families` and `family_members` tables
- Update user roles from admin/member to creator/commentator  
- Add new fields to existing tables
- Create performance indexes
- Migrate all existing data to a default family
- Display the default family's invite code

### Step 2: Verify Migration Success

The migration script will output the invite code for the default family. Save this code as existing users will need it to access their data.

**Expected output:**
```
✅ Migration completed successfully!
Default family created with ID 1 and invite code DEFAULT_abc12345
```

### Step 3: Test the Updated Schema

```bash
# Start the development server
npm run dev

# In another terminal, test the database connection
npm run check
```

## Data Migration Details

### Existing Data Handling

1. **Default Family Creation**: All existing data is assigned to a family called "Familia Principal"
2. **User Role Migration**: 
   - `admin` users → `creator` role
   - `member` users → `commentator` role
3. **Recipe Assignment**: All recipes are assigned to the default family with proper ownership
4. **Meal Plan Assignment**: All meal plans are assigned to the default family

### Family Invite Codes

- Each family has a unique invite code (e.g., "DEFAULT_abc12345")
- Codes are 8-15 characters long for security
- Users can join families using these codes
- The default family code will be displayed during migration

## API Changes

### Storage Layer Updates

All storage methods now support optional `familyId` parameters:

```typescript
// Before
await storage.getAllRecipes(userId);

// After (backward compatible)
await storage.getAllRecipes(userId, familyId);
```

### New Family Management Methods

```typescript
// Family CRUD operations
await storage.createFamily(familyData);
await storage.getFamilyByInviteCode("invite123");
await storage.addUserToFamily(familyId, userId);
await storage.getFamilyMembers(familyId);
```

## Security Improvements

1. **Data Isolation**: Families can only see their own recipes and meal plans
2. **Role-Based Access**: 
   - Creators can create, edit, and delete content
   - Commentators can view and add comments only
3. **Invite-Only Access**: Users can only join families with valid invite codes

## Performance Optimizations

New indexes added:
- `families.codigo_invitacion` (unique)
- `family_members(family_id, user_id)` (unique composite)
- `recipes.family_id` and `recipes.created_by`
- `meal_plans.family_id` and `meal_plans(family_id, fecha)`

## Rollback Procedure

If you need to rollback the migration:

1. Restore your database backup
2. Revert the code changes in `shared/schema.ts` and `server/storage.ts`
3. Run `npm run check` to ensure everything compiles

## Troubleshooting

### Common Issues

1. **Migration fails with "table already exists"**:
   - Check if tables were partially created
   - Drop the new tables manually and re-run

2. **TypeScript errors after migration**:
   - Run `npm run check` to verify all types are correct
   - Ensure all new fields are properly handled in the frontend

3. **Data not visible after migration**:
   - Verify users are assigned to the correct family
   - Check the family invite code was saved correctly

### Getting Help

1. Check the migration script output for specific error messages
2. Verify database connectivity with your `DATABASE_URL`
3. Ensure all dependencies are installed with `npm install`

## Next Steps

After successful migration:

1. Update frontend components to handle family selection
2. Implement family invitation flow in the UI
3. Add family management pages for admins
4. Update authentication to include family context
5. Test role-based permissions thoroughly

## Important Notes

- The migration is designed to be backward compatible
- Existing API endpoints continue to work during transition
- All existing data is preserved and migrated safely
- Users will need the default family invite code to continue using the app

## Migration Checklist

- [ ] Database backup completed
- [ ] `DATABASE_URL` verified and accessible
- [ ] Migration script executed successfully
- [ ] Default family invite code saved
- [ ] Application starts without errors
- [ ] Existing data is visible and accessible
- [ ] New family features work as expected

For technical support, refer to the GitHub issue #32 or contact the development team.