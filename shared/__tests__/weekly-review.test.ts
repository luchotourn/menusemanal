import { describe, it, expect } from "vitest";
import {
  submitWeeklyReviewSchema,
  insertWeeklyReviewSchema,
} from "../schema";

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

  it("accepts explicit status 'submitted'", () => {
    const result = insertWeeklyReviewSchema.parse({ ...baseRecord, status: "submitted" });
    expect(result.status).toBe("submitted");
  });

  it("rejects unknown status values", () => {
    expect(() =>
      insertWeeklyReviewSchema.parse({ ...baseRecord, status: "approved" })
    ).toThrow();
    expect(() =>
      insertWeeklyReviewSchema.parse({ ...baseRecord, status: "draft" })
    ).toThrow();
  });

  it("rejects invalid weekStartDate format", () => {
    expect(() =>
      insertWeeklyReviewSchema.parse({ ...baseRecord, weekStartDate: "not-a-date" })
    ).toThrow();
  });
});
