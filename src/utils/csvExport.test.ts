import { describe, it, expect } from 'vitest';
import { generateCsv } from './csvExport';
import type { SenderGroup } from '../types';

function makeGroup(overrides: Partial<SenderGroup> = {}): SenderGroup {
  return {
    sender: { email: 'test@example.com', name: 'Test Sender', domain: 'example.com' },
    messageIds: ['1'],
    count: 10,
    firstDate: '2024-01-01T00:00:00Z',
    lastDate: '2024-06-01T00:00:00Z',
    unreadCount: 2,
    unsubscribeLink: 'https://example.com/unsub',
    isUnsubscribed: false,
    spamReasons: [],
    isSuspectedSpam: false,
    countByYear: { 2024: 10 },
    subjectClusters: [],
    ...overrides,
  };
}

describe('generateCsv', () => {
  it('starts with a UTF-8 BOM', () => {
    const csv = generateCsv([], 0);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('produces header-only output for empty groups array', () => {
    const csv = generateCsv([], 100);
    const lines = csv.slice(1).split('\r\n'); // strip BOM
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Email Address');
  });

  it('produces header + one data row per group', () => {
    const csv = generateCsv([makeGroup(), makeGroup()], 20);
    const lines = csv.slice(1).split('\r\n');
    expect(lines).toHaveLength(3); // header + 2 data rows
  });

  it('includes all 8 fields in the header row', () => {
    const csv = generateCsv([], 0);
    const header = csv.slice(1).split('\r\n')[0];
    const expectedFields = [
      'Email Address',
      'Sender Name',
      'Email Count',
      'Percentage of Total',
      'First Email Date',
      'Last Email Date',
      'Suspected Spam',
      'Has Unsubscribe Link',
    ];
    for (const field of expectedFields) {
      expect(header).toContain(field);
    }
  });

  it('includes all 8 fields in a data row', () => {
    const group = makeGroup({ count: 5, isSuspectedSpam: true, unsubscribeLink: 'https://x.com' });
    const csv = generateCsv([group], 100);
    const dataRow = csv.slice(1).split('\r\n')[1];
    expect(dataRow).toContain('test@example.com');
    expect(dataRow).toContain('Test Sender');
    expect(dataRow).toContain('5');
    expect(dataRow).toContain('5.00%');
    expect(dataRow).toContain('2024-01-01');
    expect(dataRow).toContain('2024-06-01');
    expect(dataRow).toContain('Yes'); // isSuspectedSpam
    expect(dataRow).toContain('Yes'); // has unsubscribe link
  });

  it('escapes double quotes inside field values', () => {
    const group = makeGroup({ sender: { email: 'a@b.com', name: 'He said "hello"', domain: 'b.com' } });
    const csv = generateCsv([group], 10);
    expect(csv).toContain('He said ""hello""');
  });

  it('escapes commas inside field values by wrapping in quotes', () => {
    const group = makeGroup({ sender: { email: 'a@b.com', name: 'Smith, John', domain: 'b.com' } });
    const csv = generateCsv([group], 10);
    expect(csv).toContain('"Smith, John"');
  });

  it('calculates percentage correctly', () => {
    const group = makeGroup({ count: 25 });
    const csv = generateCsv([group], 100);
    expect(csv).toContain('25.00%');
  });

  it('outputs 0.00% when totalCount is 0', () => {
    const group = makeGroup({ count: 5 });
    const csv = generateCsv([group], 0);
    expect(csv).toContain('0.00%');
  });

  it('outputs "No" for isSuspectedSpam when false', () => {
    const group = makeGroup({ isSuspectedSpam: false });
    const csv = generateCsv([group], 10);
    const dataRow = csv.slice(1).split('\r\n')[1];
    // Spam field is 7th (index 6), unsubscribe is 8th
    expect(dataRow).toContain('"No"');
  });

  it('outputs "No" for unsubscribeLink when null', () => {
    const group = makeGroup({ unsubscribeLink: null });
    const csv = generateCsv([group], 10);
    expect(csv).toContain('"No"');
  });

  it('uses CRLF line endings', () => {
    const csv = generateCsv([makeGroup()], 10);
    expect(csv).toContain('\r\n');
  });
});
