// Pure date/slot helpers for the intelligent weekly plan generator.
//
// All date math here is UTC-only over YYYY-MM-DD strings: parse with an
// explicit "T00:00:00Z" suffix and read/write exclusively via getUTC*/setUTC*.
// Never mix new Date("YYYY-MM-DD") (parsed as UTC midnight) with local-time
// getters — that combination shifts dates for users west of UTC.
//
// This module must stay dependency-free (no imports from schema.ts or npm)
// so it can be shared by client, server, and zod refinements alike.

export type WeekSlot = { fecha: string; tipoComida: "almuerzo" | "cena" };

const DATE_STRING_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a YYYY-MM-DD string as UTC midnight. Returns null when the string
 * is malformed or names an impossible calendar date (e.g. 2026-02-30).
 */
function parseUtcDate(dateStr: string): Date | null {
  if (typeof dateStr !== "string" || !DATE_STRING_REGEX.test(dateStr)) {
    return null;
  }
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  // Guard against engine-specific rollover (e.g. 2026-02-30 -> 2026-03-02).
  if (date.toISOString().slice(0, 10) !== dateStr) {
    return null;
  }
  return date;
}

/** Returns true when the string is a well-formed, real calendar YYYY-MM-DD date. */
export function isValidDateString(dateStr: string): boolean {
  return parseUtcDate(dateStr) !== null;
}

/** Returns true when the YYYY-MM-DD string is a valid date that falls on a Monday. */
export function isMonday(dateStr: string): boolean {
  const date = parseUtcDate(dateStr);
  return date !== null && date.getUTCDay() === 1;
}

/** Adds (or subtracts, with negative days) whole days to a YYYY-MM-DD string. */
export function addDaysToDateString(dateStr: string, days: number): string {
  const date = parseUtcDate(dateStr);
  if (date === null) {
    throw new Error(`Fecha inválida: ${dateStr}`);
  }
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Returns the 7 YYYY-MM-DD strings of the week, Monday through Sunday. */
export function getWeekDateStrings(weekStartDate: string): string[] {
  return Array.from({ length: 7 }, (_, dayOffset) =>
    addDaysToDateString(weekStartDate, dayOffset)
  );
}

/**
 * Returns the 14 meal slots of the week, ordered Monday through Sunday with
 * almuerzo before cena within each day.
 */
export function allWeekSlots(weekStartDate: string): WeekSlot[] {
  return getWeekDateStrings(weekStartDate).flatMap((fecha): WeekSlot[] => [
    { fecha, tipoComida: "almuerzo" },
    { fecha, tipoComida: "cena" },
  ]);
}

/** Stable key identifying a (fecha, tipoComida) slot. */
export function slotKey(fecha: string, tipoComida: string): string {
  return `${fecha}|${tipoComida}`;
}

/**
 * Validates draft items against their draft's week: every fecha must fall
 * within the Monday-Sunday week and no (fecha, tipoComida) slot may repeat.
 * Returns a Spanish error message, or null when the items are valid.
 */
export function validateDraftItemsForWeek(
  weekStartDate: string,
  items: { fecha: string; tipoComida: string }[]
): string | null {
  const weekDates = new Set(getWeekDateStrings(weekStartDate));
  const seenSlots = new Set<string>();
  for (const item of items) {
    if (!weekDates.has(item.fecha)) {
      return "Alguna comida cae fuera de la semana del borrador";
    }
    const key = slotKey(item.fecha, item.tipoComida);
    if (seenSlots.has(key)) {
      return "Hay más de una comida para el mismo casillero";
    }
    seenSlots.add(key);
  }
  return null;
}

/**
 * Keeps only the items that fall inside the week, one per (fecha, tipoComida)
 * slot (first wins) — exactly what the review UI renders, so applying a draft
 * never writes rows the review never showed.
 */
export function sanitizeDraftItemsForWeek<T extends { fecha: string; tipoComida: string }>(
  weekStartDate: string,
  items: T[]
): T[] {
  const weekDates = new Set(getWeekDateStrings(weekStartDate));
  const seenSlots = new Set<string>();
  return items.filter((item) => {
    const key = slotKey(item.fecha, item.tipoComida);
    if (!weekDates.has(item.fecha) || seenSlots.has(key)) return false;
    seenSlots.add(key);
    return true;
  });
}

/**
 * Returns the week's slots that are NOT present in `occupied`, preserving
 * the Monday-to-Sunday / almuerzo-before-cena order. Duplicate occupied
 * entries and entries outside the week are ignored.
 */
export function computeEmptySlots(
  weekStartDate: string,
  occupied: { fecha: string; tipoComida: string }[]
): WeekSlot[] {
  const occupiedKeys = new Set(
    occupied.map((slot) => slotKey(slot.fecha, slot.tipoComida))
  );
  return allWeekSlots(weekStartDate).filter(
    (slot) => !occupiedKeys.has(slotKey(slot.fecha, slot.tipoComida))
  );
}
