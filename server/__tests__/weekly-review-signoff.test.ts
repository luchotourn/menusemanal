import { describe, it, expect } from "vitest";

/**
 * Tests for the commentator sign-off flow on a weekly review.
 *
 * The POST /api/weekly-reviews/signoff endpoint lets a commentator close
 * the review loop by recording a verdict ("approved" or "changes_requested")
 * plus an optional note. The parent weekly_reviews row mirrors the latest
 * verdict so the creator sees one clear state.
 *
 * These tests are pure-logic counterparts to the storage layer — they document
 * the rules the route handler + storage upsert enforce, independent of DB.
 */

type Verdict = "approved" | "changes_requested";
type ParentStatus = "submitted" | "approved" | "changes_requested";

type Signoff = {
  id: number;
  weeklyReviewId: number;
  userId: number;
  verdict: Verdict;
  note: string | null;
};

type WeeklyReview = {
  id: number;
  status: ParentStatus;
  lastReviewedBy: number | null;
  lastReviewedAt: Date | null;
  lastReviewNote: string | null;
};

/**
 * Reproduces the storage layer's signoff upsert + parent-status recomputation.
 * One row per (weeklyReviewId, userId). Parent status is:
 *   - "changes_requested" if ANY signoff requests changes
 *   - "approved" otherwise (when there's at least one signoff)
 */
function applySignoff(
  signoffs: Signoff[],
  review: WeeklyReview,
  incoming: { userId: number; verdict: Verdict; note?: string },
  now: Date = new Date()
): { signoffs: Signoff[]; review: WeeklyReview } {
  const existing = signoffs.find(
    (s) => s.weeklyReviewId === review.id && s.userId === incoming.userId
  );
  let nextSignoffs: Signoff[];
  if (existing) {
    nextSignoffs = signoffs.map((s) =>
      s.id === existing.id
        ? { ...s, verdict: incoming.verdict, note: incoming.note ?? null }
        : s
    );
  } else {
    const nextId = (signoffs.reduce((max, s) => Math.max(max, s.id), 0) || 0) + 1;
    nextSignoffs = [
      ...signoffs,
      {
        id: nextId,
        weeklyReviewId: review.id,
        userId: incoming.userId,
        verdict: incoming.verdict,
        note: incoming.note ?? null,
      },
    ];
  }

  const reviewSignoffs = nextSignoffs.filter((s) => s.weeklyReviewId === review.id);
  const hasChangesRequested = reviewSignoffs.some((s) => s.verdict === "changes_requested");
  const status: ParentStatus = hasChangesRequested ? "changes_requested" : "approved";

  return {
    signoffs: nextSignoffs,
    review: {
      ...review,
      status,
      lastReviewedBy: incoming.userId,
      lastReviewedAt: now,
      lastReviewNote: incoming.note ?? null,
    },
  };
}

/**
 * Reproduces the storage layer's resubmit behavior: drop all signoffs for the
 * review and reset the parent to "submitted".
 */
function applyResubmit(
  signoffs: Signoff[],
  review: WeeklyReview,
  submitter: number,
  now: Date = new Date()
): { signoffs: Signoff[]; review: WeeklyReview } {
  return {
    signoffs: signoffs.filter((s) => s.weeklyReviewId !== review.id),
    review: {
      ...review,
      status: "submitted",
      lastReviewedBy: null,
      lastReviewedAt: null,
      lastReviewNote: null,
    },
  };
}

const newReview = (overrides: Partial<WeeklyReview> = {}): WeeklyReview => ({
  id: 1,
  status: "submitted",
  lastReviewedBy: null,
  lastReviewedAt: null,
  lastReviewNote: null,
  ...overrides,
});

