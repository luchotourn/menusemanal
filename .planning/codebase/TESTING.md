# Testing

## Framework & Configuration

- **Unit/Integration tests**: Vitest (`vitest ^4.0.18`)
- **Test runner scripts**: `npm test` (vitest run), `npm run test:watch` (vitest)
- **Security tests**: Custom Node.js test scripts (`npm run test:security`)
- **Screenshot tests**: Puppeteer-based (`node screenshot.js`)
- No CI/CD pipeline configured for automated testing

## Test Structure

```
tests/
├── run-security-tests.js              # Orchestrator for security test suite
├── email-notification.test.js         # Email integration tests
└── security/
    ├── role-based-security.test.js    # API authentication & authorization
    ├── frontend-security.test.js      # Frontend security checks
    └── waitlist-api.test.js           # Waitlist endpoint tests

client/src/lib/__tests__/
└── share-utils.test.ts                # Unit tests for share utilities
```

## Test Types

### Unit Tests (Vitest)
- Located in `client/src/lib/__tests__/`
- Uses `describe`/`it`/`expect` from Vitest
- Mocking via `vi.fn()` and `vi.spyOn()`
- Example: `share-utils.test.ts` tests invite message builders, clipboard, WhatsApp URL encoding
- Tests co-located with source in `__tests__/` directories

### Security Tests (Custom)
- Located in `tests/security/`
- Custom test runner (not Vitest) — plain Node.js scripts with HTTP requests
- Tests run against a live server (`http://localhost:3001`)
- `SecurityTester` class provides test infrastructure:
  - Session management for multi-user testing
  - HTTP client for API requests
  - Color-coded console output (pass/fail)
- Coverage areas:
  - **Authentication**: Login/register flows, session handling
  - **Authorization**: Role-based access (creator vs commentator)
  - **Data isolation**: Family-scoped data boundaries
  - **Rate limiting**: Brute-force protection on auth endpoints

### Email Tests
- `tests/email-notification.test.js` — tests Resend email integration
- Tests notification sending for signup events

### Screenshot Tests
- `screenshot.js` at project root
- Uses Puppeteer to capture desktop (1200x800) and mobile (375x667) screenshots
- Requires dev server running on port 3001
- Output: `menu-semanal-desktop.png`, `menu-semanal-mobile.png`

## Mocking Patterns

### Browser APIs
```typescript
// Clipboard API mock (from share-utils.test.ts)
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn() },
  writable: true,
  configurable: true,
});
```

### Cleanup
- `beforeEach`/`afterEach` for setup/teardown
- `vi.restoreAllMocks()` to reset spies between tests

## Coverage

### Well-Covered
- Share utilities (invite messages, clipboard, WhatsApp URLs)
- Security boundaries (auth, roles, data isolation)

### Gaps
- No component tests (React Testing Library not installed)
- No API route unit tests (routes tested via security integration tests only)
- No storage layer tests
- No E2E tests (Playwright/Cypress not configured)
- No mock database for isolated backend testing — security tests hit live server

## Running Tests

```bash
# Unit tests (Vitest)
npm test                    # Run once
npm run test:watch          # Watch mode

# Security tests (requires running server)
npm run test:security       # All security tests
npm run test:security:api   # Role-based API tests only
npm run test:security:frontend  # Frontend security only

# Email tests
npm run test:email

# Screenshots (requires running server)
node screenshot.js
```
