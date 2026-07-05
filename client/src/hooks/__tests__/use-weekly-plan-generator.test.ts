import { describe, it, expect } from "vitest";
import {
  parseErrorStatus,
  extractServerErrorMessage,
  describeWeeklyPlanError,
  describeApplyResult,
  groupDraftItemsByDay,
  formatDayHeading,
  toDraftItemsPayload,
  swapDraftItem,
  removeDraftItem,
  groupRecipesByCategory,
  type EnrichedDraftItem,
} from "../use-weekly-plan-generator";

// ─── Test fixtures ───────────────────────────────────────────────────────────

const WEEK_START = "2026-07-06"; // a Monday

function makeItem(overrides: Partial<EnrichedDraftItem> = {}): EnrichedDraftItem {
  return {
    fecha: WEEK_START,
    tipoComida: "almuerzo",
    recetaId: 1,
    razon: "A los chicos les encanta",
    acompanamientoId: null,
    recipe: {
      id: 1,
      nombre: "Milanesas con puré",
      categoria: "Plato Principal",
      calificacionNinos: 5,
      esFavorita: 1,
      tiempoPreparacion: 40,
      imagen: null,
    },
    acompanamientoRecipe: null,
    ...overrides,
  };
}

// ─── parseErrorStatus ────────────────────────────────────────────────────────

describe("parseErrorStatus", () => {
  it("extracts the status from a jsonApiRequest error message", () => {
    expect(parseErrorStatus('503: {"error":"El servicio de IA no está configurado"}')).toBe(503);
    expect(parseErrorStatus("429: Too Many Requests")).toBe(429);
    expect(parseErrorStatus("400: {}")).toBe(400);
  });

  it("returns null when the message has no status prefix", () => {
    expect(parseErrorStatus("Failed to fetch")).toBeNull();
    expect(parseErrorStatus("")).toBeNull();
    expect(parseErrorStatus("error 503 happened")).toBeNull();
  });
});

// ─── extractServerErrorMessage ───────────────────────────────────────────────

describe("extractServerErrorMessage", () => {
  it("extracts the Spanish error from a JSON body", () => {
    expect(
      extractServerErrorMessage('400: {"error":"Necesitás recetas en tu biblioteca para generar un plan."}')
    ).toBe("Necesitás recetas en tu biblioteca para generar un plan.");
  });

  it("handles multi-line JSON bodies", () => {
    expect(extractServerErrorMessage('400: {\n  "error": "Borrador no encontrado"\n}')).toBe(
      "Borrador no encontrado"
    );
  });

  it("returns null for non-JSON bodies", () => {
    expect(extractServerErrorMessage("500: Internal Server Error")).toBeNull();
  });

  it("returns null when the body has no string error field", () => {
    expect(extractServerErrorMessage('400: {"message":"otra cosa"}')).toBeNull();
    expect(extractServerErrorMessage('400: {"error":123}')).toBeNull();
    expect(extractServerErrorMessage('400: {"error":""}')).toBeNull();
  });

  it("returns null when there is no status prefix", () => {
    expect(extractServerErrorMessage('{"error":"sin prefijo"}')).toBeNull();
  });
});

// ─── describeWeeklyPlanError ─────────────────────────────────────────────────

describe("describeWeeklyPlanError", () => {
  it("maps 503 to the friendly AI-unavailable copy", () => {
    const message = describeWeeklyPlanError(
      new Error('503: {"error":"El servicio de IA no está configurado"}'),
      "Intentá de nuevo."
    );
    expect(message).toBe(
      "El servicio de IA no está disponible en este momento. Verificá que la API key esté configurada."
    );
  });

  it("maps 429 to rate-limit copy that honestly says minutes (15-minute window)", () => {
    const message = describeWeeklyPlanError(new Error("429: Too Many Requests"), "Intentá de nuevo.");
    expect(message).toBe("Hiciste demasiadas generaciones seguidas. Esperá unos minutos e intentá de nuevo.");
  });

  it("surfaces the server's 502 AI-unavailable message", () => {
    const message = describeWeeklyPlanError(
      new Error('502: {"error":"El servicio de IA no está disponible en este momento. Intentá de nuevo en unos minutos."}'),
      "Intentá de nuevo."
    );
    expect(message).toBe(
      "El servicio de IA no está disponible en este momento. Intentá de nuevo en unos minutos."
    );
  });

  it("surfaces the server's Spanish message for other statuses", () => {
    const message = describeWeeklyPlanError(
      new Error('400: {"error":"La semana ya está completa. Activá \\"Regenerar toda la semana\\" para reemplazarla."}'),
      "Intentá de nuevo."
    );
    expect(message).toBe(
      'La semana ya está completa. Activá "Regenerar toda la semana" para reemplazarla.'
    );
  });

  it("falls back on unparseable errors", () => {
    expect(describeWeeklyPlanError(new Error("Failed to fetch"), "Intentá de nuevo.")).toBe(
      "Intentá de nuevo."
    );
    expect(describeWeeklyPlanError(undefined, "Intentá de nuevo.")).toBe("Intentá de nuevo.");
  });
});

