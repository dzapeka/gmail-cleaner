import type { SenderIdentity } from '../types';

/**
 * Extract the email address from an RFC 5322 "From" header value.
 * Always returns lowercase. Returns "unknown" for malformed/empty input.
 */
export function parseSenderEmail(from: string): string {
  if (!from || !from.trim()) return 'unknown';

  // Match angle-bracket address: "Display Name" <email> or <email>
  const angleMatch = from.match(/<([^>]+)>/);
  if (angleMatch) {
    return angleMatch[1].trim().toLowerCase() || 'unknown';
  }

  // Bare email address (no angle brackets)
  const trimmed = from.trim();
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }

  return 'unknown';
}

/**
 * Parse an RFC 5322 "From" header value into a SenderIdentity.
 * Handles:
 *   "Alice Smith" <alice@example.com>
 *   Alice Smith <alice@example.com>
 *   <alice@example.com>
 *   alice@example.com
 */
export function parseSenderIdentity(from: string): SenderIdentity {
  const email = parseSenderEmail(from);
  const domain = email !== 'unknown' && email.includes('@')
    ? email.split('@')[1]
    : '';

  if (!from || !from.trim()) {
    return { email: 'unknown', name: '', domain: '' };
  }

  const angleMatch = from.match(/<([^>]+)>/);
  if (angleMatch) {
    // Everything before the angle bracket is the display name
    const namePart = from.slice(0, from.indexOf('<')).trim();
    // Strip surrounding quotes if present
    const name = namePart.replace(/^["']|["']$/g, '').trim();
    return { email, name, domain };
  }

  // Bare email — no display name
  return { email, name: '', domain };
}
