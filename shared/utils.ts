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