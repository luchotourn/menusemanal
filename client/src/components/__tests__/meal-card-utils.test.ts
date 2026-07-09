import { describe, it, expect } from "vitest";
import { getDishEmoji, mealProposalChipLabel } from "../meal-card-utils";

describe("getDishEmoji", () => {
  it("matches dishes by keyword in the name", () => {
    expect(getDishEmoji("Milanesa napolitana con puré")).toBe("🥩");
    expect(getDishEmoji("Pizza casera")).toBe("🍕");
    expect(getDishEmoji("Tallarines con tuco")).toBe("🍝");
    expect(getDishEmoji("Pollo al horno con papas")).toBe("🍗");
    expect(getDishEmoji("Tarta de zapallitos")).toBe("🥧");
    expect(getDishEmoji("Sopa de calabaza")).toBe("🍲");
    expect(getDishEmoji("Empanadas de carne")).toBe("🥟");
  });

  it("is case- and accent-insensitive", () => {
    expect(getDishEmoji("MILANESA")).toBe("🥩");
    expect(getDishEmoji("Ñoquis de papa")).toBe("🍝");
    expect(getDishEmoji("Puré de papas")).toBe("🥔");
    expect(getDishEmoji("Salmón grillado")).toBe("🐟");
  });

  it("prefers the main dish over a side mentioned later in the name", () => {
    // "puré"/"papas" must not shadow the main
    expect(getDishEmoji("Milanesa con puré")).toBe("🥩");
    expect(getDishEmoji("Ensalada césar con pollo")).toBe("🥗");
    expect(getDishEmoji("Pollo con papas")).toBe("🍗");
  });

  it("falls back to the category when no keyword matches", () => {
    expect(getDishEmoji("Sorpresa de la abuela", "Ensalada")).toBe("🥗");
    expect(getDishEmoji("Sorpresa de la abuela", "Sopa")).toBe("🍲");
    expect(getDishEmoji("Sorpresa de la abuela", "Acompañamiento")).toBe("🥔");
  });

  it("falls back to the generic plate for unknown dishes and categories", () => {
    expect(getDishEmoji("Sorpresa de la abuela")).toBe("🍽️");
    expect(getDishEmoji("Sorpresa de la abuela", "Categoría inventada")).toBe("🍽️");
    expect(getDishEmoji("", null)).toBe("🍽️");
  });
});

describe("mealProposalChipLabel", () => {
  const proposal = {
    proposedRecipeName: "Tarta de zapallitos",
    proposerName: "Sofi",
    createdAt: "2026-07-08T12:00:00Z",
  };

  it("names the proposed dish when there is exactly one pending proposal", () => {
    expect(mealProposalChipLabel(1, proposal)).toBe("Cambio: Tarta de zapallitos");
  });

  it("uses the generic label for multiple proposals", () => {
    expect(mealProposalChipLabel(2, proposal)).toBe("Cambio propuesto");
  });

  it("uses the generic label when the proposal summary is missing", () => {
    expect(mealProposalChipLabel(1, null)).toBe("Cambio propuesto");
  });
});
