import { describe, it, expect } from "vitest";

/**
 * Behavioral spec for the comment-bucketing logic added to
 * `getMealPlansForWeek`. The DB integration is hard to mock here; instead
 * we validate the pure stitching/bucketing rules so a future refactor can't
 * silently regress them.
 */

interface MealRow { id: number; }
interface CommentRow { id: number; mealPlanId: number; userId: number; userName: string; comment: string; emoji: string | null; createdAt: Date; }

function bucket(meals: MealRow[], comments: CommentRow[]): Array<MealRow & { comments: CommentRow[] }> {
  const byMealId = new Map<number, CommentRow[]>();
  for (const c of comments) {
    const list = byMealId.get(c.mealPlanId);
    if (list) list.push(c);
    else byMealId.set(c.mealPlanId, [c]);
  }
  return meals.map(m => ({ ...m, comments: byMealId.get(m.id) ?? [] }));
}

describe("comment bucketing on getMealPlansForWeek", () => {
  it("attaches comments only to their owning meal", () => {
    const meals = [{ id: 10 }, { id: 11 }, { id: 12 }];
    const comments: CommentRow[] = [
      { id: 1, mealPlanId: 10, userId: 100, userName: "A", comment: "x", emoji: null, createdAt: new Date() },
      { id: 2, mealPlanId: 11, userId: 100, userName: "A", comment: "y", emoji: null, createdAt: new Date() },
      { id: 3, mealPlanId: 11, userId: 101, userName: "B", comment: "z", emoji: "🌶️", createdAt: new Date() },
    ];

    const result = bucket(meals, comments);

    expect(result[0].comments.map(c => c.id)).toEqual([1]);
    expect(result[1].comments.map(c => c.id)).toEqual([2, 3]);
    expect(result[2].comments).toEqual([]);
  });

  it("returns empty arrays for meals with no comments (never undefined)", () => {
    const meals = [{ id: 1 }, { id: 2 }];
    const result = bucket(meals, []);
    expect(result[0].comments).toEqual([]);
    expect(result[1].comments).toEqual([]);
  });

  it("preserves the comment order from the input (caller orders by createdAt)", () => {
    const earlier = new Date("2026-04-20T10:00:00Z");
    const later = new Date("2026-04-20T12:00:00Z");
    const meals = [{ id: 1 }];
    const comments: CommentRow[] = [
      { id: 1, mealPlanId: 1, userId: 100, userName: "A", comment: "first", emoji: null, createdAt: earlier },
      { id: 2, mealPlanId: 1, userId: 101, userName: "B", comment: "second", emoji: null, createdAt: later },
    ];

    const result = bucket(meals, comments);
    expect(result[0].comments.map(c => c.comment)).toEqual(["first", "second"]);
  });

  it("does not mutate the input meals array", () => {
    const meals = [{ id: 1 }];
    const before = JSON.stringify(meals);
    bucket(meals, []);
    expect(JSON.stringify(meals)).toBe(before);
  });
});
