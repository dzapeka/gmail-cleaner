import { describe, it, expect } from 'vitest';
import { parseSenderEmail, parseSenderIdentity } from './parseSender';

describe('parseSenderEmail', () => {
  it('extracts email from quoted display name format', () => {
    expect(parseSenderEmail('"Alice Smith" <alice@example.com>')).toBe('alice@example.com');
  });

  it('extracts email from unquoted display name format', () => {
    expect(parseSenderEmail('Alice Smith <alice@example.com>')).toBe('alice@example.com');
  });

  it('extracts email from angle-bracket-only format', () => {
    expect(parseSenderEmail('<alice@example.com>')).toBe('alice@example.com');
  });

  it('handles bare email address', () => {
    expect(parseSenderEmail('alice@example.com')).toBe('alice@example.com');
  });

  it('normalizes email to lowercase', () => {
    expect(parseSenderEmail('Alice@EXAMPLE.COM')).toBe('alice@example.com');
    expect(parseSenderEmail('"Name" <Alice@EXAMPLE.COM>')).toBe('alice@example.com');
  });

  it('returns "unknown" for empty string', () => {
    expect(parseSenderEmail('')).toBe('unknown');
  });

  it('returns "unknown" for whitespace-only string', () => {
    expect(parseSenderEmail('   ')).toBe('unknown');
  });

  it('returns "unknown" for malformed input', () => {
    expect(parseSenderEmail('not-an-email')).toBe('unknown');
  });
});

describe('parseSenderIdentity', () => {
  it('parses quoted display name + angle bracket address', () => {
    const result = parseSenderIdentity('"Alice Smith" <alice@example.com>');
    expect(result.email).toBe('alice@example.com');
    expect(result.name).toBe('Alice Smith');
    expect(result.domain).toBe('example.com');
  });

  it('parses unquoted display name + angle bracket address', () => {
    const result = parseSenderIdentity('Alice Smith <alice@example.com>');
    expect(result.email).toBe('alice@example.com');
    expect(result.name).toBe('Alice Smith');
  });

  it('parses angle-bracket-only (no display name)', () => {
    const result = parseSenderIdentity('<alice@example.com>');
    expect(result.email).toBe('alice@example.com');
    expect(result.name).toBe('');
  });

  it('parses bare email address', () => {
    const result = parseSenderIdentity('alice@example.com');
    expect(result.email).toBe('alice@example.com');
    expect(result.name).toBe('');
    expect(result.domain).toBe('example.com');
  });

  it('returns unknown identity for empty input', () => {
    const result = parseSenderIdentity('');
    expect(result.email).toBe('unknown');
    expect(result.name).toBe('');
    expect(result.domain).toBe('');
  });

  it('extracts domain correctly', () => {
    const result = parseSenderIdentity('user@sub.domain.co.uk');
    expect(result.domain).toBe('sub.domain.co.uk');
  });
});
