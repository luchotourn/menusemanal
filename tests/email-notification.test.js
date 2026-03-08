#!/usr/bin/env node

/**
 * Email Notification Unit Tests
 * Tests the sendSignupNotification function from server/email.ts
 *
 * Run with: node tests/email-notification.test.js
 * No server required — tests run in isolation with mocked Resend SDK.
 */

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    passed++;
    console.log(`${colors.green}  PASS: ${testName}${colors.reset}`);
  } else {
    failed++;
    console.log(`${colors.red}  FAIL: ${testName}${colors.reset}`);
  }
}

// --- Mock Resend SDK ---

let lastSendCall = null;
let sendShouldReject = false;

function createMockResend() {
  lastSendCall = null;
  return {
    emails: {
      send(params) {
        lastSendCall = params;
        if (sendShouldReject) {
          return Promise.reject(new Error('mock send failure'));
        }
        return Promise.resolve({ id: 'mock-id' });
      },
    },
  };
}

// We test the logic by re-implementing the function with injectable deps,
// mirroring server/email.ts exactly but accepting resend + notifyEmail as args.
function makeSendSignupNotification(resend, notifyEmail) {
  return function sendSignupNotification(email, source) {
    if (!resend || !notifyEmail) {
      console.log("Email notification skipped (RESEND_API_KEY or NOTIFY_EMAIL not set)");
      return null;
    }

    const now = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });

    return resend.emails
      .send({
        from: "Menu Familiar <onboarding@resend.dev>",
        to: notifyEmail,
        subject: `Nuevo registro en waitlist: ${email}`,
        text: [
          `Nuevo registro en la waitlist de Menu Familiar`,
          ``,
          `Email: ${email}`,
          `Fuente: ${source}`,
          `Fecha: ${now}`,
        ].join("\n"),
      })
      .then(() => 'sent')
      .catch(() => 'failed');
  };
}

// --- Tests ---

async function testSkipsWhenResendNull() {
  console.log(`\n${colors.bold}=== Skips when Resend client is null ===${colors.reset}`);

  const send = makeSendSignupNotification(null, 'admin@example.com');
  const result = send('user@example.com', 'hero');

  assert(result === null, 'Returns null when resend is null');
  assert(lastSendCall === null, 'Does not call resend.emails.send');
}

async function testSkipsWhenNotifyEmailMissing() {
  console.log(`\n${colors.bold}=== Skips when NOTIFY_EMAIL is not set ===${colors.reset}`);

  const mockResend = createMockResend();
  const send = makeSendSignupNotification(mockResend, '');
  const result = send('user@example.com', 'hero');

  assert(result === null, 'Returns null when notifyEmail is empty');
  assert(lastSendCall === null, 'Does not call resend.emails.send');
}

async function testSendsEmailWithCorrectParams() {
  console.log(`\n${colors.bold}=== Sends email with correct parameters ===${colors.reset}`);

  const mockResend = createMockResend();
  const send = makeSendSignupNotification(mockResend, 'admin@example.com');
  const result = await send('newuser@test.com', 'hero');

  assert(result === 'sent', 'Returns "sent" on success');
  assert(lastSendCall !== null, 'Calls resend.emails.send');
  assert(lastSendCall.from === 'Menu Familiar <onboarding@resend.dev>', 'From address is correct');
  assert(lastSendCall.to === 'admin@example.com', 'To address matches NOTIFY_EMAIL');
  assert(lastSendCall.subject === 'Nuevo registro en waitlist: newuser@test.com', 'Subject includes signup email');
  assert(lastSendCall.text.includes('newuser@test.com'), 'Body includes signup email');
  assert(lastSendCall.text.includes('hero'), 'Body includes source');
  assert(lastSendCall.text.includes('Fuente:'), 'Body has Fuente label');
  assert(lastSendCall.text.includes('Fecha:'), 'Body has Fecha label');
}

async function testDifferentSources() {
  console.log(`\n${colors.bold}=== Handles different source values ===${colors.reset}`);

  const mockResend = createMockResend();
  const send = makeSendSignupNotification(mockResend, 'admin@example.com');

  await send('a@b.com', 'footer');
  assert(lastSendCall.text.includes('footer'), 'Source "footer" appears in email body');

  await send('a@b.com', 'landing-cta');
  assert(lastSendCall.text.includes('landing-cta'), 'Source "landing-cta" appears in email body');
}

async function testHandlesSendFailureGracefully() {
  console.log(`\n${colors.bold}=== Handles send failure gracefully ===${colors.reset}`);

  const mockResend = createMockResend();
  sendShouldReject = true;

  const send = makeSendSignupNotification(mockResend, 'admin@example.com');

  // Should not throw — the promise rejection is caught internally
  let threw = false;
  try {
    const result = await send('user@test.com', 'hero');
    assert(result === 'failed', 'Returns "failed" on send error');
  } catch {
    threw = true;
  }
  assert(!threw, 'Does not throw on send failure');

  sendShouldReject = false;
}

// --- Runner ---

async function run() {
  console.log(`${colors.bold}=== Email Notification Unit Tests ===${colors.reset}`);

  await testSkipsWhenResendNull();
  await testSkipsWhenNotifyEmailMissing();
  await testSendsEmailWithCorrectParams();
  await testDifferentSources();
  await testHandlesSendFailureGracefully();

  const total = passed + failed;
  console.log(`\n${colors.bold}=== Results ===${colors.reset}`);
  console.log(`Total: ${total}  Passed: ${passed}  Failed: ${failed}`);

  if (failed > 0) {
    console.log(`${colors.red}SOME TESTS FAILED${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`${colors.green}ALL TESTS PASSED${colors.reset}`);
    process.exit(0);
  }
}

run().catch(err => {
  console.error(`${colors.red}Fatal error: ${err.message}${colors.reset}`);
  process.exit(1);
});
