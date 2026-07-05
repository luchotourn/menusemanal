import { describe, it, expect } from "vitest";
import {
  weeklyPlanDraftItemSchema,
  generateWeeklyPlanRequestSchema,
  updateWeeklyPlanDraftItemsSchema,
  plannerPromptSchema,
  insertWeeklyPlanDraftSchema,
} from "../schema";

const validItem = {
  fecha: "2026-07-06",
  tipoComida: "almuerzo" as const,
  recetaId: 5,
};

// ─────────────────────────────────────────────────────────────────────────────
// weeklyPlanDraftItemSchema
// ─────────────────────────────────────────────────────────────────────────────

describe("weeklyPlanDraftItemSchema", () => {
  it("accepts a valid item without razon (optional)", () => {
    const result = weeklyPlanDraftItemSchema.parse(validItem);
    expect(result.fecha).toBe("2026-07-06");
    expect(result.tipoComida).toBe("almuerzo");
    expect(result.recetaId).toBe(5);
    expect(result.razon).toBeUndefined();
  });

  it("accepts a valid item with razon", () => {
    const result = weeklyPlanDraftItemSchema.parse({
      ...validItem,
      razon: "A los chicos les encanta",
    });
    expect(result.razon).toBe("A los chicos les encanta");
  });

  it("accepts both tipoComida values", () => {
    for (const tipoComida of ["almuerzo", "cena"] as const) {
      const result = weeklyPlanDraftItemSchema.parse({ ...validItem, tipoComida });
      expect(result.tipoComida).toBe(tipoComida);
    }
  });

  it("rejects fechas that do not match YYYY-MM-DD", () => {
    expect(() => weeklyPlanDraftItemSchema.parse({ ...validItem, fecha: "2026-7-6" })).toThrow();
    expect(() => weeklyPlanDraftItemSchema.parse({ ...validItem, fecha: "06/07/2026" })).toThrow();
    expect(() => weeklyPlanDraftItemSchema.parse({ ...validItem, fecha: "" })).toThrow();
  });

  it("rejects impossible calendar dates that pass the regex", () => {
    for (const fecha of ["2026-02-31", "2026-13-45", "2023-02-29"]) {
      const result = weeklyPlanDraftItemSchema.safeParse({ ...validItem, fecha });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Fecha inválida");
      }
    }
  });

  it("rejects unknown tipoComida values with a Spanish message", () => {
    const result = weeklyPlanDraftItemSchema.safeParse({
      ...validItem,
      tipoComida: "desayuno",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing tipoComida with the Spanish required message", () => {
    const { tipoComida, ...withoutTipo } = validItem;
    const result = weeklyPlanDraftItemSchema.safeParse(withoutTipo);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("El tipo de comida es requerido");
    }
  });

  it("rejects non-positive, non-integer, or non-numeric recetaId", () => {
    expect(() => weeklyPlanDraftItemSchema.parse({ ...validItem, recetaId: 0 })).toThrow();
    expect(() => weeklyPlanDraftItemSchema.parse({ ...validItem, recetaId: -3 })).toThrow();
    expect(() => weeklyPlanDraftItemSchema.parse({ ...validItem, recetaId: 1.5 })).toThrow();
    expect(() => weeklyPlanDraftItemSchema.parse({ ...validItem, recetaId: "5" })).toThrow();
  });

  it("accepts razon at exactly 300 chars (boundary)", () => {
    const result = weeklyPlanDraftItemSchema.parse({
      ...validItem,
      razon: "x".repeat(300),
    });
    expect(result.razon?.length).toBe(300);
  });

  it("rejects razon over 300 chars with a Spanish message", () => {
    const result = weeklyPlanDraftItemSchema.safeParse({
      ...validItem,
      razon: "x".repeat(301),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("La razón es demasiado larga");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateWeeklyPlanRequestSchema
// ─────────────────────────────────────────────────────────────────────────────

describe("generateWeeklyPlanRequestSchema", () => {
  it("accepts a Monday and defaults replaceWeek to false", () => {
    const result = generateWeeklyPlanRequestSchema.parse({
      weekStartDate: "2026-07-06",
    });
    expect(result.weekStartDate).toBe("2026-07-06");
    expect(result.replaceWeek).toBe(false);
    expect(result.instructions).toBeUndefined();
  });

  it("accepts explicit replaceWeek and instructions", () => {
    const result = generateWeeklyPlanRequestSchema.parse({
      weekStartDate: "2026-07-06",
      instructions: "Sin pescado esta semana",
      replaceWeek: true,
    });
    expect(result.replaceWeek).toBe(true);
    expect(result.instructions).toBe("Sin pescado esta semana");
  });

  it("rejects a Sunday with 'La fecha debe ser un lunes'", () => {
    const result = generateWeeklyPlanRequestSchema.safeParse({
      weekStartDate: "2026-07-05",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("La fecha debe ser un lunes");
    }
  });

  it("rejects every non-Monday day of the week", () => {
    for (const weekStartDate of [
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
    ]) {
      expect(generateWeeklyPlanRequestSchema.safeParse({ weekStartDate }).success).toBe(false);
    }
  });

  it("accepts boundary Mondays (year boundary, leap February)", () => {
    expect(
      generateWeeklyPlanRequestSchema.safeParse({ weekStartDate: "2024-12-30" }).success
    ).toBe(true);
    expect(
      generateWeeklyPlanRequestSchema.safeParse({ weekStartDate: "2024-02-26" }).success
    ).toBe(true);
  });

  it("rejects malformed dates with the regex message before the Monday refine", () => {
    const result = generateWeeklyPlanRequestSchema.safeParse({
      weekStartDate: "2026-7-6",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Fecha inválida");
    }
  });

  it("rejects impossible calendar dates that pass the regex (2026-02-30)", () => {
    const result = generateWeeklyPlanRequestSchema.safeParse({
      weekStartDate: "2026-02-30",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("La fecha debe ser un lunes");
    }
  });

  it("accepts instructions at exactly 2000 chars and rejects 2001", () => {
    expect(
      generateWeeklyPlanRequestSchema.safeParse({
        weekStartDate: "2026-07-06",
        instructions: "x".repeat(2000),
      }).success
    ).toBe(true);
    const tooLong = generateWeeklyPlanRequestSchema.safeParse({
      weekStartDate: "2026-07-06",
      instructions: "x".repeat(2001),
    });
    expect(tooLong.success).toBe(false);
    if (!tooLong.success) {
      expect(tooLong.error.issues[0].message).toBe("Las instrucciones son demasiado largas");
    }
  });

  it("rejects non-boolean replaceWeek", () => {
    expect(
      generateWeeklyPlanRequestSchema.safeParse({
        weekStartDate: "2026-07-06",
        replaceWeek: "true",
      }).success
    ).toBe(false);
    expect(
      generateWeeklyPlanRequestSchema.safeParse({
        weekStartDate: "2026-07-06",
        replaceWeek: 1,
      }).success
    ).toBe(false);
  });

  it("rejects when weekStartDate is missing", () => {
    expect(generateWeeklyPlanRequestSchema.safeParse({}).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateWeeklyPlanDraftItemsSchema
// ─────────────────────────────────────────────────────────────────────────────

describe("updateWeeklyPlanDraftItemsSchema", () => {
  const makeItems = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      ...validItem,
      recetaId: index + 1,
    }));

  it("accepts a single item (lower boundary)", () => {
    const result = updateWeeklyPlanDraftItemsSchema.parse({ items: makeItems(1) });
    expect(result.items).toHaveLength(1);
  });

  it("accepts exactly 14 items (upper boundary)", () => {
    const result = updateWeeklyPlanDraftItemsSchema.parse({ items: makeItems(14) });
    expect(result.items).toHaveLength(14);
  });

  it("rejects an empty items array with a Spanish message", () => {
    const result = updateWeeklyPlanDraftItemsSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("El borrador debe tener al menos una comida");
    }
  });

  it("rejects 15 items with a Spanish message", () => {
    const result = updateWeeklyPlanDraftItemsSchema.safeParse({ items: makeItems(15) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("El borrador no puede tener más de 14 comidas");
    }
  });

  it("rejects when any nested item is invalid", () => {
    const items = [...makeItems(2), { ...validItem, recetaId: 0 }];
    expect(updateWeeklyPlanDraftItemsSchema.safeParse({ items }).success).toBe(false);
  });

  it("rejects when items is missing entirely", () => {
    expect(updateWeeklyPlanDraftItemsSchema.safeParse({}).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// plannerPromptSchema
// ─────────────────────────────────────────────────────────────────────────────

describe("plannerPromptSchema", () => {
  it("accepts a normal profile text", () => {
    const result = plannerPromptSchema.parse({
      plannerPrompt: "Somos 4, los chicos no comen picante",
    });
    expect(result.plannerPrompt).toBe("Somos 4, los chicos no comen picante");
  });

  it("accepts an empty string (clears the profile)", () => {
    const result = plannerPromptSchema.parse({ plannerPrompt: "" });
    expect(result.plannerPrompt).toBe("");
  });

  it("accepts exactly 2000 chars (boundary)", () => {
    const result = plannerPromptSchema.parse({ plannerPrompt: "x".repeat(2000) });
    expect(result.plannerPrompt.length).toBe(2000);
  });

  it("rejects 2001 chars with a Spanish message", () => {
    const result = plannerPromptSchema.safeParse({ plannerPrompt: "x".repeat(2001) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("El perfil es demasiado largo");
    }
  });

  it("rejects missing or non-string plannerPrompt", () => {
    expect(plannerPromptSchema.safeParse({}).success).toBe(false);
    expect(plannerPromptSchema.safeParse({ plannerPrompt: null }).success).toBe(false);
    expect(plannerPromptSchema.safeParse({ plannerPrompt: 5 }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// insertWeeklyPlanDraftSchema
// ─────────────────────────────────────────────────────────────────────────────

describe("insertWeeklyPlanDraftSchema", () => {
  const baseDraft = {
    familyId: 1,
    weekStartDate: "2026-07-06",
    createdBy: 2,
    items: [validItem],
  };

  it("accepts a valid record and defaults status/replaceWeek", () => {
    const result = insertWeeklyPlanDraftSchema.parse(baseDraft);
    expect(result.status).toBe("pending");
    expect(result.replaceWeek).toBe(0);
    expect(result.items).toHaveLength(1);
  });

  it("accepts each valid status", () => {
    for (const status of ["pending", "applied", "discarded"] as const) {
      const result = insertWeeklyPlanDraftSchema.parse({ ...baseDraft, status });
      expect(result.status).toBe(status);
    }
  });

  it("rejects unknown status values", () => {
    expect(
      insertWeeklyPlanDraftSchema.safeParse({ ...baseDraft, status: "approved" }).success
    ).toBe(false);
  });

  it("accepts replaceWeek 0/1 and rejects other numbers (house 0/1 bool)", () => {
    expect(insertWeeklyPlanDraftSchema.parse({ ...baseDraft, replaceWeek: 1 }).replaceWeek).toBe(1);
    expect(insertWeeklyPlanDraftSchema.parse({ ...baseDraft, replaceWeek: 0 }).replaceWeek).toBe(0);
    expect(insertWeeklyPlanDraftSchema.safeParse({ ...baseDraft, replaceWeek: 2 }).success).toBe(false);
    expect(insertWeeklyPlanDraftSchema.safeParse({ ...baseDraft, replaceWeek: -1 }).success).toBe(false);
  });

  it("rejects a non-Monday weekStartDate", () => {
    const result = insertWeeklyPlanDraftSchema.safeParse({
      ...baseDraft,
      weekStartDate: "2026-07-07",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("La fecha debe ser un lunes");
    }
  });

  it("rejects an empty items array and more than 14 items", () => {
    expect(insertWeeklyPlanDraftSchema.safeParse({ ...baseDraft, items: [] }).success).toBe(false);
    const tooMany = Array.from({ length: 15 }, () => validItem);
    expect(insertWeeklyPlanDraftSchema.safeParse({ ...baseDraft, items: tooMany }).success).toBe(false);
  });

  it("rejects when required ownership fields are missing", () => {
    const { familyId, ...withoutFamily } = baseDraft;
    expect(insertWeeklyPlanDraftSchema.safeParse(withoutFamily).success).toBe(false);
    const { createdBy, ...withoutCreator } = baseDraft;
    expect(insertWeeklyPlanDraftSchema.safeParse(withoutCreator).success).toBe(false);
  });

  it("accepts optional instructions/summary/model and enforces instructions cap", () => {
    const result = insertWeeklyPlanDraftSchema.parse({
      ...baseDraft,
      instructions: "Semana liviana",
      summary: "Una semana variada con dos pastas",
      model: "claude-opus-4-8",
    });
    expect(result.summary).toBe("Una semana variada con dos pastas");
    expect(result.model).toBe("claude-opus-4-8");
    expect(
      insertWeeklyPlanDraftSchema.safeParse({
        ...baseDraft,
        instructions: "x".repeat(2001),
      }).success
    ).toBe(false);
  });
});
