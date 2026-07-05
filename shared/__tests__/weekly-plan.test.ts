import { describe, it, expect } from "vitest";
import {
  isMonday,
  addDaysToDateString,
  getWeekDateStrings,
  allWeekSlots,
  computeEmptySlots,
  slotKey,
  type WeekSlot,
} from "../weekly-plan";

// ─────────────────────────────────────────────────────────────────────────────
// isMonday
// ─────────────────────────────────────────────────────────────────────────────

describe("isMonday", () => {
  it("returns true for known Mondays", () => {
    expect(isMonday("2026-07-06")).toBe(true);
    expect(isMonday("2026-06-29")).toBe(true);
    expect(isMonday("2024-01-01")).toBe(true);
  });

  it("returns false for a Sunday (the classic off-by-one)", () => {
    expect(isMonday("2026-07-05")).toBe(false);
  });

  it("returns false for every non-Monday day of a full week", () => {
    const week = getWeekDateStrings("2026-07-06");
    const verdicts = week.map((dateStr) => isMonday(dateStr));
    expect(verdicts).toEqual([true, false, false, false, false, false, false]);
  });

  it("handles month-boundary Mondays", () => {
    expect(isMonday("2026-08-31")).toBe(true);
    expect(isMonday("2026-09-01")).toBe(false);
  });

  it("handles year-boundary Mondays", () => {
    expect(isMonday("2024-12-30")).toBe(true);
    expect(isMonday("2029-01-01")).toBe(true);
    expect(isMonday("2025-01-01")).toBe(false); // Wednesday
  });

  it("handles leap-year February correctly", () => {
    expect(isMonday("2024-02-26")).toBe(true);
    expect(isMonday("2024-02-29")).toBe(false); // Thursday, but a valid leap day
  });

  it("returns false for impossible calendar dates instead of rolling over", () => {
    expect(isMonday("2026-02-30")).toBe(false);
    expect(isMonday("2023-02-29")).toBe(false); // not a leap year
    expect(isMonday("2026-13-01")).toBe(false);
  });

  it("returns false for malformed strings", () => {
    expect(isMonday("")).toBe(false);
    expect(isMonday("no-es-fecha")).toBe(false);
    expect(isMonday("2026-7-6")).toBe(false);
    expect(isMonday("06-07-2026")).toBe(false);
    expect(isMonday("2026-07-06T00:00:00Z")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// addDaysToDateString
// ─────────────────────────────────────────────────────────────────────────────

describe("addDaysToDateString", () => {
  it("adds days within a month", () => {
    expect(addDaysToDateString("2026-07-06", 1)).toBe("2026-07-07");
    expect(addDaysToDateString("2026-07-06", 6)).toBe("2026-07-12");
  });

  it("returns the same date for 0 days", () => {
    expect(addDaysToDateString("2026-07-06", 0)).toBe("2026-07-06");
  });

  it("crosses month boundaries", () => {
    expect(addDaysToDateString("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDaysToDateString("2026-07-01", -1)).toBe("2026-06-30");
  });

  it("crosses year boundaries", () => {
    expect(addDaysToDateString("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateString("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("handles leap-year February", () => {
    expect(addDaysToDateString("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDaysToDateString("2024-02-29", 1)).toBe("2024-03-01");
    expect(addDaysToDateString("2023-02-28", 1)).toBe("2023-03-01"); // non-leap
    expect(addDaysToDateString("2024-02-26", 7)).toBe("2024-03-04");
  });

  it("handles large offsets spanning a leap year", () => {
    expect(addDaysToDateString("2024-01-01", 366)).toBe("2025-01-01");
    expect(addDaysToDateString("2025-01-01", 365)).toBe("2026-01-01");
  });

  it("is immune to DST transitions (pure UTC math)", () => {
    // US DST starts 2026-03-08; local-time math can produce 23-hour days here.
    expect(addDaysToDateString("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDaysToDateString("2026-03-08", 1)).toBe("2026-03-09");
    // US DST ends 2026-11-01 (25-hour local day).
    expect(addDaysToDateString("2026-10-31", 2)).toBe("2026-11-02");
  });

  it("throws on malformed or impossible dates", () => {
    expect(() => addDaysToDateString("no-es-fecha", 1)).toThrow("Fecha inválida");
    expect(() => addDaysToDateString("2026-02-30", 1)).toThrow("Fecha inválida");
    expect(() => addDaysToDateString("2026-7-6", 1)).toThrow("Fecha inválida");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getWeekDateStrings
// ─────────────────────────────────────────────────────────────────────────────

describe("getWeekDateStrings", () => {
  it("returns the 7 dates Monday through Sunday", () => {
    expect(getWeekDateStrings("2026-07-06")).toEqual([
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
    ]);
  });

  it("spans month boundaries", () => {
    expect(getWeekDateStrings("2026-06-29")).toEqual([
      "2026-06-29",
      "2026-06-30",
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
      "2026-07-05",
    ]);
  });

  it("spans year boundaries", () => {
    expect(getWeekDateStrings("2024-12-30")).toEqual([
      "2024-12-30",
      "2024-12-31",
      "2025-01-01",
      "2025-01-02",
      "2025-01-03",
      "2025-01-04",
      "2025-01-05",
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// allWeekSlots
// ─────────────────────────────────────────────────────────────────────────────

describe("allWeekSlots", () => {
  it("returns exactly 14 slots", () => {
    expect(allWeekSlots("2026-07-06")).toHaveLength(14);
  });

  it("orders Monday to Sunday with almuerzo before cena within each day", () => {
    const slots = allWeekSlots("2026-07-06");
    expect(slots[0]).toEqual({ fecha: "2026-07-06", tipoComida: "almuerzo" });
    expect(slots[1]).toEqual({ fecha: "2026-07-06", tipoComida: "cena" });
    expect(slots[2]).toEqual({ fecha: "2026-07-07", tipoComida: "almuerzo" });
    expect(slots[12]).toEqual({ fecha: "2026-07-12", tipoComida: "almuerzo" });
    expect(slots[13]).toEqual({ fecha: "2026-07-12", tipoComida: "cena" });
  });

  it("alternates almuerzo/cena and never decreases the date", () => {
    const slots = allWeekSlots("2026-06-29");
    slots.forEach((slot, index) => {
      expect(slot.tipoComida).toBe(index % 2 === 0 ? "almuerzo" : "cena");
      if (index > 0) {
        expect(slot.fecha >= slots[index - 1].fecha).toBe(true);
      }
    });
  });

  it("produces 14 unique slot keys", () => {
    const keys = allWeekSlots("2026-07-06").map((slot) =>
      slotKey(slot.fecha, slot.tipoComida)
    );
    expect(new Set(keys).size).toBe(14);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// slotKey
// ─────────────────────────────────────────────────────────────────────────────

describe("slotKey", () => {
  it("is stable for the same slot", () => {
    expect(slotKey("2026-07-06", "almuerzo")).toBe(slotKey("2026-07-06", "almuerzo"));
  });

  it("distinguishes tipoComida on the same date", () => {
    expect(slotKey("2026-07-06", "almuerzo")).not.toBe(slotKey("2026-07-06", "cena"));
  });

  it("distinguishes dates for the same tipoComida", () => {
    expect(slotKey("2026-07-06", "cena")).not.toBe(slotKey("2026-07-07", "cena"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeEmptySlots
// ─────────────────────────────────────────────────────────────────────────────

describe("computeEmptySlots", () => {
  const monday = "2026-07-06";

  it("returns all 14 slots for an empty week", () => {
    expect(computeEmptySlots(monday, [])).toEqual(allWeekSlots(monday));
  });

  it("returns an empty array when the week is fully occupied", () => {
    expect(computeEmptySlots(monday, allWeekSlots(monday))).toEqual([]);
  });

  it("removes exactly the occupied slots", () => {
    const occupied = [
      { fecha: "2026-07-06", tipoComida: "almuerzo" },
      { fecha: "2026-07-09", tipoComida: "cena" },
    ];
    const empty = computeEmptySlots(monday, occupied);
    expect(empty).toHaveLength(12);
    const emptyKeys = empty.map((slot) => slotKey(slot.fecha, slot.tipoComida));
    expect(emptyKeys).not.toContain(slotKey("2026-07-06", "almuerzo"));
    expect(emptyKeys).not.toContain(slotKey("2026-07-09", "cena"));
    expect(emptyKeys).toContain(slotKey("2026-07-06", "cena"));
  });

  it("counts duplicate occupied entries once (meal_plans allows dupes per slot)", () => {
    const occupied = [
      { fecha: "2026-07-06", tipoComida: "almuerzo" },
      { fecha: "2026-07-06", tipoComida: "almuerzo" },
      { fecha: "2026-07-06", tipoComida: "almuerzo" },
    ];
    expect(computeEmptySlots(monday, occupied)).toHaveLength(13);
  });

  it("ignores occupied entries outside the week", () => {
    const occupied = [
      { fecha: "2026-06-28", tipoComida: "almuerzo" }, // previous Sunday
      { fecha: "2026-07-13", tipoComida: "cena" }, // next Monday
    ];
    expect(computeEmptySlots(monday, occupied)).toHaveLength(14);
  });

  it("ignores occupied entries with unknown tipoComida values", () => {
    const occupied = [{ fecha: "2026-07-06", tipoComida: "desayuno" }];
    expect(computeEmptySlots(monday, occupied)).toHaveLength(14);
  });

  it("preserves Monday-to-Sunday / almuerzo-before-cena ordering", () => {
    const occupied = [{ fecha: "2026-07-06", tipoComida: "almuerzo" }];
    const empty = computeEmptySlots(monday, occupied);
    const expected: WeekSlot[] = allWeekSlots(monday).slice(1);
    expect(empty).toEqual(expected);
  });

  it("works across month boundaries", () => {
    const occupied = [{ fecha: "2026-07-01", tipoComida: "cena" }];
    const empty = computeEmptySlots("2026-06-29", occupied);
    expect(empty).toHaveLength(13);
    const emptyKeys = empty.map((slot) => slotKey(slot.fecha, slot.tipoComida));
    expect(emptyKeys).not.toContain(slotKey("2026-07-01", "cena"));
  });
});
