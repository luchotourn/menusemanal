#!/usr/bin/env node

/**
 * Frontend Security Tests for Role-Based UI Components
 * Tests UI permission enforcement, data masking, and component access control
 *
 * Run with: node tests/security/frontend-security.test.js
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class FrontendSecurityTester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.clientDir = path.resolve(__dirname, '../../client/src');
  }

  log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
  }

  async test(description, testFn) {
    try {
      this.log(`\n🧪 Testing: ${description}`, colors.blue);
      await testFn();
      this.log(`✅ PASS: ${description}`, colors.green);
      this.passed++;
    } catch (error) {
      this.log(`❌ FAIL: ${description}`, colors.red);
      this.log(`   Error: ${error.message}`, colors.red);
      this.failed++;
    }
  }

  assertTrue(value, message) {
    if (!value) {
      throw new Error(`${message}: expected truthy value, got ${value}`);
    }
  }

  assertContains(haystack, needle, message) {
    if (!haystack.includes(needle)) {
      throw new Error(`${message}: expected to contain "${needle}"`);
    }
  }

  assertNotContains(haystack, needle, message) {
    if (haystack.includes(needle)) {
      throw new Error(`${message}: should not contain "${needle}"`);
    }
  }

  async readFile(filePath) {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read ${filePath}: ${error.message}`);
    }
  }

  async findFiles(dir, pattern) {
    const files = [];

    async function scan(currentDir) {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile() && pattern.test(entry.name)) {
          files.push(fullPath);
        }
      }
    }

    await scan(dir);
    return files;
  }

  async runAllTests() {
    this.log(`${colors.bold}${colors.blue}🔐 FRONTEND SECURITY TEST SUITE${colors.reset}`);
    this.log(`Testing client code in: ${this.clientDir}\n`);

    // Authentication Component Tests
    await this.testAuthenticationComponents();

    // Role-Based Component Tests
    await this.testRoleBasedComponents();

    // Data Security Tests
    await this.testDataSecurity();

    // Navigation Security Tests
    await this.testNavigationSecurity();

    // Input Validation Tests
    await this.testInputValidation();

    // Results
    this.showResults();
  }

  async testAuthenticationComponents() {
    this.log(`\n${colors.yellow}=== AUTHENTICATION COMPONENT TESTS ===${colors.reset}`);

    await this.test('AuthGuard component exists and protects routes', async () => {
      const authGuardPath = path.join(this.clientDir, 'components/auth-guard.tsx');
      const content = await this.readFile(authGuardPath);

      this.assertContains(content, 'useAuthStatus', 'Should use authentication status');
      this.assertContains(content, 'authenticated', 'Should check authentication');
      this.assertContains(content, '/login', 'Should redirect to login');
    });

    await this.test('GuestGuard prevents authenticated users from auth pages', async () => {
      const authGuardPath = path.join(this.clientDir, 'components/auth-guard.tsx');
      const content = await this.readFile(authGuardPath);

      this.assertContains(content, 'GuestGuard', 'Should have GuestGuard component');
      this.assertTrue(content.includes('authenticated') && content.includes('setLocation'),
        'Should redirect authenticated users');
    });

    await this.test('Login form validates input properly', async () => {
      const loginPath = path.join(this.clientDir, 'pages/login.tsx');
      const content = await this.readFile(loginPath);

      this.assertContains(content, 'type="email"', 'Should use email input type');
      this.assertContains(content, 'type="password"', 'Should use password input type');
      this.assertTrue(content.includes('required') || content.includes('validation'),
        'Should have input validation');
    });
  }

  async testRoleBasedComponents() {
    this.log(`\n${colors.yellow}=== ROLE-BASED COMPONENT TESTS ===${colors.reset}`);

    await this.test('Role-based navigation restricts access by role', async () => {
      const navPath = path.join(this.clientDir, 'components/role-based-navigation.tsx');
      const content = await this.readFile(navPath);

      this.assertContains(content, 'role', 'Should check user role');
      this.assertContains(content, 'creator', 'Should handle creator role');
      this.assertContains(content, 'commentator', 'Should handle commentator role');
      this.assertTrue(content.includes('user?.role') || content.includes('authStatus'),
        'Should verify user role from auth');
    });

    await this.test('Settings page restricts access to creators', async () => {
      const settingsPath = path.join(this.clientDir, 'pages/settings.tsx');
      const content = await this.readFile(settingsPath);

      this.assertTrue(content.includes('role') || content.includes('creator'),
        'Should check for creator role or have role-based restrictions');
    });

    await this.test('Family settings only accessible to creators', async () => {
      const familySettingsPath = path.join(this.clientDir, 'pages/family-settings.tsx');
      const content = await this.readFile(familySettingsPath);

      this.assertContains(content, 'creator', 'Should be restricted to creators');
      this.assertTrue(content.includes('role') || content.includes('permission'),
        'Should have role checking');
    });
  }

  async testDataSecurity() {
    this.log(`\n${colors.yellow}=== DATA SECURITY TESTS ===${colors.reset}`);

    await this.test('API calls include proper authentication headers', async () => {
      const hookFiles = await this.findFiles(path.join(this.clientDir, 'hooks'), /\.ts$/);

      let hasAuthCheck = false;
      for (const filePath of hookFiles) {
        const content = await this.readFile(filePath);
        if (content.includes('credentials') || content.includes('withCredentials') ||
            content.includes('cookie') || content.includes('session')) {
          hasAuthCheck = true;
          break;
        }
      }

      this.assertTrue(hasAuthCheck, 'Should include authentication in API calls');
    });

    await this.test('Sensitive data is not logged or exposed', async () => {
      const allFiles = await this.findFiles(this.clientDir, /\.(ts|tsx)$/);

      for (const filePath of allFiles) {
        const content = await this.readFile(filePath);

        // Check for potential password exposure
        if (content.includes('console.log') && content.includes('password')) {
          throw new Error(`Potential password logging in ${filePath}`);
        }

        // Check for session token exposure
        if (content.includes('console.log') && content.includes('token')) {
          throw new Error(`Potential token logging in ${filePath}`);
        }
      }
    });

    await this.test('User data is properly validated before display', async () => {
      const pageFiles = await this.findFiles(path.join(this.clientDir, 'pages'), /\.tsx$/);

      let hasValidation = false;
      for (const filePath of pageFiles) {
        const content = await this.readFile(filePath);
        if (content.includes('isLoading') || content.includes('isError') ||
            content.includes('error') || content.includes('data?.')) {
          hasValidation = true;
          break;
        }
      }

      this.assertTrue(hasValidation, 'Should validate data before display');
    });
  }

  async testNavigationSecurity() {
    this.log(`\n${colors.yellow}=== NAVIGATION SECURITY TESTS ===${colors.reset}`);

    await this.test('App.tsx properly guards routes', async () => {
      const appPath = path.join(this.clientDir, 'App.tsx');
      const content = await this.readFile(appPath);

      this.assertContains(content, 'AuthGuard', 'Should use AuthGuard for protected routes');
      this.assertContains(content, 'GuestGuard', 'Should use GuestGuard for auth routes');
    });

    await this.test('No direct access to protected pages without guards', async () => {
      const appPath = path.join(this.clientDir, 'App.tsx');
      const content = await this.readFile(appPath);

      // Check that sensitive routes are protected
      const protectedRoutes = ['/settings', '/family', '/profile'];
      for (const route of protectedRoutes) {
        if (content.includes(`path="${route}"`)) {
          const routeMatch = content.match(new RegExp(`path="${route}"[\\s\\S]*?</Route>`, 'g'));
          if (routeMatch && routeMatch[0]) {
            this.assertContains(routeMatch[0], 'AuthGuard',
              `Route ${route} should be protected with AuthGuard`);
          }
        }
      }
    });

    await this.test('Navigation components check authentication status', async () => {
      const navFiles = await this.findFiles(path.join(this.clientDir, 'components'), /navigation.*\.tsx$/);

      for (const filePath of navFiles) {
        const content = await this.readFile(filePath);
        this.assertTrue(content.includes('useAuth') || content.includes('authStatus'),
          `Navigation component ${filePath} should check auth status`);
      }
    });
  }

  async testInputValidation() {
    this.log(`\n${colors.yellow}=== INPUT VALIDATION TESTS ===${colors.reset}`);

    await this.test('Forms use proper input types and validation', async () => {
      const formFiles = await this.findFiles(this.clientDir, /\.(tsx)$/);

      let hasEmailValidation = false;
      let hasPasswordValidation = false;

      for (const filePath of formFiles) {
        const content = await this.readFile(filePath);

        if (content.includes('type="email"')) hasEmailValidation = true;
        if (content.includes('type="password"')) hasPasswordValidation = true;
      }

      this.assertTrue(hasEmailValidation, 'Should have email input validation');
      this.assertTrue(hasPasswordValidation, 'Should have password input validation');
    });

    await this.test('No inline JavaScript or dangerous HTML', async () => {
      const allFiles = await this.findFiles(this.clientDir, /\.(tsx|ts)$/);

      for (const filePath of allFiles) {
        const content = await this.readFile(filePath);

        // Check for dangerous patterns
        this.assertNotContains(content, 'dangerouslySetInnerHTML',
          `${filePath} should not use dangerouslySetInnerHTML`);
        this.assertNotContains(content, 'eval(',
          `${filePath} should not use eval()`);
        this.assertNotContains(content, 'innerHTML',
          `${filePath} should not use innerHTML`);
      }
    });

    await this.test('API endpoints are properly typed', async () => {
      const hookFiles = await this.findFiles(path.join(this.clientDir, 'hooks'), /\.ts$/);

      let hasTyping = false;
      for (const filePath of hookFiles) {
        const content = await this.readFile(filePath);
        if (content.includes('interface') || content.includes('type ') ||
            content.includes(': ') || content.includes('Record<')) {
          hasTyping = true;
          break;
        }
      }

      this.assertTrue(hasTyping, 'Should have proper TypeScript typing');
    });
  }

  showResults() {
    const total = this.passed + this.failed;
    const successRate = total > 0 ? Math.round((this.passed / total) * 100) : 0;

    this.log(`\n${colors.bold}=== FRONTEND SECURITY TEST RESULTS ===${colors.reset}`);
    this.log(`Total Tests: ${total}`);
    this.log(`Passed: ${this.passed}`, colors.green);
    this.log(`Failed: ${this.failed}`, this.failed > 0 ? colors.red : colors.green);
    this.log(`Success Rate: ${successRate}%`, successRate === 100 ? colors.green : colors.yellow);

    if (this.failed > 0) {
      this.log(`\n${colors.red}⚠️  FRONTEND SECURITY ISSUES DETECTED!${colors.reset}`);
      process.exit(1);
    } else {
      this.log(`\n${colors.green}✅ ALL FRONTEND SECURITY TESTS PASSED!${colors.reset}`);
      process.exit(0);
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new FrontendSecurityTester();
  tester.runAllTests().catch(error => {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}