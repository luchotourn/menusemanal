import { customAlphabet } from 'nanoid';

const generateCode = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);

/**
 * Generates a unique 6-character family invitation code in XXX-XXX format
 * Uses nanoid with alphanumeric-only alphabet to guarantee valid codes
 *
 * @returns string - A formatted invitation code (e.g., "ABC-123")
 */
export function generateInvitationCode(): string {
  const code = generateCode();
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/**
 * Normalizes invitation code input for validation
 * Removes spaces, converts to uppercase, and ensures XXX-XXX format
 * 
 * @param code - User input code
 * @returns string - Normalized code or original if invalid format
 */
export function normalizeInvitationCode(code: string): string {
  // Remove spaces and convert to uppercase
  const cleaned = code.replace(/\s/g, '').toUpperCase();
  
  // If already has dash, return as-is
  if (cleaned.includes('-')) {
    return cleaned;
  }
  
  // If 6 characters without dash, add dash in middle
  if (cleaned.length === 6 && /^[A-Z0-9]+$/.test(cleaned)) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  }
  
  // Return original if doesn't match expected pattern
  return cleaned;
}

/**
 * Validates invitation code format
 * Checks if code matches XXX-XXX pattern with valid characters
 * 
 * @param code - Code to validate
 * @returns boolean - True if valid format
 */
export function isValidInvitationCodeFormat(code: string): boolean {
  const normalized = normalizeInvitationCode(code);

  // Check XXX-XXX pattern with alphanumeric characters
  return /^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(normalized);
}

/** Returns today's date in local timezone as YYYY-MM-DD (matches meal_plans.fecha format). */
export function todayLocalDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * True when the YYYY-MM-DD string refers to a date strictly before today (local).
 * Today is NOT considered past — admins/commentators can still propose changes for the current day.
 */
export function isPastMealDate(fecha: string, now: Date = new Date()): boolean {
  return fecha < todayLocalDate(now);
}

export type ReviewNoteSource = {
  userName: string;
  verdict: "approved" | "changes_requested";
  note: string | null;
};

/**
 * Selects the sign-off notes worth surfacing to the meal-plan creator.
 * Keeps only sign-offs that carry a non-empty note, trims surrounding
 * whitespace, and orders "changes requested" notes first so the creator
 * reads actionable feedback before approvals.
 *
 * @param signoffs - The review's sign-offs (each may or may not have a note)
 * @returns The notable sign-offs with a guaranteed non-empty, trimmed note
 */
export function selectReviewNotes<T extends ReviewNoteSource>(
  signoffs: T[],
): (T & { note: string })[] {
  const withNotes = signoffs
    .filter((s): s is T & { note: string } => typeof s.note === "string" && s.note.trim().length > 0)
    .map((s) => ({ ...s, note: s.note.trim() }));

  return withNotes.sort((a, b) => {
    if (a.verdict === b.verdict) return 0;
    return a.verdict === "changes_requested" ? -1 : 1;
  });
}