describe("Weekly review sign-off — single commentator", () => {
  it("approving a fresh review sets status to 'approved' and records the reviewer", () => {
    const result = applySignoff([], newReview(), { userId: 7, verdict: "approved" });

    expect(result.signoffs.length).toBe(1);
    expect(result.signoffs[0].verdict).toBe("approved");
    expect(result.review.status).toBe("approved");
    expect(result.review.lastReviewedBy).toBe(7);
  });

  it("requesting changes sets status to 'changes_requested' and stores the note", () => {
    const result = applySignoff([], newReview(), {
      userId: 7,
      verdict: "changes_requested",
      note: "Cambiá el martes",
    });

    expect(result.review.status).toBe("changes_requested");
    expect(result.review.lastReviewNote).toBe("Cambiá el martes");
    expect(result.signoffs[0].note).toBe("Cambiá el martes");
  });

  it("commentator updating verdict (changes_requested → approved) replaces, not duplicates", () => {
    const first = applySignoff([], newReview(), { userId: 7, verdict: "changes_requested" });
    expect(first.review.status).toBe("changes_requested");

    const second = applySignoff(first.signoffs, first.review, { userId: 7, verdict: "approved" });

    expect(second.signoffs.length).toBe(1); // not duplicated
    expect(second.signoffs[0].verdict).toBe("approved");
    expect(second.review.status).toBe("approved");
  });

  it("note is cleared when commentator updates without a note", () => {
    const first = applySignoff([], newReview(), { userId: 7, verdict: "approved", note: "Buenísimo" });
    expect(first.signoffs[0].note).toBe("Buenísimo");

    const second = applySignoff(first.signoffs, first.review, { userId: 7, verdict: "changes_requested" });
    expect(second.signoffs[0].note).toBeNull();
  });
});

describe("Weekly review sign-off — multiple commentators", () => {
  it("two commentators both approving keeps status 'approved'", () => {
    const r0 = newReview();
    const r1 = applySignoff([], r0, { userId: 7, verdict: "approved" });
    const r2 = applySignoff(r1.signoffs, r1.review, { userId: 8, verdict: "approved" });

    expect(r2.signoffs.length).toBe(2);
    expect(r2.review.status).toBe("approved");
  });

  it("one approval + one changes_requested results in 'changes_requested' (pessimistic)", () => {
    const r0 = newReview();
    const r1 = applySignoff([], r0, { userId: 7, verdict: "approved" });
    const r2 = applySignoff(r1.signoffs, r1.review, { userId: 8, verdict: "changes_requested" });

    expect(r2.review.status).toBe("changes_requested");
  });

  it("status flips back to 'approved' when the changes_requested commentator updates to approved", () => {
    const r0 = newReview();
    const r1 = applySignoff([], r0, { userId: 7, verdict: "approved" });
    const r2 = applySignoff(r1.signoffs, r1.review, { userId: 8, verdict: "changes_requested" });
    expect(r2.review.status).toBe("changes_requested");

    const r3 = applySignoff(r2.signoffs, r2.review, { userId: 8, verdict: "approved" });
    expect(r3.review.status).toBe("approved");
  });

  it("signoffs from other reviews are not affected by the upsert", () => {
    // Review 1 has a signoff from user 7. Review 2 receives a new signoff from user 7.
    const initial: Signoff[] = [
      { id: 1, weeklyReviewId: 1, userId: 7, verdict: "approved", note: null },
    ];
    const otherReview = newReview({ id: 2 });

    const result = applySignoff(initial, otherReview, { userId: 7, verdict: "changes_requested" });

    expect(result.signoffs.length).toBe(2);
    expect(result.signoffs.find((s) => s.weeklyReviewId === 1)?.verdict).toBe("approved");
    expect(result.signoffs.find((s) => s.weeklyReviewId === 2)?.verdict).toBe("changes_requested");
  });
});

