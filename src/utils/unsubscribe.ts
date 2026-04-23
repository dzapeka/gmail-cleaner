import type { MessageMetadata } from '../types';

/**
 * Parse a `List-Unsubscribe` header value and return the best URL.
 * Preference order: https:// > http:// > mailto:
 * Returns null if no URLs are found or input is empty/null.
 */
export function parseUnsubscribeLink(headerValue: string | null | undefined): string | null {
  try {
    if (!headerValue || !headerValue.trim()) return null;

    const matches = [...headerValue.matchAll(/<([^>]+)>/g)].map((m) => m[1]);

    if (matches.length === 0) return null;

    return (
      matches.find((u) => u.startsWith('https://')) ??
      matches.find((u) => u.startsWith('http://')) ??
      matches.find((u) => u.startsWith('mailto:')) ??
      null
    );
  } catch {
    return null;
  }
}

/**
 * Scan an array of messages and return the first non-null unsubscribe link
 * found in their `listUnsubscribe` field.
 */
export function extractUnsubscribeLink(messages: MessageMetadata[]): string | null {
  for (const msg of messages) {
    const link = parseUnsubscribeLink(msg.listUnsubscribe);
    if (link !== null) return link;
  }
  return null;
}
