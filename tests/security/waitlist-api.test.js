#!/usr/bin/env node

/**
 * Waitlist API Security Tests
 * Tests CSRF protection, input validation, rate limiting, and email sanitization
 *
 * Run with: node tests/security/waitlist-api.test.js
 * Requires dev server running on localhost:3001
 *
 * IMPORTANT: The waitlist rate limit is 5 requests/hour per IP. CSRF-rejected
 * requests don't count (CSRF middleware runs before rate limiter), but all
 * requests that pass CSRF validation DO count. Tests are ordered to stay
 * within the 5-slot budget, then verify rate limiting on the 6th request.
 *
 * Budget allocation (5 slots):
 *   Slot 1: Invalid email (400)
 *   Slot 2: Missing email (400)
 *   Slot 3: XSS in email (400)
 *   Slot 4: Happy path signup (201)
 *   Slot 5: Duplicate email (200)
 *   Slot 6: Rate limit triggers (429)
 */

import http from 'http';
import { URL } from 'url';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3001';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class WaitlistSecurityTester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.csrfToken = null;
    this.csrfCookie = null;
  }

  log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
  }

  makeRequest(method, path, data = null, extraHeaders = {}, cookies = '') {
    return new Promise((resolve, reject) => {
      const url = new URL(path, BASE_URL);
      const postData = data ? JSON.stringify(data) : null;

      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          ...extraHeaders,
          ...(cookies ? { 'Cookie': cookies } : {}),
          ...(postData ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          } : {})
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          let parsedBody;
          try {
            parsedBody = body ? JSON.parse(body) : {};
          } catch {
            parsedBody = { _raw: body };
          }
          resolve({
            status: res.statusCode,
            body: parsedBody,
            headers: res.headers,
            setCookies: res.headers['set-cookie'] || []
          });
        });
      });

      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (postData) req.write(postData);
      req.end();
    });
  }

  assert(condition, testName) {
    if (condition) {
      this.passed++;
      this.log(`  PASS: ${testName}`, colors.green);
    } else {
      this.failed++;
      this.log(`  FAIL: ${testName}`, colors.red);
    }
  }

  async obtainCsrfToken() {
    const res = await this.makeRequest('GET', '/');
    const csrfCookieHeader = (res.setCookies || []).find(c => c.startsWith('csrf_token='));

    if (!csrfCookieHeader) {
      this.log('  WARNING: No csrf_token cookie found on landing page', colors.yellow);
      return false;
    }

    const tokenMatch = csrfCookieHeader.match(/csrf_token=([^;]+)/);
    if (!tokenMatch) return false;

    this.csrfToken = decodeURIComponent(tokenMatch[1]);
    this.csrfCookie = `csrf_token=${tokenMatch[1]}`;
    return true;
  }

  async waitlistPost(data, { skipCsrf = false, badToken = false } = {}) {
    const headers = {};
    let cookies = '';

    if (!skipCsrf) {
      if (badToken) {
        headers['X-CSRF-Token'] = 'invalid-token-value';
        cookies = 'csrf_token=different-token-value';
      } else {
        headers['X-CSRF-Token'] = this.csrfToken;
        cookies = this.csrfCookie;
      }
    }

    return this.makeRequest('POST', '/api/waitlist', data, headers, cookies);
  }

  // ── Test suites ──────────────────────────────────

  async testCsrfProtection() {
    this.log('\n=== CSRF Protection Tests (no rate-limit cost) ===', colors.bold);

    // 1. No CSRF token at all
    {
      const res = await this.waitlistPost(
        { email: 'csrf-no-token@example.com', source: 'hero' },
        { skipCsrf: true }
      );
      this.assert(res.status === 403, 'POST without CSRF token returns 403');
    }

    // 2. Mismatched cookie vs header
    {
      const res = await this.waitlistPost(
        { email: 'csrf-mismatch@example.com', source: 'hero' },
        { badToken: true }
      );
      this.assert(res.status === 403, 'POST with mismatched CSRF tokens returns 403');
    }

    // 3. Header only (no cookie)
    {
      const res = await this.makeRequest(
        'POST', '/api/waitlist',
        { email: 'csrf-header-only@example.com', source: 'hero' },
        { 'X-CSRF-Token': this.csrfToken },
        ''
      );
      this.assert(res.status === 403, 'POST with header but no cookie returns 403');
    }

    // 4. Cookie only (no header)
    {
      const res = await this.makeRequest(
        'POST', '/api/waitlist',
        { email: 'csrf-cookie-only@example.com', source: 'hero' },
        {},
        this.csrfCookie
      );
      this.assert(res.status === 403, 'POST with cookie but no header returns 403');
    }
  }

  async testInputValidation() {
    this.log('\n=== Input Validation Tests (rate-limit slots 1-3) ===', colors.bold);

    // Slot 1: Invalid email format
    {
      const res = await this.waitlistPost({ email: 'not-an-email', source: 'hero' });
      this.assert(res.status === 400, `Invalid email returns 400 (got ${res.status})`);
    }

    // Slot 2: Missing email field
    {
      await this.obtainCsrfToken();
      const res = await this.waitlistPost({ source: 'hero' });
      this.assert(res.status === 400, `Missing email returns 400 (got ${res.status})`);
    }

    // Slot 3: XSS in email — Zod .email() rejects it as invalid format
    {
      await this.obtainCsrfToken();
      const xssEmail = '<script>alert("xss")</script>@example.com';
      const res = await this.waitlistPost({ email: xssEmail, source: 'hero' });
      this.assert(res.status === 400, `XSS in email is rejected (got ${res.status})`);
    }
  }

  async testHappyPathAndDuplicate() {
    this.log('\n=== Happy Path + Duplicate Tests (rate-limit slots 4-5) ===', colors.bold);

    const uniqueEmail = `waitlist-test-${Date.now()}@example.com`;

    // Slot 4: Valid signup
    {
      await this.obtainCsrfToken();
      const res = await this.waitlistPost({ email: uniqueEmail, source: 'hero' });
      this.assert(res.status === 201, `Valid signup returns 201 (got ${res.status})`);
      this.assert(
        res.body.message && res.body.message.includes('Gracias'),
        'Response contains success message'
      );
    }

    // Slot 5: Duplicate email returns 200 (enumeration prevention)
    {
      await this.obtainCsrfToken();
      const res = await this.waitlistPost({ email: uniqueEmail, source: 'hero' });
      this.assert(res.status === 200, `Duplicate email returns 200 (not 409) to prevent enumeration (got ${res.status})`);
      this.assert(
        res.body.message && res.body.message.includes('Gracias'),
        'Duplicate email still shows success message'
      );
    }
  }

  async testRateLimiting() {
    this.log('\n=== Rate Limiting Test (slot 6 — should be blocked) ===', colors.bold);

    // After 5 legitimate requests above, the 6th should trigger 429
    await this.obtainCsrfToken();
    const res = await this.waitlistPost({
      email: `ratelimit-${Date.now()}@example.com`,
      source: 'hero'
    });
    this.assert(res.status === 429, `6th request triggers rate limit 429 (got ${res.status})`);
  }

  async run() {
    this.log(`${colors.bold}${colors.blue}=== Waitlist API Security Tests ===${colors.reset}`);

    const gotToken = await this.obtainCsrfToken();
    if (!gotToken) {
      this.log('FATAL: Could not obtain CSRF token from landing page. Is the server running?', colors.red);
      process.exit(1);
    }
    this.log(`CSRF token obtained successfully`, colors.green);

    // CSRF tests first — these don't consume rate-limit slots
    await this.testCsrfProtection();

    // Validation tests (slots 1-3), then happy path + duplicate (slots 4-5)
    await this.obtainCsrfToken();
    await this.testInputValidation();
    await this.testHappyPathAndDuplicate();

    // Rate limiting — the 6th request should be blocked
    await this.testRateLimiting();

    // Summary
    const total = this.passed + this.failed;
    this.log(`\n${colors.bold}=== Results ===${colors.reset}`);
    this.log(`Total: ${total}  Passed: ${this.passed}  Failed: ${this.failed}`);

    if (this.failed > 0) {
      this.log(`SOME TESTS FAILED`, colors.red);
      process.exit(1);
    } else {
      this.log(`ALL TESTS PASSED`, colors.green);
      process.exit(0);
    }
  }
}

const tester = new WaitlistSecurityTester();
tester.run().catch(err => {
  console.error(`${colors.red}Fatal error: ${err.message}${colors.reset}`);
  process.exit(1);
});
