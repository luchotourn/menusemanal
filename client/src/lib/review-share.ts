// Helpers for sharing the weekly review over WhatsApp with a deep link, and
// for the login return-to plumbing that makes the deep link survive auth.
// Pure functions — unit tested in __tests__/review-share.test.ts.

const WEEK_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Extracts a valid ?week=YYYY-MM-DD value from a search string, or null. */
export function parseWeekParam(search: string): string | null {
  const value = new URLSearchParams(search).get("week");
  if (!value || !WEEK_PARAM_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return value;
}

/** Turns a validated YYYY-MM-DD into a local Date (never UTC-shifted). */
export function weekParamToDate(param: string): Date {
  const [year, month, day] = param.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Return-to path guard: only same-app relative paths survive the login
 * round-trip. Anything absolute ("//evil.com", "https://…") is rejected so the
 * ?next= param can never become an open redirect.
 */
export function sanitizeNextPath(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

/** The deep link a shared message points to: the week view, pre-navigated. */
export function buildWeekDeepLink(origin: string, weekStartDate: string): string {
  return `${origin}/app?week=${weekStartDate}`;
}

/** Share-ready message: warm, short, link last so previews pick it up. */
export function buildReviewShareMessage(
  origin: string,
  weekStartDate: string,
  weekLabel?: string,
): string {
  const week = weekLabel ? `la semana (${weekLabel})` : "la semana";
  return (
    `👨‍🍳 ¡El menú de ${week} está listo!\n` +
    "Entrá a mirarlo y decime qué te parece — podés aprobarlo o pedir cambios:\n" +
    buildWeekDeepLink(origin, weekStartDate)
  );
}

/** wa.me share URL (no phone: the sender picks the chat). */
export function buildWhatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
