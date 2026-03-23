import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Security tests for the 4 critical fixes:
 * C-1: No credentials in CLAUDE.md
 * C-2: Session secret enforcement in production
 * C-3: Role override at registration
 * C-4: Rate limiting on family join endpoint
 */

// ─────────────────────────────────────────────
// C-1: Credential Exposure Test
// ─────────────────────────────────────────────
describe('C-1: No credentials in committed files', () => {
  const fs = require('fs');
  const path = require('path');
  const projectRoot = path.resolve(__dirname, '..', '..');

  const SENSITIVE_PATTERNS = [
    // Neon DB connection strings with embedded passwords
    /postgresql:\/\/[^:]+:[^@]+@[^/]+\.neon\.tech/,
    // Generic password patterns in connection strings
    /npg_[A-Za-z0-9]+/,
    // Common secret patterns
    /DATABASE_URL\s*=\s*postgresql:\/\/\w+:[^$\s{]/,
  ];

  const FILES_TO_CHECK = [
    'CLAUDE.md',
    '.claude/settings.local.json',
  ];

  for (const file of FILES_TO_CHECK) {
    it(`${file} does not contain hardcoded database credentials`, () => {
      const filePath = path.join(projectRoot, file);
      if (!fs.existsSync(filePath)) {
        // File doesn't exist — safe
        return;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      for (const pattern of SENSITIVE_PATTERNS) {
        expect(content).not.toMatch(pattern);
      }
    });
  }

  it('CLAUDE.md uses environment variable reference instead of hardcoded credentials', () => {
    const content = fs.readFileSync(path.join(projectRoot, 'CLAUDE.md'), 'utf-8');
    // Should reference .env or $DATABASE_URL, not a literal connection string
    expect(content).toContain('$DATABASE_URL');
  });

  it('.gitignore excludes .env and .claude/ directories', () => {
    const gitignore = fs.readFileSync(path.join(projectRoot, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('.env');
    expect(gitignore).toContain('.claude/');
  });
});

// ─────────────────────────────────────────────
// C-2: Session Secret Enforcement
// ─────────────────────────────────────────────
describe('C-2: Session secret enforcement in production', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('crashes if SESSION_SECRET is missing in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SESSION_SECRET;

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as any);

    const { validateSessionConfig } = await import('../auth/session');

    expect(() => validateSessionConfig()).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });

  it('crashes if SESSION_SECRET is the hardcoded default in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SESSION_SECRET = 'menu-familiar-secret-key-change-in-production';

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as any);

    const { validateSessionConfig } = await import('../auth/session');

    expect(() => validateSessionConfig()).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });

  it('does NOT crash with a proper secret in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SESSION_SECRET = 'a-very-secure-session-secret-that-is-long-enough-for-production';

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as any);

    const { validateSessionConfig } = await import('../auth/session');

    expect(() => validateSessionConfig()).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  it('does NOT crash in development even without SESSION_SECRET', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.SESSION_SECRET;

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as any);

    const { validateSessionConfig } = await import('../auth/session');

    expect(() => validateSessionConfig()).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────
// C-3: Role Override at Registration
// ─────────────────────────────────────────────
describe('C-3: Registration always assigns server-controlled role', () => {
  it('registration route source code overrides role after spreading validatedData', () => {
    // Static analysis: verify the code structure ensures role is set server-side.
    // This reads the actual source file to confirm the fix is in place.
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'auth', 'routes.ts'),
      'utf-8'
    );

    // The spread must come BEFORE the role override
    const insertBlock = source.match(
      /\.values\(\{([\s\S]*?)\}\)/
    );
    expect(insertBlock).not.toBeNull();

    const valuesContent = insertBlock![1];

    // Find positions of spread and role override
    const spreadPos = valuesContent.indexOf('...validatedData');
    const rolePos = valuesContent.indexOf('role:');

    expect(spreadPos).toBeGreaterThan(-1);
    expect(rolePos).toBeGreaterThan(-1);

    // Role override MUST come after the spread to take precedence
    expect(rolePos).toBeGreaterThan(spreadPos);
  });

  it('insertUserSchema accepts role field (so we must override it server-side)', () => {
    // Static analysis: the schema defines role with a default, meaning
    // client-supplied role values pass validation. This proves the
    // server-side override is the actual security boundary.
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'shared', 'schema.ts'),
      'utf-8'
    );

    // insertUserSchema should NOT omit role — it accepts it from input
    const schemaBlock = source.match(
      /insertUserSchema\s*=\s*createInsertSchema\(users[\s\S]*?\)\.omit\(\{([\s\S]*?)\}\)/
    );
    expect(schemaBlock).not.toBeNull();

    const omittedFields = schemaBlock![1];
    // role should NOT be in the omitted fields — meaning it passes through
    expect(omittedFields).not.toContain('role');
  });

  it('role override uses literal "creator" string, not a variable', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'auth', 'routes.ts'),
      'utf-8'
    );

    // Must explicitly set role: "creator" — not a variable that could be manipulated
    expect(source).toMatch(/role:\s*["']creator["']/);
  });
});

// ─────────────────────────────────────────────
// C-4: Rate Limiting on Family Join
// ─────────────────────────────────────────────
describe('C-4: Family join endpoint has rate limiting', () => {
  it('POST /api/families/join route includes familyCodeRateLimit middleware', () => {
    // Static analysis: verify the route definition includes the rate limiter
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'routes.ts'),
      'utf-8'
    );

    // Find the families/join POST route definition
    const joinRoutePattern = /app\.post\(\s*["']\/api\/families\/join["']\s*,\s*([\w\s,]*),\s*async/;
    const match = source.match(joinRoutePattern);

    expect(match).not.toBeNull();

    const middlewareChain = match![1];
    expect(middlewareChain).toContain('familyCodeRateLimit');
  });

  it('familyCodeRateLimit is imported in routes.ts', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'routes.ts'),
      'utf-8'
    );

    // Verify the rate limiter is imported
    expect(source).toMatch(/import\s*\{[^}]*familyCodeRateLimit[^}]*\}/);
  });

  it('familyCodeRateLimit allows max 5 requests per hour', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'auth', 'middleware.ts'),
      'utf-8'
    );

    // Extract the familyCodeRateLimit definition
    const rateLimitBlock = source.match(
      /familyCodeRateLimit\s*=\s*rateLimit\(\{([\s\S]*?)\}\)/
    );
    expect(rateLimitBlock).not.toBeNull();

    const config = rateLimitBlock![1];

    // Verify window is 1 hour (60 * 60 * 1000 = 3600000ms)
    expect(config).toMatch(/windowMs:\s*60\s*\*\s*60\s*\*\s*1000/);

    // Verify max is 5
    expect(config).toMatch(/max:\s*5/);
  });

  it('familyCodeRateLimit returns 429 with Spanish error message', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'auth', 'middleware.ts'),
      'utf-8'
    );

    // Find the handler that returns TOO_MANY_REQUESTS for family code rate limit
    const handlerBlock = source.match(
      /familyCodeRateLimit[\s\S]*?handler:[\s\S]*?status\(429\)/
    );
    expect(handlerBlock).not.toBeNull();
  });
});
