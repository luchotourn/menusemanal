import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildInviteMessage,
  buildCompactInviteMessage,
  copyToClipboard,
  buildWhatsAppUrl,
} from '../share-utils';

describe('buildInviteMessage', () => {
  const baseOptions = {
    familyName: 'Los García',
    invitationCode: 'ABC-123',
    appUrl: 'https://menusemanal.app',
  };

  it('includes the family name', () => {
    const msg = buildInviteMessage(baseOptions);
    expect(msg).toContain('"Los García"');
  });

  it('includes the invitation code as a standalone block', () => {
    const msg = buildInviteMessage(baseOptions);
    expect(msg).toContain('ABC-123');
  });

  it('includes the register URL', () => {
    const msg = buildInviteMessage(baseOptions);
    expect(msg).toContain('https://menusemanal.app/register');
  });

  it('includes step-by-step instructions', () => {
    const msg = buildInviteMessage(baseOptions);
    expect(msg).toContain('1.');
    expect(msg).toContain('2.');
    expect(msg).toContain('3.');
  });

  it('handles special characters in family name', () => {
    const msg = buildInviteMessage({ ...baseOptions, familyName: 'Familia "O\'Brien"' });
    expect(msg).toContain('Familia "O\'Brien"');
  });
});

describe('buildCompactInviteMessage', () => {
  const baseOptions = {
    invitationCode: 'XYZ-789',
    appUrl: 'https://menusemanal.app',
  };

  it('includes the invitation code inline', () => {
    const msg = buildCompactInviteMessage(baseOptions);
    expect(msg).toContain('XYZ-789');
  });

  it('includes the register URL', () => {
    const msg = buildCompactInviteMessage(baseOptions);
    expect(msg).toContain('https://menusemanal.app/register');
  });

  it('is shorter than the full invite message', () => {
    const compact = buildCompactInviteMessage(baseOptions);
    const full = buildInviteMessage({ ...baseOptions, familyName: 'Test' });
    expect(compact.length).toBeLessThan(full.length);
  });
});

describe('copyToClipboard', () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    // Mock the clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it('returns true on successful copy', async () => {
    (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const result = await copyToClipboard('test text');
    expect(result).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test text');
  });

  it('returns false when clipboard API throws', async () => {
    (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValue(
      new DOMException('Document is not focused')
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await copyToClipboard('test text');
    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('returns false when clipboard API rejects with permission error', async () => {
    (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValue(
      new DOMException('Clipboard write was blocked due to lack of user activation')
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await copyToClipboard('test text');
    expect(result).toBe(false);
    consoleSpy.mockRestore();
  });
});

describe('buildWhatsAppUrl', () => {
  it('returns a valid wa.me URL', () => {
    const url = buildWhatsAppUrl('Hello world');
    expect(url).toBe('https://wa.me/?text=Hello%20world');
  });

  it('encodes special characters correctly', () => {
    const url = buildWhatsAppUrl('Hola! ¿Cómo estás?');
    expect(url).toContain('https://wa.me/?text=');
    // Verify it's properly encoded by decoding
    const textParam = url.replace('https://wa.me/?text=', '');
    expect(decodeURIComponent(textParam)).toBe('Hola! ¿Cómo estás?');
  });

  it('encodes newlines in messages', () => {
    const url = buildWhatsAppUrl('Line 1\nLine 2');
    expect(url).toContain('%0A');
  });

  it('works with a full invite message', () => {
    const message = buildInviteMessage({
      familyName: 'Test Family',
      invitationCode: 'ABC-123',
      appUrl: 'https://example.com',
    });
    const url = buildWhatsAppUrl(message);
    expect(url).toMatch(/^https:\/\/wa\.me\/\?text=.+/);
    // Verify round-trip encoding
    const textParam = url.replace('https://wa.me/?text=', '');
    expect(decodeURIComponent(textParam)).toBe(message);
  });
});
