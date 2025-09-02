# Deployment Guide - Authentication Update

## Database Schema Updates

The authentication feature adds the following database changes:

### New Tables
1. **users** - Stores user accounts with authentication data
   - Managed by Drizzle ORM (defined in `shared/schema.ts`)
   - Created/updated via `npm run db:push`

2. **user_sessions** - Stores active user sessions
   - Managed by `connect-pg-simple` session middleware
   - Created automatically when the server starts
   - NOT managed by Drizzle (intentionally separate)

### Updated Tables
- **recipes** - Added `user_id` foreign key for user ownership
- **meal_plans** - Added `user_id` foreign key for user ownership

## Deployment Steps

### 1. Environment Variables
Ensure these variables are set in production:
```bash
DATABASE_URL=your_postgresql_connection_string
SESSION_SECRET=your_secure_random_string_at_least_32_chars
NODE_ENV=production
```

### 2. Database Migration
For new deployments or updates:
```bash
# This will create/update the users table and add foreign keys
npm run db:push
```

**Note**: When running `db:push`, you may see a warning about the `user_sessions` table. 
This is expected - the session table is managed separately by the session middleware, not Drizzle.
Choose "No, abort" if prompted to delete it.

### 3. Build and Deploy
```bash
npm run build
npm start
```

## Important Notes

- The `user_sessions` table is created automatically by the session store on first run
- Session data persists across server restarts (stored in PostgreSQL)
- Default session timeout is 7 days (configurable in `server/auth/session.ts`)
- Rate limiting is applied to authentication endpoints (5 attempts per 15 minutes)

## Security Checklist

- [ ] Set a strong SESSION_SECRET (minimum 32 characters)
- [ ] Ensure DATABASE_URL uses SSL connection (`?sslmode=require`)
- [ ] Verify NODE_ENV is set to "production"
- [ ] Test rate limiting is working on /api/auth endpoints
- [ ] Confirm sessions expire after 7 days of inactivity