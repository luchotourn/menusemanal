import { describe, it, expect } from "vitest";
import {
  createMealProposalSchema,
  reviewMealProposalSchema,
  insertMealProposalSchema,
} from "../schema";

describe("createMealProposalSchema", () => {
  it("accepts a valid payload", () => {
    const result = createMealProposalSchema.parse({
      proposedRecipeId: 5,
      reason: "Prefiero algo más liviano",
    });
    expect(result.proposedRecipeId).toBe(5);
    expect(result.reason).toBe("Prefiero algo más liviano");
  });

  it("accepts a payload without reason (optional)", () => {
    const result = createMealProposalSchema.parse({ proposedRecipeId: 5 });
    expect(result.proposedRecipeId).toBe(5);
    expect(result.reason).toBeUndefined();
  });

  it("rejects when proposedRecipeId is missing", () => {
    expect(() => createMealProposalSchema.parse({ reason: "x" })).toThrow();
  });

  it("rejects when proposedRecipeId is not a positive integer", () => {
    expect(() => createMealProposalSchema.parse({ proposedRecipeId: 0 })).toThrow();
    expect(() => createMealProposalSchema.parse({ proposedRecipeId: -1 })).toThrow();
    expect(() => createMealProposalSchema.parse({ proposedRecipeId: "5" })).toThrow();
  });

  it("rejects when reason exceeds 500 chars", () => {
    expect(() =>
      createMealProposalSchema.parse({
        proposedRecipeId: 5,
        reason: "x".repeat(501),
      })
    ).toThrow();
  });

  it("accepts reason at exactly 500 chars (boundary)", () => {
    const result = createMealProposalSchema.parse({
      proposedRecipeId: 5,
      reason: "x".repeat(500),
    });
    expect(result.reason?.length).toBe(500);
  });
});

describe("reviewMealProposalSchema", () => {
  it("accepts 'accepted' status", () => {
    const result = reviewMealProposalSchema.parse({ status: "accepted" });
    expect(result.status).toBe("accepted");
  });

  it("accepts 'rejected' status", () => {
    const result = reviewMealProposalSchema.parse({ status: "rejected" });
    expect(result.status).toBe("rejected");
  });

  it("rejects 'pending' (admin can only accept/reject, not revert)", () => {
    expect(() => reviewMealProposalSchema.parse({ status: "pending" })).toThrow();
  });

  it("rejects unknown status values", () => {
    expect(() => reviewMealProposalSchema.parse({ status: "approved" })).toThrow();
    expect(() => reviewMealProposalSchema.parse({})).toThrow();
  });
});

describe("insertMealProposalSchema", () => {
  const baseRecord = {
    mealPlanId: 1,
    familyId: 2,
    proposedBy: 3,
    proposedRecipeId: 4,
  };

  it("accepts a valid record with status defaulted to 'pending'", () => {
    const result = insertMealProposalSchema.parse(baseRecord);
    expect(result.status).toBe("pending");
  });

  it("rejects unknown status values", () => {
    expect(() =>
      insertMealProposalSchema.parse({ ...baseRecord, status: "approved" })
    ).toThrow();
  });

  it("accepts each valid status", () => {
    for (const status of ["pending", "accepted", "rejected"] as const) {
      const result = insertMealProposalSchema.parse({ ...baseRecord, status });
      expect(result.status).toBe(status);
    }
  });
});

describe("Proposal accept/reject behavioral spec", () => {
  // These are pure assertions about the rules the storage layer enforces.
  // They document the contract independent of the DB integration.

  it("spec: accepting one proposal auto-rejects sibling pending proposals on the same meal", () => {
    const proposals = [
      { id: 1, mealPlanId: 10, status: "pending" as const, proposedBy: 100 },
      { id: 2, mealPlanId: 10, status: "pending" as const, proposedBy: 101 },
      { id: 3, mealPlanId: 10, status: "pending" as const, proposedBy: 102 },
      { id: 4, mealPlanId: 11, status: "pending" as const, proposedBy: 100 }, // different meal
    ];
    const acceptedId = 1;

    const after = proposals.map((p) => {
      if (p.id === acceptedId) return { ...p, status: "accepted" as const };
      if (p.mealPlanId === 10 && p.status === "pending") return { ...p, status: "rejected" as const };
      return p;
    });

    expect(after.find((p) => p.id === 1)?.status).toBe("accepted");
    expect(after.find((p) => p.id === 2)?.status).toBe("rejected");
    expect(after.find((p) => p.id === 3)?.status).toBe("rejected");
    // Different meal — unaffected
    expect(after.find((p) => p.id === 4)?.status).toBe("pending");
  });

  it("spec: rejecting a proposal does NOT touch the meal plan or other proposals", () => {
    const proposals = [
      { id: 1, mealPlanId: 10, status: "pending" as const, proposedBy: 100 },
      { id: 2, mealPlanId: 10, status: "pending" as const, proposedBy: 101 },
    ];
    const rejectedId = 1;

    const after = proposals.map((p) =>
      p.id === rejectedId ? { ...p, status: "rejected" as const } : p
    );

    expect(after.find((p) => p.id === 1)?.status).toBe("rejected");
    expect(after.find((p) => p.id === 2)?.status).toBe("pending"); // untouched
  });

  it("spec: a user gets at most one pending proposal per meal (replace policy)", () => {
    let proposals = [
      { id: 1, mealPlanId: 10, status: "pending" as const, proposedBy: 100, recipeId: 5 },
    ];

    // User 100 proposes again on meal 10 — old one should be replaced (not duplicated)
    const newProposal = { mealPlanId: 10, proposedBy: 100, recipeId: 7 };
    const existing = proposals.find(
      (p) => p.mealPlanId === newProposal.mealPlanId &&
              p.proposedBy === newProposal.proposedBy &&
              p.status === "pending"
    );
    if (existing) {
      proposals = proposals.map((p) => p.id === existing.id ? { ...p, recipeId: newProposal.recipeId } : p);
    } else {
      proposals.push({ id: 99, mealPlanId: 10, status: "pending", proposedBy: 100, recipeId: newProposal.recipeId });
    }

    expect(proposals.length).toBe(1);
    expect(proposals[0].recipeId).toBe(7);
  });
});
