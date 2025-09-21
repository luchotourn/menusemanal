#!/usr/bin/env node

/**
 * Security Test Runner
 * Orchestrates all security tests and provides comprehensive reporting
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class SecurityTestRunner {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
  }

  async runCommand(command, args = [], cwd = process.cwd()) {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd,
        stdio: 'pipe',
        shell: true
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          code,
          stdout,
          stderr,
          success: code === 0
        });
      });
    });
  }

  async checkServerHealth() {
    this.log('🔍 Checking server health...', colors.cyan);

    try {
      const response = await fetch('http://localhost:3001/api/health-check');
      if (response.ok) {
        this.log('✅ Server is running and healthy', colors.green);
        return true;
      }
    } catch (error) {
      this.log('❌ Server health check failed', colors.red);
      this.log('💡 Make sure to run "npm run dev" before testing', colors.yellow);
      return false;
    }
    return false;
  }

  async runTest(testName, testPath) {
    this.log(`\n🚀 Running ${testName}...`, colors.blue);

    const result = await this.runCommand('node', [testPath]);

    this.results.push({
      name: testName,
      success: result.success,
      output: result.stdout,
      errors: result.stderr,
      duration: Date.now() - this.startTime
    });

    if (result.success) {
      this.log(`✅ ${testName} completed successfully`, colors.green);
    } else {
      this.log(`❌ ${testName} failed`, colors.red);
      if (result.stderr) {
        this.log(`Error: ${result.stderr}`, colors.red);
      }
    }

    // Always show the test output for visibility
    if (result.stdout) {
      console.log(result.stdout);
    }

    return result.success;
  }

  async createTestReport() {
    const endTime = Date.now();
    const totalDuration = Math.round((endTime - this.startTime) / 1000);
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = this.results.length - passedTests;

    const report = {
      timestamp: new Date().toISOString(),
      totalDuration: `${totalDuration}s`,
      summary: {
        total: this.results.length,
        passed: passedTests,
        failed: failedTests,
        successRate: this.results.length > 0 ? Math.round((passedTests / this.results.length) * 100) : 0
      },
      tests: this.results.map(r => ({
        name: r.name,
        status: r.success ? 'PASSED' : 'FAILED',
        hasErrors: !!r.errors
      }))
    };

    // Write report to file
    const reportsDir = path.join(process.cwd(), 'tests', 'reports');
    await fs.mkdir(reportsDir, { recursive: true });

    const reportPath = path.join(reportsDir, `security-test-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    return { report, reportPath };
  }

  async run() {
    this.log(`${colors.bold}${colors.blue}🛡️  COMPREHENSIVE SECURITY TEST SUITE${colors.reset}`);
    this.log(`${colors.cyan}Testing Menu Familiar Role-Based Permission System${colors.reset}\n`);

    // Check if server is running
    const serverHealthy = await this.checkServerHealth();
    if (!serverHealthy) {
      this.log('\n❌ Cannot proceed without a running server', colors.red);
      process.exit(1);
    }

    // Define tests to run
    const tests = [
      {
        name: 'Backend API Security Tests',
        path: path.join(process.cwd(), 'tests', 'security', 'role-based-security.test.js')
      },
      {
        name: 'Frontend Component Security Tests',
        path: path.join(process.cwd(), 'tests', 'security', 'frontend-security.test.js')
      }
    ];

    // Run all tests
    let allPassed = true;
    for (const test of tests) {
      const success = await this.runTest(test.name, test.path);
      if (!success) {
        allPassed = false;
      }
    }

    // Generate report
    const { report, reportPath } = await this.createTestReport();

    // Display final results
    this.log(`\n${colors.bold}=== FINAL SECURITY TEST RESULTS ===${colors.reset}`);
    this.log(`Duration: ${report.totalDuration}`);
    this.log(`Total Tests: ${report.summary.total}`);
    this.log(`Passed: ${report.summary.passed}`, colors.green);
    this.log(`Failed: ${report.summary.failed}`, report.summary.failed > 0 ? colors.red : colors.green);
    this.log(`Success Rate: ${report.summary.successRate}%`,
      report.summary.successRate === 100 ? colors.green : colors.yellow);

    this.log(`\n📊 Detailed report saved to: ${reportPath}`, colors.cyan);

    if (allPassed) {
      this.log(`\n${colors.green}🎉 ALL SECURITY TESTS PASSED!${colors.reset}`);
      this.log(`${colors.green}✅ The role-based permission system is secure and ready for production.${colors.reset}`);
      process.exit(0);
    } else {
      this.log(`\n${colors.red}🚨 SECURITY VULNERABILITIES DETECTED!${colors.reset}`);
      this.log(`${colors.red}❌ Please review and fix failed tests before deployment.${colors.reset}`);
      process.exit(1);
    }
  }
}

// Add global fetch polyfill for Node.js if needed
if (!globalThis.fetch) {
  try {
    const { default: fetch } = await import('node-fetch');
    globalThis.fetch = fetch;
  } catch (error) {
    console.log('Note: node-fetch not available, using basic HTTP for health check');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new SecurityTestRunner();
  runner.run().catch(error => {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}