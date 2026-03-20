import { describe, it, expect } from 'vitest';
import {
  generateInvitationCode,
  normalizeInvitationCode,
  isValidInvitationCodeFormat,
} from '../utils';

const XXX_XXX_PATTERN = /^[A-Z0-9]{3}-[A-Z0-9]{3}$/;

describe('generateInvitationCode', () => {
  it('returns a code in XXX-XXX format', () => {
    const code = generateInvitationCode();
    expect(code).toMatch(XXX_XXX_PATTERN);
  });

  it('always produces valid codes (100 iterations)', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateInvitationCode();
      expect(code).toMatch(XXX_XXX_PATTERN);
    }
  });

  it('never contains underscores (regression: nanoid default alphabet)', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateInvitationCode();
      expect(code).not.toContain('_');
    }
  });

  it('never contains lowercase letters', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateInvitationCode();
      expect(code).toEqual(code.toUpperCase());
    }
  });

  it('is exactly 7 characters long (3 + dash + 3)', () => {
    const code = generateInvitationCode();
    expect(code.length).toBe(7);
  });

  it('has a dash at position 3', () => {
    const code = generateInvitationCode();
    expect(code[3]).toBe('-');
  });

  it('generates unique codes', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      codes.add(generateInvitationCode());
    }
    expect(codes.size).toBe(50);
  });

  it('generated codes always pass validation', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateInvitationCode();
      expect(isValidInvitationCodeFormat(code)).toBe(true);
    }
  });
});

describe('normalizeInvitationCode', () => {
  it('uppercases lowercase input', () => {
    expect(normalizeInvitationCode('abc-def')).toBe('ABC-DEF');
  });

  it('removes spaces', () => {
    expect(normalizeInvitationCode(' ABC - DEF ')).toBe('ABC-DEF');
  });

  it('adds dash to bare 6-char alphanumeric input', () => {
    expect(normalizeInvitationCode('ABC123')).toBe('ABC-123');
  });

  it('adds dash to lowercase bare 6-char input', () => {
    expect(normalizeInvitationCode('abc123')).toBe('ABC-123');
  });

  it('preserves existing dash in valid code', () => {
    expect(normalizeInvitationCode('ABC-123')).toBe('ABC-123');
  });

  it('returns original if input is too short', () => {
    expect(normalizeInvitationCode('ABC')).toBe('ABC');
  });

  it('returns original if input is too long', () => {
    expect(normalizeInvitationCode('ABCDEFGH')).toBe('ABCDEFGH');
  });

  it('returns cleaned input if it contains non-alphanumeric chars (no dash)', () => {
    expect(normalizeInvitationCode('ABC_DE')).toBe('ABC_DE');
  });

  it('returns as-is if already has dash even with bad characters', () => {
    expect(normalizeInvitationCode('AB_-DEF')).toBe('AB_-DEF');
  });
});

describe('isValidInvitationCodeFormat', () => {
  it('accepts valid XXX-XXX format', () => {
    expect(isValidInvitationCodeFormat('ABC-123')).toBe(true);
  });

  it('accepts all-letter codes', () => {
    expect(isValidInvitationCodeFormat('ABC-DEF')).toBe(true);
  });

  it('accepts all-digit codes', () => {
    expect(isValidInvitationCodeFormat('123-456')).toBe(true);
  });

  it('accepts lowercase input (normalized to uppercase)', () => {
    expect(isValidInvitationCodeFormat('abc-def')).toBe(true);
  });

  it('accepts bare 6-char input (dash auto-added)', () => {
    expect(isValidInvitationCodeFormat('ABC123')).toBe(true);
  });

  it('accepts input with spaces (stripped during normalization)', () => {
    expect(isValidInvitationCodeFormat(' ABC - 123 ')).toBe(true);
  });

  it('rejects codes with underscores', () => {
    expect(isValidInvitationCodeFormat('AB_-123')).toBe(false);
  });

  it('rejects codes that are too short', () => {
    expect(isValidInvitationCodeFormat('AB-12')).toBe(false);
  });

  it('rejects codes that are too long', () => {
    expect(isValidInvitationCodeFormat('ABCD-1234')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidInvitationCodeFormat('')).toBe(false);
  });

  it('rejects codes with special characters', () => {
    expect(isValidInvitationCodeFormat('AB!-1@3')).toBe(false);
  });

  it('rejects codes with multiple dashes', () => {
    expect(isValidInvitationCodeFormat('A-B-C-D')).toBe(false);
  });
});
