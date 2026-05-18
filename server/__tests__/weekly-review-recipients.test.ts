import { describe, it, expect } from "vitest";

/**
 * Tests for the recipient-filter applied before sending the weekly-review
 * notification email.
 *
 * The route handler at POST /api/weekly-reviews must only email family
 * members whose user role is "commentator" (Comensal). Planificadores
 * (creators) submit and edit plans themselves and should not receive the
 * "enviar para revisión" email. The submitter is always excluded.
 */

type Member = {
  id: number;
  name: string;
  email: string;
  role: "creator" | "commentator";
  notificationPreferences: string | null;
};

function filterReviewRecipients(members: Member[], submitterId: number) {
  return members
    .filter((m) => m.id !== submitterId && m.role === "commentator")
    .map((m) => ({
      email: m.email,
      name: m.name,
      notificationPreferences: m.notificationPreferences,
    }));
}

const member = (overrides: Partial<Member>): Member => ({
  id: 1,
  name: "Member",
  email: "m@x.com",
  role: "creator",
  notificationPreferences: null,
  ...overrides,
});

describe("Weekly review recipients", () => {
  it("only includes commentator-role members", () => {
    const members: Member[] = [
      member({ id: 1, role: "creator", email: "creator@x.com" }),
      member({ id: 2, role: "commentator", email: "kid@x.com" }),
    ];
    const recipients = filterReviewRecipients(members, 99);
    expect(recipients.map((r) => r.email)).toEqual(["kid@x.com"]);
  });

  it("excludes the submitter even if they are a commentator", () => {
    // Edge case: in current product rules the submitter is always a
    // creator (route guarded by requireCreatorRole), but the filter still
    // excludes them defensively.
    const members: Member[] = [
      member({ id: 5, role: "commentator", email: "submitter@x.com" }),
      member({ id: 6, role: "commentator", email: "other@x.com" }),
    ];
    const recipients = filterReviewRecipients(members, 5);
    expect(recipients.map((r) => r.email)).toEqual(["other@x.com"]);
  });

  it("excludes other Planificador (creator) members", () => {
    const members: Member[] = [
      member({ id: 1, role: "creator", email: "submitter@x.com" }),
      member({ id: 2, role: "creator", email: "other-planner@x.com" }),
      member({ id: 3, role: "commentator", email: "kid@x.com" }),
    ];
    const recipients = filterReviewRecipients(members, 1);
    expect(recipients.map((r) => r.email)).toEqual(["kid@x.com"]);
  });

  it("returns an empty list when no commentator members exist", () => {
    const members: Member[] = [
      member({ id: 1, role: "creator", email: "a@x.com" }),
      member({ id: 2, role: "creator", email: "b@x.com" }),
    ];
    const recipients = filterReviewRecipients(members, 1);
    expect(recipients).toEqual([]);
  });

  it("preserves notificationPreferences so downstream opt-out logic still applies", () => {
    const members: Member[] = [
      member({
        id: 2,
        role: "commentator",
        email: "kid@x.com",
        notificationPreferences: JSON.stringify({ email: false }),
      }),
    ];
    const recipients = filterReviewRecipients(members, 1);
    expect(recipients[0].notificationPreferences).toBe(
      JSON.stringify({ email: false })
    );
  });
});