// ─── describeApplyResult ─────────────────────────────────────────────────────

describe("describeApplyResult", () => {
  it("reports only the applied count when nothing was skipped", () => {
    expect(describeApplyResult({ applied: 5, skipped: 0 })).toBe(
      "Se agregaron 5 comidas al plan."
    );
    expect(describeApplyResult({ applied: 1, skipped: 0 })).toBe(
      "Se agregaron 1 comida al plan."
    );
  });

  it("surfaces a single skipped suggestion", () => {
    expect(describeApplyResult({ applied: 3, skipped: 1 })).toBe(
      "Se agregaron 3 comidas al plan. 1 sugerencia no se aplicó porque ese casillero ya estaba ocupado."
    );
  });

  it("surfaces multiple skipped suggestions", () => {
    expect(describeApplyResult({ applied: 2, skipped: 3 })).toBe(
      "Se agregaron 2 comidas al plan. 3 sugerencias no se aplicaron porque esos casilleros ya estaban ocupados."
    );
  });

  it("still mentions the skips when zero meals were applied", () => {
    const message = describeApplyResult({ applied: 0, skipped: 4 });
    expect(message).toContain("Se agregaron 0 comidas al plan.");
    expect(message).toContain("4 sugerencias no se aplicaron");
  });
});

// ─── groupDraftItemsByDay ────────────────────────────────────────────────────

describe("groupDraftItemsByDay", () => {
  it("returns 7 day groups, Monday through Sunday", () => {
    const groups = groupDraftItemsByDay(WEEK_START, []);
    expect(groups).toHaveLength(7);
    expect(groups[0].fecha).toBe("2026-07-06");
    expect(groups[6].fecha).toBe("2026-07-12");
    expect(groups.every((g) => g.almuerzo === null && g.cena === null)).toBe(true);
  });

  it("assigns items to their day and meal slot", () => {
    const lunch = makeItem({ fecha: "2026-07-07", tipoComida: "almuerzo", recetaId: 2 });
    const dinner = makeItem({ fecha: "2026-07-07", tipoComida: "cena", recetaId: 3 });
    const groups = groupDraftItemsByDay(WEEK_START, [dinner, lunch]);
    expect(groups[1].almuerzo?.recetaId).toBe(2);
    expect(groups[1].cena?.recetaId).toBe(3);
    expect(groups[0].almuerzo).toBeNull();
  });

  it("ignores items outside the week", () => {
    const outside = makeItem({ fecha: "2026-07-13", tipoComida: "almuerzo" });
    const groups = groupDraftItemsByDay(WEEK_START, [outside]);
    expect(groups.every((g) => g.almuerzo === null && g.cena === null)).toBe(true);
  });

  it("keeps the first item when a slot is duplicated", () => {
    const first = makeItem({ recetaId: 10 });
    const dupe = makeItem({ recetaId: 20 });
    const groups = groupDraftItemsByDay(WEEK_START, [first, dupe]);
    expect(groups[0].almuerzo?.recetaId).toBe(10);
  });

  it("spans month boundaries correctly", () => {
    // 2026-06-29 is a Monday; the week ends on 2026-07-05
    const groups = groupDraftItemsByDay("2026-06-29", []);
    expect(groups[0].fecha).toBe("2026-06-29");
    expect(groups[2].fecha).toBe("2026-07-01");
    expect(groups[6].fecha).toBe("2026-07-05");
  });
});

// ─── formatDayHeading ────────────────────────────────────────────────────────

describe("formatDayHeading", () => {
  it("combines the weekday name (by week position) with the day of month", () => {
    expect(formatDayHeading("2026-07-06", 0)).toBe("Lunes 6");
    expect(formatDayHeading("2026-07-08", 2)).toBe("Miércoles 8");
    expect(formatDayHeading("2026-07-12", 6)).toBe("Domingo 12");
  });

  it("strips the leading zero from the day of month", () => {
    expect(formatDayHeading("2026-07-01", 2)).toBe("Miércoles 1");
  });
});

// ─── toDraftItemsPayload ─────────────────────────────────────────────────────

