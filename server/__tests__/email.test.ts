import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Resend at module level — vi.mock is hoisted
const mockSend = vi.fn();
vi.mock("resend", () => {
  return {
    Resend: class MockResend {
      emails = { send: mockSend };
    },
  };
});

describe("sendWeekReviewNotification", () => {
  const originalKey = process.env.RESEND_API_KEY;
  let sendWeekReviewNotification: typeof import("../email").sendWeekReviewNotification;

  beforeEach(async () => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({ data: { id: "test-id" }, error: null });
    process.env.RESEND_API_KEY = "test-key";
    // Re-import with the env var set so `resend` gets initialized
    vi.resetModules();
    const mod = await import("../email");
    sendWeekReviewNotification = mod.sendWeekReviewNotification;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalKey;
    }
  });

  it("sends one email per opted-in recipient", async () => {
    sendWeekReviewNotification({
      familyName: "Familia Tourn",
      weekStartDate: "2026-04-20",
      submitterName: "Lucho",
      recipients: [
        { email: "kid1@example.com", name: "Kid 1", notificationPreferences: null },
        { email: "kid2@example.com", name: "Kid 2", notificationPreferences: null },
      ],
    });

    // Wait a microtask for any fire-and-forget promise chains
    await new Promise((r) => setImmediate(r));

    expect(mockSend).toHaveBeenCalledTimes(2);
    const calls = mockSend.mock.calls.map((c) => c[0]);
    expect(calls[0].to).toBe("kid1@example.com");
    expect(calls[1].to).toBe("kid2@example.com");
    expect(calls[0].subject).toContain("20/04");
    expect(calls[0].text).toContain("Lucho");
    expect(calls[0].text).toContain("Kid 1");
    expect(calls[0].text).toContain("Familia Tourn");
  });

  it("skips recipients who opted out of email notifications", async () => {
    sendWeekReviewNotification({
      familyName: "Familia Tourn",
      weekStartDate: "2026-04-20",
      submitterName: "Lucho",
      recipients: [
        {
          email: "optedout@example.com",
          name: "Opted Out",
          notificationPreferences: JSON.stringify({ email: false, mealPlans: true }),
        },
        {
          email: "in@example.com",
          name: "In",
          notificationPreferences: JSON.stringify({ email: true, mealPlans: true }),
        },
      ],
    });

    await new Promise((r) => setImmediate(r));

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].to).toBe("in@example.com");
  });

  it("skips recipients who opted out of meal-plan notifications", async () => {
    sendWeekReviewNotification({
      familyName: "Familia Tourn",
      weekStartDate: "2026-04-20",
      submitterName: "Lucho",
      recipients: [
        {
          email: "optedout@example.com",
          name: "Opted Out",
          notificationPreferences: JSON.stringify({ email: true, mealPlans: false }),
        },
      ],
    });

    await new Promise((r) => setImmediate(r));

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("treats malformed preferences as opted-in (fail-open)", async () => {
    sendWeekReviewNotification({
      familyName: "Familia Tourn",
      weekStartDate: "2026-04-20",
      submitterName: "Lucho",
      recipients: [
        {
          email: "malformed@example.com",
          name: "Malformed",
          notificationPreferences: "not-valid-json{",
        },
      ],
    });

    await new Promise((r) => setImmediate(r));

    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("sends nothing when no recipients are given", async () => {
    sendWeekReviewNotification({
      familyName: "Familia Tourn",
      weekStartDate: "2026-04-20",
      submitterName: "Lucho",
      recipients: [],
    });

    await new Promise((r) => setImmediate(r));

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("does nothing when RESEND_API_KEY is not set", async () => {
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
    const { sendWeekReviewNotification: freshSender } = await import("../email");

    freshSender({
      familyName: "Familia Tourn",
      weekStartDate: "2026-04-20",
      submitterName: "Lucho",
      recipients: [
        { email: "kid@example.com", name: "Kid", notificationPreferences: null },
      ],
    });

    await new Promise((r) => setImmediate(r));

    expect(mockSend).not.toHaveBeenCalled();
  });
});
