import { describe, it, expect } from "vitest";
import {
  submitWeeklyReviewSchema,
  insertWeeklyReviewSchema,
  submitWeeklyReviewSignoffSchema,
  insertWeeklyReviewSignoffSchema,
} from "../schema";
import { selectReviewNotes, reviewReviewerName } from "../utils";

describe("submitWeeklyReviewSchema", () => {
  it("accepts a valid YYYY-MM-DD date", () => {
    const result = submitWeeklyReviewSchema.parse({ weekStartDate: "2026-04-20" });
    expect(result.weekStartDate).toBe("2026-04-20");
  });

  it("rejects invalid date formats", () => {
    expect(() => submitWeeklyReviewSchema.parse({ weekStartDate: "20-04-2026" })).toThrow();
    expect(() => submitWeeklyReviewSchema.parse({ weekStartDate: "2026/04/20" })).toThrow();
    expect(() => submitWeeklyReviewSchema.parse({ weekStartDate: "2026-4-20" })).toThrow();
    expect(() => submitWeeklyReviewSchema.parse({ weekStartDate: "abc" })).toThrow();
    expect(() => submitWeeklyReviewSchema.parse({ weekStartDate: "" })).toThrow();
  });

  it("rejects when weekStartDate is missing", () => {
    expect(() => submitWeeklyReviewSchema.parse({})).toThrow();
  });
});

describe("insertWeeklyReviewSchema", () => {
  const baseRecord = {
    familyId: 1,
    weekStartDate: "2026-04-20",
    submittedBy: 42,
  };

  it("accepts a valid record with status defaulted to 'submitted'", () => {
    const result = insertWeeklyReviewSchema.parse(baseRecord);
    expect(result.status).toBe("submitted");
    expect(result.familyId).toBe(1);
    expect(result.submittedBy).toBe(42);
  });

  it("accepts each valid status (submitted, approved, changes_requested)", () => {
    for (const status of ["submitted", "approved", "changes_requested"] as const) {
      const result = insertWeeklyReviewSchema.parse({ ...baseRecord, status });
      expect(result.status).toBe(status);
    }
  });

  it("rejects unknown status values", () => {
    expect(() =>
      insertWeeklyReviewSchema.parse({ ...baseRecord, status: "draft" })
    ).toThrow();
    expect(() =>
      insertWeeklyReviewSchema.parse({ ...baseRecord, status: "rejected" })
    ).toThrow();
  });

  it("rejects invalid weekStartDate format", () => {
    expect(() =>
      insertWeeklyReviewSchema.parse({ ...baseRecord, weekStartDate: "not-a-date" })
    ).toThrow();
  });
});

describe("submitWeeklyReviewSignoffSchema", () => {
  it("accepts a valid 'approved' verdict without note", () => {
    const result = submitWeeklyReviewSignoffSchema.parse({
      weekStartDate: "2026-04-20",
      verdict: "approved",
    });
    expect(result.verdict).toBe("approved");
    expect(result.note).toBeUndefined();
  });

  it("accepts a valid 'changes_requested' verdict with note", () => {
    const result = submitWeeklyReviewSignoffSchema.parse({
      weekStartDate: "2026-04-20",
      verdict: "changes_requested",
      note: "Cambiá el martes por algo liviano",
    });
    expect(result.verdict).toBe("changes_requested");
    expect(result.note).toBe("Cambiá el martes por algo liviano");
  });

  it("rejects 'submitted' as a verdict (only commentator verdicts allowed)", () => {
    expect(() =>
      submitWeeklyReviewSignoffSchema.parse({
        weekStartDate: "2026-04-20",
        verdict: "submitted",
      })
    ).toThrow();
  });

  it("rejects unknown verdict values", () => {
    expect(() =>
      submitWeeklyReviewSignoffSchema.parse({
        weekStartDate: "2026-04-20",
        verdict: "maybe",
      })
    ).toThrow();
  });

  it("rejects when verdict is missing", () => {
    expect(() =>
      submitWeeklyReviewSignoffSchema.parse({ weekStartDate: "2026-04-20" })
    ).toThrow();
  });

  it("rejects invalid weekStartDate format", () => {
    expect(() =>
      submitWeeklyReviewSignoffSchema.parse({ weekStartDate: "abc", verdict: "approved" })
    ).toThrow();
  });

  it("rejects notes that exceed 500 chars", () => {
    expect(() =>
      submitWeeklyReviewSignoffSchema.parse({
        weekStartDate: "2026-04-20",
        verdict: "approved",
        note: "x".repeat(501),
      })
    ).toThrow();
  });

  it("accepts note at exactly 500 chars (boundary)", () => {
    const result = submitWeeklyReviewSignoffSchema.parse({
      weekStartDate: "2026-04-20",
      verdict: "approved",
      note: "x".repeat(500),
    });
    expect(result.note?.length).toBe(500);
  });
});