describe("toDraftItemsPayload", () => {
  it("strips the recipe enrichment", () => {
    const payload = toDraftItemsPayload([makeItem()]);
    expect(payload).toEqual([
      {
        fecha: WEEK_START,
        tipoComida: "almuerzo",
        recetaId: 1,
        razon: "A los chicos les encanta",
      },
    ]);
    expect(payload[0]).not.toHaveProperty("recipe");
    expect(payload[0]).not.toHaveProperty("acompanamientoRecipe");
  });

  it("omits razon when the item has none", () => {
    const payload = toDraftItemsPayload([makeItem({ razon: undefined })]);
    expect(payload[0]).not.toHaveProperty("razon");
  });

  it("preserves a numeric acompanamientoId and omits a null one", () => {
    const paired = toDraftItemsPayload([makeItem({ acompanamientoId: 50 })]);
    expect(paired[0].acompanamientoId).toBe(50);
    const unpaired = toDraftItemsPayload([makeItem({ acompanamientoId: null })]);
    expect(unpaired[0]).not.toHaveProperty("acompanamientoId");
  });
});

// ─── swapDraftItem ───────────────────────────────────────────────────────────

describe("swapDraftItem", () => {
  it("replaces the recipe of the matching slot only", () => {
    const items = [
      makeItem({ fecha: "2026-07-06", tipoComida: "almuerzo", recetaId: 1 }),
      makeItem({ fecha: "2026-07-06", tipoComida: "cena", recetaId: 2 }),
    ];
    const payload = swapDraftItem(items, "2026-07-06", "almuerzo", 99);
    expect(payload).toHaveLength(2);
    expect(payload[0].recetaId).toBe(99);
    expect(payload[1].recetaId).toBe(2);
    expect(payload[1].razon).toBe("A los chicos les encanta");
  });

  it("drops the AI razon from the swapped item", () => {
    const payload = swapDraftItem([makeItem()], WEEK_START, "almuerzo", 99);
    expect(payload[0]).not.toHaveProperty("razon");
  });

  it("keeps the attached side when swapping the main", () => {
    const payload = swapDraftItem([makeItem({ acompanamientoId: 50 })], WEEK_START, "almuerzo", 99);
    expect(payload[0].recetaId).toBe(99);
    expect(payload[0].acompanamientoId).toBe(50);
  });
});

// ─── removeDraftItem ─────────────────────────────────────────────────────────

describe("removeDraftItem", () => {
  it("removes only the matching slot", () => {
    const items = [
      makeItem({ fecha: "2026-07-06", tipoComida: "almuerzo", recetaId: 1 }),
      makeItem({ fecha: "2026-07-06", tipoComida: "cena", recetaId: 2 }),
      makeItem({ fecha: "2026-07-07", tipoComida: "almuerzo", recetaId: 3 }),
    ];
    const payload = removeDraftItem(items, "2026-07-06", "cena");
    expect(payload).toHaveLength(2);
    expect(payload.map((i) => i.recetaId)).toEqual([1, 3]);
  });

  it("returns the same items when nothing matches", () => {
    const payload = removeDraftItem([makeItem()], "2026-07-07", "cena");
    expect(payload).toHaveLength(1);
  });

  it("removes a paired item whole (main and side leave together)", () => {
    const payload = removeDraftItem(
      [
        makeItem({ acompanamientoId: 50 }),
        makeItem({ fecha: WEEK_START, tipoComida: "cena", recetaId: 2 }),
      ],
      WEEK_START,
      "almuerzo"
    );
    expect(payload).toEqual([{ fecha: WEEK_START, tipoComida: "cena", recetaId: 2, razon: "A los chicos les encanta" }]);
  });
});

// ─── groupRecipesByCategory ──────────────────────────────────────────────────

describe("groupRecipesByCategory", () => {
  it("groups by category and sorts categories and recipes alphabetically", () => {
    const groups = groupRecipesByCategory([
      { nombre: "Sopa de zapallo", categoria: "Sopa" },
      { nombre: "Milanesas", categoria: "Plato Principal" },
      { nombre: "Arroz con pollo", categoria: "Plato Principal" },
    ]);
    expect(groups.map((g) => g.categoria)).toEqual(["Plato Principal", "Sopa"]);
    expect(groups[0].recipes.map((r) => r.nombre)).toEqual(["Arroz con pollo", "Milanesas"]);
  });

  it("puts uncategorized recipes last under 'Sin categoría'", () => {
    const groups = groupRecipesByCategory([
      { nombre: "Misteriosa", categoria: null },
      { nombre: "Ensalada", categoria: "Ensalada" },
      { nombre: "Otra misteriosa", categoria: "" },
    ]);
    expect(groups.map((g) => g.categoria)).toEqual(["Ensalada", "Sin categoría"]);
    expect(groups[1].recipes.map((r) => r.nombre)).toEqual(["Misteriosa", "Otra misteriosa"]);
  });

  it("returns an empty list for an empty library", () => {
    expect(groupRecipesByCategory([])).toEqual([]);
  });
});
