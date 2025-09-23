# Security Test Suite

Comprehensive security tests for the Menu Familiar role-based permission system.

## Overview

This test suite validates the security implementation of Epic 4 (Multi-User & Authentication System), ensuring proper authentication, authorization, and data isolation for the family-based system.

## Test Files

### 1. Backend API Security Tests (`role-based-security.test.js`)

Tests server-side security enforcement:

- **Authentication Tests**
  - Invalid credential rejection
  - Valid login acceptance
  - Protected route access control

- **Authorization Tests**
  - Creator vs Commentator role permissions
  - CRUD operation restrictions
  - Endpoint access control

- **Data Isolation Tests**
  - Family-scoped data access
  - Cross-family data protection
  - User data segregation

- **Session Security Tests**
  - Session validation
  - Logout functionality
  - Session expiration

### 2. Frontend Component Security Tests (`frontend-security.test.js`)

Tests client-side security enforcement:

- **Authentication Components**
  - AuthGuard implementation
  - GuestGuard functionality
  - Login form validation

- **Role-Based Components**
  - Navigation restrictions
  - Component access control
  - Role-based UI rendering

- **Data Security**
  - Sensitive data protection
  - Input validation
  - API call security

## Running Tests

### Prerequisites

1. **Server must be running**: Start the development server first
   ```bash
   npm run dev
   ```

2. **Test users must exist**: Ensure test users are in the database:
   - `creator@test.com` (role: creator)
   - `commentator@test.com` (role: commentator)

### Test Commands

```bash
# Run all security tests
npm run test:security

# Run only API security tests
npm run test:security:api

# Run only frontend security tests
npm run test:security:frontend
```

### Manual Test Setup

If test users don't exist, create them manually:

1. Register users through the UI:
   - Email: `creator@test.com`, Password: `testpassword123`
   - Email: `commentator@test.com`, Password: `testpassword123`

2. Set roles in database:
   ```sql
   UPDATE users SET role = 'creator' WHERE email = 'creator@test.com';
   UPDATE users SET role = 'commentator' WHERE email = 'commentator@test.com';
   ```

## Test Results

Tests generate detailed reports in `tests/reports/` with:
- Pass/fail status for each test
- Execution duration
- Error details
- Success rate metrics

## Security Test Categories

### 🔐 Authentication Security
- Login/logout functionality
- Session management
- Credential validation
- Route protection

### 👤 Authorization Security
- Role-based access control
- Permission enforcement
- Creator vs Commentator restrictions
- API endpoint protection

### 🏠 Data Isolation Security
- Family-scoped data access
- Cross-family data protection
- User data segregation
- Orphaned record prevention

### 🌐 Frontend Security
- Component access control
- UI permission enforcement
- Input validation
- XSS prevention

### 🔗 API Security
- Endpoint authentication
- Request authorization
- Data validation
- Error handling

## Expected Test Results

All tests should **PASS** before:
- Merging pull requests
- Deploying to production
- Starting Epic 5 (Gamification)

**Critical**: Any failed security test indicates a vulnerability that must be fixed before deployment.

## Troubleshooting

### Common Issues

1. **Server not running**
   ```
   Error: Server health check failed
   Solution: Run npm run dev
   ```

2. **Test users missing**
   ```
   Error: Login failed for creator: 401
   Solution: Create test users manually
   ```

3. **Database connection issues**
   ```
   Error: Connection terminated unexpectedly
   Solution: Check DATABASE_URL environment variable
   ```

### Debug Mode

Add `DEBUG=1` before test commands for verbose output:
```bash
DEBUG=1 npm run test:security
```

## Contributing

When adding new security features:

1. Add corresponding tests to validate security
2. Update test documentation
3. Ensure all existing tests still pass
4. Add new test categories if needed

## Security Test Philosophy

These tests follow the principle of **"Security by Default"**:
- Explicit permission rather than implicit access
- Fail-safe behaviors (deny by default)
- Comprehensive boundary testing
- Defense in depth validation

**Remember**: Security tests are not just about preventing attacks, but ensuring the system behaves correctly under all conditions and user roles.