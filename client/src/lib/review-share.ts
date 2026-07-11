// Helpers for sharing the weekly review over WhatsApp with a deep link, and
// for the login return-to plumbing that makes the deep link survive auth.
// Pure functions — unit tested in __tests__/review-share.test.ts.

const WEEK_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Extracts a valid ?week=YYYY-MM-DD value from a search string, or null. */
export function parseWeekParam(search: string): string | null {
  const value = new URLSearchParams(search).get("week");
  if (!value || !WEEK_PARAM_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  // Round-trip through Date to reject calendar overflow (e.g. 2026-02-30
  // passes a plain range check but would silently open the wrong week).
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
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
 *
 * Callers read the value with URLSearchParams.get, which already decodes it —
 * this function always receives a plain path, so no extra decoding here.
 */
export function sanitizeNextPath(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

/**
 * Login URL that preserves the intended destination in ?next=. The value is
 * encoded exactly once here; URLSearchParams.get decodes it on the way back
 * into sanitizeNextPath, closing the round-trip.
 */
export function buildLoginRedirect(intendedPath: string): string {
  return intendedPath && intendedPath !== "/app"
    ? `/login?next=${encodeURIComponent(intendedPath)}`
    : "/login";
}

/** The deep link a shared message points to: the week view, pre-navigated. */
export function buildWeekDeepLink(origin: string, weekStartDate: string): string {
  return `${origin}/app?week=${encodeURIComponent(weekStartDate)}`;
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

/** Browser share capabilities, injected so the flow is unit-testable. */
export interface SharePorts {
  /** navigator.share when available (bind it: unbound it throws). */
  nativeShare?: (data: { text: string }) => Promise<void>;
  /** window.open returning null when a popup blocker intervened. */
  openWindow: (url: string) => unknown;
}

/**
 * Opens the share UI for a message: native share sheet when available
 * (WhatsApp and friends live there on mobile), a wa.me tab otherwise.
 * Returns false when the browser blocked it — the tap's activation window
 * expired, or a popup blocker — so the caller can offer a fresh-tap fallback.
 * A user-dismissed share sheet (AbortError) counts as handled, not blocked.
 */
export async function openShareUi(message: string, ports: SharePorts): Promise<boolean> {
  if (ports.nativeShare) {
    try {
      await ports.nativeShare({ text: message });
      return true;
    } catch (error) {
      return (error as Error).name === "AbortError";
    }
  }
  return ports.openWindow(buildWhatsAppShareUrl(message)) != null;
}