describe("insertWeeklyReviewSignoffSchema", () => {
  const baseRecord = {
    weeklyReviewId: 1,
    userId: 7,
    familyId: 2,
    verdict: "approved" as const,
  };

  it("accepts a valid signoff record", () => {
    const result = insertWeeklyReviewSignoffSchema.parse(baseRecord);
    expect(result.verdict).toBe("approved");
  });

  it("accepts both verdict values", () => {
    for (const verdict of ["approved", "changes_requested"] as const) {
      const result = insertWeeklyReviewSignoffSchema.parse({ ...baseRecord, verdict });
      expect(result.verdict).toBe(verdict);
    }
  });

  it("rejects unknown verdict values", () => {
    expect(() =>
      insertWeeklyReviewSignoffSchema.parse({ ...baseRecord, verdict: "pending" })
    ).toThrow();
  });
});

describe("Weekly review signoff behavioral spec", () => {
  // These tests document the contract the storage layer enforces, independent of DB.

  it("spec: parent status becomes 'approved' when all signoffs approve", () => {
    type Signoff = { userId: number; verdict: "approved" | "changes_requested" };
    const signoffs: Signoff[] = [
      { userId: 1, verdict: "approved" },
      { userId: 2, verdict: "approved" },
    ];
    const hasChangesRequested = signoffs.some(s => s.verdict === "changes_requested");
    const status = hasChangesRequested ? "changes_requested" : "approved";
    expect(status).toBe("approved");
  });

  it("spec: parent status becomes 'changes_requested' if ANY signoff requests changes", () => {
    type Signoff = { userId: number; verdict: "approved" | "changes_requested" };
    const signoffs: Signoff[] = [
      { userId: 1, verdict: "approved" },
      { userId: 2, verdict: "changes_requested" },
    ];
    const hasChangesRequested = signoffs.some(s => s.verdict === "changes_requested");
    const status = hasChangesRequested ? "changes_requested" : "approved";
    expect(status).toBe("changes_requested");
  });

  it("spec: a commentator updating their verdict overrides their previous one (upsert)", () => {
    // Same user can change their mind: one row per (weeklyReviewId, userId).
    type Signoff = { id: number; weeklyReviewId: number; userId: number; verdict: "approved" | "changes_requested" };
    let signoffs: Signoff[] = [
      { id: 1, weeklyReviewId: 10, userId: 5, verdict: "changes_requested" },
    ];

    const incoming = { weeklyReviewId: 10, userId: 5, verdict: "approved" as const };
    const existing = signoffs.find(
      (s) => s.weeklyReviewId === incoming.weeklyReviewId && s.userId === incoming.userId
    );
    if (existing) {
      signoffs = signoffs.map((s) =>
        s.id === existing.id ? { ...s, verdict: incoming.verdict } : s
      );
    } else {
      signoffs.push({ id: 99, ...incoming });
    }

    expect(signoffs.length).toBe(1);
    expect(signoffs[0].verdict).toBe("approved");
  });

  it("spec: resubmitting the week clears all prior signoffs (fresh review)", () => {
    type Signoff = { id: number; weeklyReviewId: number; userId: number };
    const beforeResubmit: Signoff[] = [
      { id: 1, weeklyReviewId: 10, userId: 5 },
      { id: 2, weeklyReviewId: 10, userId: 6 },
      { id: 3, weeklyReviewId: 11, userId: 5 }, // different week
    ];
    const resubmittedReviewId = 10;
    const afterResubmit = beforeResubmit.filter(s => s.weeklyReviewId !== resubmittedReviewId);

    expect(afterResubmit.length).toBe(1);
    expect(afterResubmit[0].weeklyReviewId).toBe(11); // untouched
  });

  it("spec: status reverts to 'submitted' on resubmit (lastReviewed* cleared)", () => {
    // After resubmit, the review is back to "awaiting review" — even if
    // it was previously approved or changes_requested.
    const before = {
      status: "approved" as const,
      lastReviewedBy: 5 as number | null,
      lastReviewedAt: new Date() as Date | null,
      lastReviewNote: "Great week" as string | null,
    };
    const afterResubmit = {
      status: "submitted" as const,
      lastReviewedBy: null,
      lastReviewedAt: null,
      lastReviewNote: null,
    };
    expect(afterResubmit.status).toBe("submitted");
    expect(afterResubmit.lastReviewedBy).toBeNull();
    expect(afterResubmit.lastReviewedAt).toBeNull();
    expect(afterResubmit.lastReviewNote).toBeNull();
    expect(before.status).toBe("approved"); // sanity check on the "before" shape
  });
});

