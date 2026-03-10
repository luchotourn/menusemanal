/**
 * Shared utilities for family invitation sharing functionality.
 * Centralizes message templates and clipboard operations used across
 * InviteMemberModal and InvitationCodeDisplay components.
 */

interface InviteMessageOptions {
  familyName: string;
  invitationCode: string;
  appUrl: string;
}

/**
 * Builds the full invitation message with step-by-step instructions.
 * Used in the InviteMemberModal when sharing via WhatsApp, native share, or clipboard.
 */
export function buildInviteMessage({ familyName, invitationCode, appUrl }: InviteMessageOptions): string {
  return `¡Hola! Te invito a unirte a nuestra familia "${familyName}" en Menu Semanal para planificar comidas juntos.

Seguí estos pasos:
1. Creá tu cuenta en: ${appUrl}/register
2. Una vez registrado, andá a Configuración Familiar
3. Tocá "Unirse a una Familia" e ingresá este código:

${invitationCode}

¡Te esperamos!`;
}

/**
 * Builds a compact invitation message.
 * Used in InvitationCodeDisplay for quick sharing of just the code with brief instructions.
 */
export function buildCompactInviteMessage({ invitationCode, appUrl }: Pick<InviteMessageOptions, 'invitationCode' | 'appUrl'>): string {
  return `¡Unite a nuestra familia en Menu Semanal!\n\n1. Registrate en: ${appUrl}/register\n2. Andá a Configuración Familiar\n3. Tocá "Unirse a una Familia" e ingresá el código: ${invitationCode}`;
}

/**
 * Copies text to clipboard with error handling.
 * Returns true on success, false on failure.
 *
 * The Clipboard API can fail when:
 * - The page is not served over HTTPS (except localhost)
 * - The document is not focused
 * - The browser doesn't support the Clipboard API
 * - The user denies clipboard permission
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Builds a WhatsApp share URL for the given message text.
 */
export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
