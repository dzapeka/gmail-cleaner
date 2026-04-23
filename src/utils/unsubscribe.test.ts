import { describe, it, expect } from 'vitest';
import { parseUnsubscribeLink, extractUnsubscribeLink } from './unsubscribe';
import type { MessageMetadata } from '../types';

// ---------------------------------------------------------------------------
// parseUnsubscribeLink
// ---------------------------------------------------------------------------

describe('parseUnsubscribeLink', () => {
  it('prefers https over mailto', () => {
    const header = '<https://example.com/unsub?id=123>, <mailto:unsub@example.com>';
    expect(parseUnsubscribeLink(header)).toBe('https://example.com/unsub?id=123');
  });

  it('prefers http over mailto when no https present', () => {
    const header = '<mailto:unsub@example.com>, <http://example.com/unsub>';
    expect(parseUnsubscribeLink(header)).toBe('http://example.com/unsub');
  });

  it('returns mailto when it is the only option', () => {
    const header = '<mailto:unsub@example.com>';
    expect(parseUnsubscribeLink(header)).toBe('mailto:unsub@example.com');
  });

  it('handles multiple URLs in one header and picks https', () => {
    const header = '<mailto:a@b.com>, <http://b.com/unsub>, <https://c.com/unsub>';
    expect(parseUnsubscribeLink(header)).toBe('https://c.com/unsub');
  });

  it('returns null for empty string', () => {
    expect(parseUnsubscribeLink('')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(parseUnsubscribeLink(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parseUnsubscribeLink(undefined)).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseUnsubscribeLink('   ')).toBeNull();
  });

  it('returns null when there are no angle brackets', () => {
    expect(parseUnsubscribeLink('https://example.com/unsub')).toBeNull();
  });

  it('returns null for malformed input with no valid URLs in brackets', () => {
    expect(parseUnsubscribeLink('<not-a-url>')).toBeNull();
  });

  it('does not throw on malformed input', () => {
    expect(() => parseUnsubscribeLink('<<<<>>>>')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// extractUnsubscribeLink
// ---------------------------------------------------------------------------

function makeMsg(id: string, listUnsubscribe: string | null): MessageMetadata {
  return {
    id,
    threadId: 't' + id,
    from: 'sender@example.com',
    subject: 'Test',
    date: '2024-01-01T00:00:00Z',
    isUnread: false,
    listUnsubscribe,
  };
}

describe('extractUnsubscribeLink', () => {
  it('returns the first non-null link from messages', () => {
    const messages = [
      makeMsg('1', null),
      makeMsg('2', '<https://example.com/unsub>'),
      makeMsg('3', '<https://other.com/unsub>'),
    ];
    expect(extractUnsubscribeLink(messages)).toBe('https://example.com/unsub');
  });

  it('returns null when all messages have null listUnsubscribe', () => {
    const messages = [makeMsg('1', null), makeMsg('2', null)];
    expect(extractUnsubscribeLink(messages)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(extractUnsubscribeLink([])).toBeNull();
  });

  it('skips messages with no angle brackets and finds the next valid one', () => {
    const messages = [
      makeMsg('1', 'https://no-brackets.com'),
      makeMsg('2', '<mailto:unsub@example.com>'),
    ];
    expect(extractUnsubscribeLink(messages)).toBe('mailto:unsub@example.com');
  });
});