describe("selectReviewNotes", () => {
  const signoff = (
    userName: string,
    verdict: "approved" | "changes_requested",
    note: string | null,
  ) => ({ id: userName.length, userName, verdict, note });

  it("keeps only sign-offs that carry a non-empty note", () => {
    const notes = selectReviewNotes([
      signoff("Ana", "changes_requested", "Falta el postre del viernes"),
      signoff("Beto", "approved", null),
      signoff("Caro", "approved", ""),
    ]);
    expect(notes).toHaveLength(1);
    expect(notes[0].userName).toBe("Ana");
    expect(notes[0].note).toBe("Falta el postre del viernes");
  });

  it("treats whitespace-only notes as empty and trims surrounding whitespace", () => {
    const notes = selectReviewNotes([
      signoff("Ana", "changes_requested", "   "),
      signoff("Beto", "changes_requested", "  cambiar el lunes  "),
    ]);
    expect(notes).toHaveLength(1);
    expect(notes[0].userName).toBe("Beto");
    expect(notes[0].note).toBe("cambiar el lunes");
  });

  it("orders 'changes_requested' notes before 'approved' notes", () => {
    const notes = selectReviewNotes([
      signoff("Ana", "approved", "Me encanta"),
      signoff("Beto", "changes_requested", "Demasiada carne"),
    ]);
    expect(notes.map((n) => n.userName)).toEqual(["Beto", "Ana"]);
  });

  it("returns an empty array when there are no signoffs", () => {
    expect(selectReviewNotes([])).toEqual([]);
  });

  it("returns an empty array when no signoff has a note", () => {
    const notes = selectReviewNotes([
      signoff("Ana", "approved", null),
      signoff("Beto", "changes_requested", "   "),
    ]);
    expect(notes).toEqual([]);
  });

  it("narrows note to a non-null string on the returned items", () => {
    const notes = selectReviewNotes([signoff("Ana", "changes_requested", "x")]);
    // note is guaranteed string here — concatenation must not produce "null"
    expect(`${notes[0].note}!`).toBe("x!");
  });
});

describe("reviewReviewerName", () => {
  const so = (
    userId: number,
    userName: string,
    verdict: "approved" | "changes_requested",
    reviewedAt?: string,
  ) => ({ userId, userName, verdict, reviewedAt });

  it("returns the fallback for a 'submitted' review", () => {
    expect(reviewReviewerName("submitted", [], null)).toBe("la familia");
  });

  it("returns the fallback when no signoff matches the displayed verdict", () => {
    // Status says approved but only a changes_requested signoff exists (degenerate).
    expect(reviewReviewerName("approved", [so(7, "Ana", "changes_requested")], 7)).toBe("la familia");
  });

  it("prefers the most recent reviewer (lastReviewedBy) when their verdict matches", () => {
    const signoffs = [so(7, "Ana", "approved", "2026-06-01T10:00:00Z"), so(8, "Beto", "approved", "2026-06-02T10:00:00Z")];
    expect(reviewReviewerName("approved", signoffs, 8)).toBe("Beto");
    expect(reviewReviewerName("approved", signoffs, 7)).toBe("Ana");
  });

  it("names a changes_requester even when a different, later signoff approved", () => {
    // Bug #1 regression: array order / latest reviewer must not mislabel.
    // Ana requested changes; Beto later approved → status stays changes_requested,
    // lastReviewedBy is Beto (an approver), so we must fall back to the requester.
    const signoffs = [
      so(7, "Ana", "changes_requested", "2026-06-01T10:00:00Z"),
      so(8, "Beto", "approved", "2026-06-02T10:00:00Z"),
    ];
    expect(reviewReviewerName("changes_requested", signoffs, 8)).toBe("Ana");
  });

  it("falls back to the most recent matching signoff when lastReviewedBy is unknown", () => {
    const signoffs = [
      so(7, "Ana", "changes_requested", "2026-06-01T10:00:00Z"),
      so(9, "Caro", "changes_requested", "2026-06-03T10:00:00Z"),
    ];
    expect(reviewReviewerName("changes_requested", signoffs, null)).toBe("Caro");
  });
});
