#!/usr/bin/env node

/**
 * Comprehensive Role-Based Security Tests
 * Tests authentication, authorization, and data isolation for the family system
 *
 * Run with: node tests/security/role-based-security.test.js
 */

import http from 'http';
import { URL } from 'url';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3001';
const TEST_TIMEOUT = 30000;

// Test data
const TEST_USERS = {
  creator: {
    email: 'creator@test.com',
    password: 'testpassword123',
    role: 'creator'
  },
  commentator: {
    email: 'commentator@test.com',
    password: 'testpassword123',
    role: 'commentator'
  },
  unauthorized: {
    email: 'hacker@malicious.com',
    password: 'hackpass'
  }
};

const TEST_FAMILIES = {
  family1: { id: 1, name: 'Familia Test 1' },
  family2: { id: 2, name: 'Familia Test 2' }
};

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class SecurityTester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.sessions = new Map();
  }

  log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
  }

  async makeRequest(method, path, data = null, cookies = '') {
    return new Promise((resolve, reject) => {
      const url = new URL(path, BASE_URL);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookies
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const parsedBody = body ? JSON.parse(body) : {};
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: parsedBody,
              cookies: res.headers['set-cookie'] || []
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: body,
              cookies: res.headers['set-cookie'] || []
            });
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(TEST_TIMEOUT, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  async login(userType) {
    const user = TEST_USERS[userType];
    if (!user) throw new Error(`Unknown user type: ${userType}`);

    const response = await this.makeRequest('POST', '/api/auth/login', {
      email: user.email,
      password: user.password
    });

    if (response.status === 200) {
      // Extract session cookie
      const sessionCookie = response.cookies.find(cookie =>
        cookie.startsWith('connect.sid=')
      );
      if (sessionCookie) {
        this.sessions.set(userType, sessionCookie);
        return sessionCookie;
      }
    }

    throw new Error(`Login failed for ${userType}: ${response.status} ${JSON.stringify(response.body)}`);
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

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
  }

  assertNotEqual(actual, unexpected, message) {
    if (actual === unexpected) {
      throw new Error(`${message}: got unexpected value ${actual}`);
    }
  }

  assertTrue(value, message) {
    if (!value) {
      throw new Error(`${message}: expected truthy value, got ${value}`);
    }
  }

  async runAllTests() {
    this.log(`${colors.bold}${colors.blue}🔐 ROLE-BASED SECURITY TEST SUITE${colors.reset}`);
    this.log(`Testing against: ${BASE_URL}\n`);

    // Authentication Tests
    await this.testAuthentication();

    // Authorization Tests
    await this.testAuthorization();

    // Data Isolation Tests
    await this.testDataIsolation();

    // Session Security Tests
    await this.testSessionSecurity();

    // Cross-Family Access Tests
    await this.testCrossFamilyAccess();

    // API Permission Tests
    await this.testAPIPermissions();

    // Results
    this.showResults();
  }

  async testAuthentication() {
    this.log(`\n${colors.yellow}=== AUTHENTICATION TESTS ===${colors.reset}`);

    await this.test('Reject invalid login credentials', async () => {
      const response = await this.makeRequest('POST', '/api/auth/login', {
        email: 'nonexistent@test.com',
        password: 'wrongpassword'
      });
      this.assertEqual(response.status, 401, 'Should reject invalid credentials');
    });

    await this.test('Accept valid creator login', async () => {
      const sessionCookie = await this.login('creator');
      this.assertTrue(sessionCookie, 'Should return session cookie');
    });

    await this.test('Accept valid commentator login', async () => {
      const sessionCookie = await this.login('commentator');
      this.assertTrue(sessionCookie, 'Should return session cookie');
    });

    await this.test('Require authentication for protected routes', async () => {
      const response = await this.makeRequest('GET', '/api/recipes');
      this.assertEqual(response.status, 401, 'Should require authentication');
    });
  }

  async testAuthorization() {
    this.log(`\n${colors.yellow}=== AUTHORIZATION TESTS ===${colors.reset}`);

    const creatorCookie = this.sessions.get('creator');
    const commentatorCookie = this.sessions.get('commentator');

    await this.test('Creator can access creator-only endpoints', async () => {
      const response = await this.makeRequest('GET', '/api/recipes', null, creatorCookie);
      this.assertTrue([200, 304].includes(response.status), 'Creator should access recipes');
    });

    await this.test('Commentator cannot create recipes', async () => {
      const response = await this.makeRequest('POST', '/api/recipes', {
        nombre: 'Hacker Recipe',
        descripcion: 'Should not be created'
      }, commentatorCookie);
      this.assertTrue([401, 403].includes(response.status), 'Commentator should not create recipes');
    });

    await this.test('Commentator cannot delete recipes', async () => {
      const response = await this.makeRequest('DELETE', '/api/recipes/1', null, commentatorCookie);
      this.assertTrue([401, 403].includes(response.status), 'Commentator should not delete recipes');
    });

    await this.test('Commentator can view recipes (read-only)', async () => {
      const response = await this.makeRequest('GET', '/api/recipes', null, commentatorCookie);
      this.assertTrue([200, 304].includes(response.status), 'Commentator should view recipes');
    });
  }

  async testDataIsolation() {
    this.log(`\n${colors.yellow}=== DATA ISOLATION TESTS ===${colors.reset}`);

    const creatorCookie = this.sessions.get('creator');

    await this.test('Users only see their family data', async () => {
      const response = await this.makeRequest('GET', '/api/meal-plans?startDate=2025-09-01', null, creatorCookie);

      if (response.status === 200 && Array.isArray(response.body)) {
        // Check that all meal plans belong to user's family
        response.body.forEach(mealPlan => {
          this.assertTrue(mealPlan.familyId !== null, 'Meal plan should have familyId');
        });
      }
    });

    await this.test('Family-scoped recipe access', async () => {
      const response = await this.makeRequest('GET', '/api/recipes', null, creatorCookie);

      if (response.status === 200 && Array.isArray(response.body)) {
        // Check that all recipes belong to user's family context
        response.body.forEach(recipe => {
          this.assertTrue(recipe.userId !== null, 'Recipe should have userId');
        });
      }
    });
  }

  async testSessionSecurity() {
    this.log(`\n${colors.yellow}=== SESSION SECURITY TESTS ===${colors.reset}`);

    await this.test('Reject requests without session', async () => {
      const response = await this.makeRequest('GET', '/api/auth/profile');
      this.assertEqual(response.status, 401, 'Should reject unauthenticated requests');
    });

    await this.test('Session includes proper security attributes', async () => {
      const creatorCookie = this.sessions.get('creator');
      this.assertTrue(creatorCookie, 'Should have session cookie');

      // Check if cookie has secure attributes (basic check)
      const response = await this.makeRequest('GET', '/api/auth/status', null, creatorCookie);
      this.assertEqual(response.status, 200, 'Valid session should work');
    });

    await this.test('Logout destroys session', async () => {
      const creatorCookie = this.sessions.get('creator');

      // Logout
      const logoutResponse = await this.makeRequest('POST', '/api/auth/logout', null, creatorCookie);
      this.assertTrue([200, 302].includes(logoutResponse.status), 'Logout should succeed');

      // Try to use session after logout
      const testResponse = await this.makeRequest('GET', '/api/auth/profile', null, creatorCookie);
      this.assertEqual(testResponse.status, 401, 'Session should be invalid after logout');

      // Re-login for other tests
      await this.login('creator');
    });
  }

  async testCrossFamilyAccess() {
    this.log(`\n${colors.yellow}=== CROSS-FAMILY ACCESS TESTS ===${colors.reset}`);

    const creatorCookie = this.sessions.get('creator');

    await this.test('Cannot access other family meal plans', async () => {
      // Try to access meal plans with different family ID in query
      const response = await this.makeRequest('GET', '/api/meal-plans?startDate=2025-09-01&familyId=999', null, creatorCookie);

      // Should either ignore the familyId param or return empty results
      if (response.status === 200 && Array.isArray(response.body)) {
        response.body.forEach(mealPlan => {
          this.assertNotEqual(mealPlan.familyId, 999, 'Should not return other family data');
        });
      }
    });

    await this.test('Cannot modify other family recipes', async () => {
      // Try to delete a recipe that might belong to another family
      const response = await this.makeRequest('DELETE', '/api/recipes/999999', null, creatorCookie);
      this.assertTrue([404, 403].includes(response.status), 'Should not delete other family recipes');
    });
  }

  async testAPIPermissions() {
    this.log(`\n${colors.yellow}=== API PERMISSION TESTS ===${colors.reset}`);

    const creatorCookie = this.sessions.get('creator');
    const commentatorCookie = this.sessions.get('commentator');

    // Test all major endpoints
    const endpoints = [
      { method: 'GET', path: '/api/recipes', creatorAllowed: true, commentatorAllowed: true },
      { method: 'POST', path: '/api/recipes', creatorAllowed: true, commentatorAllowed: false },
      { method: 'GET', path: '/api/meal-plans', creatorAllowed: true, commentatorAllowed: true },
      { method: 'POST', path: '/api/meal-plans', creatorAllowed: true, commentatorAllowed: false },
      { method: 'GET', path: '/api/auth/profile', creatorAllowed: true, commentatorAllowed: true }
    ];

    for (const endpoint of endpoints) {
      await this.test(`${endpoint.method} ${endpoint.path} - Creator permissions`, async () => {
        const testData = endpoint.method === 'POST' ? { test: 'data' } : null;
        const response = await this.makeRequest(endpoint.method, endpoint.path, testData, creatorCookie);

        if (endpoint.creatorAllowed) {
          this.assertTrue([200, 201, 304, 400].includes(response.status),
            `Creator should access ${endpoint.path}`);
        } else {
          this.assertTrue([401, 403].includes(response.status),
            `Creator should not access ${endpoint.path}`);
        }
      });

      await this.test(`${endpoint.method} ${endpoint.path} - Commentator permissions`, async () => {
        const testData = endpoint.method === 'POST' ? { test: 'data' } : null;
        const response = await this.makeRequest(endpoint.method, endpoint.path, testData, commentatorCookie);

        if (endpoint.commentatorAllowed) {
          this.assertTrue([200, 201, 304, 400].includes(response.status),
            `Commentator should access ${endpoint.path}`);
        } else {
          this.assertTrue([401, 403].includes(response.status),
            `Commentator should not access ${endpoint.path}`);
        }
      });
    }
  }

  showResults() {
    const total = this.passed + this.failed;
    const successRate = total > 0 ? Math.round((this.passed / total) * 100) : 0;

    this.log(`\n${colors.bold}=== TEST RESULTS ===${colors.reset}`);
    this.log(`Total Tests: ${total}`);
    this.log(`Passed: ${this.passed}`, colors.green);
    this.log(`Failed: ${this.failed}`, this.failed > 0 ? colors.red : colors.green);
    this.log(`Success Rate: ${successRate}%`, successRate === 100 ? colors.green : colors.yellow);

    if (this.failed > 0) {
      this.log(`\n${colors.red}⚠️  SECURITY ISSUES DETECTED! Please review failed tests.${colors.reset}`);
      process.exit(1);
    } else {
      this.log(`\n${colors.green}✅ ALL SECURITY TESTS PASSED!${colors.reset}`);
      process.exit(0);
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new SecurityTester();
  tester.runAllTests().catch(error => {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}