describe("Weekly review sign-off — resubmit clears signoffs", () => {
  it("resubmitting a week drops all signoffs for that review", () => {
    const r0 = newReview();
    const r1 = applySignoff([], r0, { userId: 7, verdict: "approved" });
    const r2 = applySignoff(r1.signoffs, r1.review, { userId: 8, verdict: "changes_requested" });
    expect(r2.signoffs.length).toBe(2);

    const after = applyResubmit(r2.signoffs, r2.review, 1);

    expect(after.signoffs.length).toBe(0);
    expect(after.review.status).toBe("submitted");
    expect(after.review.lastReviewedBy).toBeNull();
    expect(after.review.lastReviewedAt).toBeNull();
    expect(after.review.lastReviewNote).toBeNull();
  });

  it("resubmitting one week does NOT clear signoffs from other weeks", () => {
    const r0 = newReview({ id: 1 });
    const r1 = applySignoff([], r0, { userId: 7, verdict: "approved" });

    // Signoff for a different review
    const otherReviewSignoffs: Signoff[] = [
      ...r1.signoffs,
      { id: 99, weeklyReviewId: 2, userId: 7, verdict: "approved", note: null },
    ];

    const after = applyResubmit(otherReviewSignoffs, r1.review, 1);

    expect(after.signoffs.length).toBe(1);
    expect(after.signoffs[0].weeklyReviewId).toBe(2); // untouched
  });

  it("after resubmit a fresh approval recomputes status correctly", () => {
    const r0 = newReview();
    const r1 = applySignoff([], r0, { userId: 7, verdict: "changes_requested" });
    const reset = applyResubmit(r1.signoffs, r1.review, 1);
    expect(reset.review.status).toBe("submitted");

    const r2 = applySignoff(reset.signoffs, reset.review, { userId: 7, verdict: "approved" });
    expect(r2.signoffs.length).toBe(1);
    expect(r2.review.status).toBe("approved");
  });
});

describe("Weekly review sign-off — role enforcement contract", () => {
  // The endpoint POST /api/weekly-reviews/signoff is guarded by requireCommentatorRole.
  // These document the intended rules.

  type Member = { id: number; role: "creator" | "commentator" };

  function isAllowedToSignOff(user: Member): boolean {
    return user.role === "commentator";
  }

  it("a commentator is allowed to sign off", () => {
    expect(isAllowedToSignOff({ id: 1, role: "commentator" })).toBe(true);
  });

  it("a creator is NOT allowed to sign off (they're the submitter)", () => {
    // Creator submits the plan; sign-off is for the reviewer side of the loop.
    expect(isAllowedToSignOff({ id: 1, role: "creator" })).toBe(false);
  });
});

describe("Weekly review sign-off — submitter notification recipient", () => {
  // After a sign-off, the creator who submitted the week is notified.
  // The signing commentator is NOT notified (they just performed the action).

  type Member = { id: number; name: string; email: string; role: "creator" | "commentator" };

  function pickSignoffNotificationRecipient(
    members: Member[],
    submitterId: number,
    signerId: number
  ): Member | null {
    const submitter = members.find((m) => m.id === submitterId);
    if (!submitter) return null;
    if (submitter.id === signerId) return null; // edge: self-signoff impossible (different roles), but defensive
    return submitter;
  }

  const member = (overrides: Partial<Member>): Member => ({
    id: 1,
    name: "Member",
    email: "m@x.com",
    role: "creator",
    ...overrides,
  });

  it("notifies the submitter (creator) when a commentator signs off", () => {
    const members: Member[] = [
      member({ id: 1, role: "creator", email: "creator@x.com", name: "Creator" }),
      member({ id: 2, role: "commentator", email: "kid@x.com", name: "Kid" }),
    ];
    const recipient = pickSignoffNotificationRecipient(members, 1, 2);
    expect(recipient?.email).toBe("creator@x.com");
  });

  it("does not notify the signer themselves (defensive)", () => {
    const members: Member[] = [
      member({ id: 1, role: "creator", email: "creator@x.com" }),
    ];
    // submitterId === signerId → no email (would mean creator signed off, which is blocked by role guard anyway)
    const recipient = pickSignoffNotificationRecipient(members, 1, 1);
    expect(recipient).toBeNull();
  });

  it("returns null when the submitter is no longer in the family", () => {
    const members: Member[] = [
      member({ id: 2, role: "commentator", email: "kid@x.com" }),
    ];
    const recipient = pickSignoffNotificationRecipient(members, 999, 2);
    expect(recipient).toBeNull();
  });
});
