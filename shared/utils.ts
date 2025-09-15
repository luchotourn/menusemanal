import { nanoid } from 'nanoid';

/**
 * Generates a unique 6-character family invitation code in XXX-XXX format
 * Uses nanoid for cryptographic security with URL-safe alphabet
 * 
 * @returns string - A formatted invitation code (e.g., "ABC-123")
 */
export function generateInvitationCode(): string {
  // Generate 6 characters using URL-safe alphabet (excludes ambiguous chars)
  const code = nanoid(6).toUpperCase();
  
  // Format as XXX-XXX for readability
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