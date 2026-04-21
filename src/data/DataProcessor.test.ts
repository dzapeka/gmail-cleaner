import { describe, it, expect } from 'vitest';
import {
  groupBySender,
  groupByDomain,
  applyTimeFilter,
  applySearchFilter,
  detectSpam,
  normalizeSubject,
  clusterSubjects,
} from './DataProcessor';
import type { MessageMetadata, SenderGroup } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMsg(
  overrides: Partial<MessageMetadata> & { id: string; from: string },
): MessageMetadata {
  return {
    threadId: overrides.id,
    subject: 'Hello',
    date: '2024-01-15T10:00:00.000Z',
    isUnread: false,
    listUnsubscribe: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseSender (via groupBySender)
// ---------------------------------------------------------------------------

describe('groupBySender', () => {
  it('groups messages by normalized email', () => {
    const messages: MessageMetadata[] = [
      makeMsg({ id: '1', from: '"Alice" <alice@example.com>' }),
      makeMsg({ id: '2', from: 'alice@example.com' }),
      makeMsg({ id: '3', from: '"Bob" <bob@example.com>' }),
    ];
    const groups = groupBySender(messages);
    expect(groups).toHaveLength(2);
    const alice = groups.find((g) => g.sender.email === 'alice@example.com');
    expect(alice?.count).toBe(2);
  });

  it('sorts by count descending', () => {
    const messages: MessageMetadata[] = [
      makeMsg({ id: '1', from: 'bob@example.com' }),
      makeMsg({ id: '2', from: 'alice@example.com' }),
      makeMsg({ id: '3', from: 'alice@example.com' }),
    ];
    const groups = groupBySender(messages);
    expect(groups[0].sender.email).toBe('alice@example.com');
  });

  it('computes unreadCount correctly', () => {
    const messages: MessageMetadata[] = [
      makeMsg({ id: '1', from: 'alice@example.com', isUnread: true }),
      makeMsg({ id: '2', from: 'alice@example.com', isUnread: false }),
    ];
    const [group] = groupBySender(messages);
    expect(group.unreadCount).toBe(1);
  });

  it('computes countByYear correctly', () => {
    const messages: MessageMetadata[] = [
      makeMsg({ id: '1', from: 'alice@example.com', date: '2023-06-01T00:00:00.000Z' }),
      makeMsg({ id: '2', from: 'alice@example.com', date: '2024-03-01T00:00:00.000Z' }),
    ];
    const [group] = groupBySender(messages);
    expect(group.countByYear[2023]).toBe(1);
    expect(group.countByYear[2024]).toBe(1);
  });

  it('initializes isUnsubscribed and unsubscribeLink', () => {
    const messages: MessageMetadata[] = [
      makeMsg({ id: '1', from: 'alice@example.com' }),
    ];
    const [group] = groupBySender(messages);
    expect(group.isUnsubscribed).toBe(false);
    expect(group.unsubscribeLink).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// groupByDomain
// ---------------------------------------------------------------------------

describe('groupByDomain', () => {
  it('groups sender groups by domain', () => {
    const messages: MessageMetadata[] = [
      makeMsg({ id: '1', from: 'alice@example.com' }),
      makeMsg({ id: '2', from: 'bob@example.com' }),
      makeMsg({ id: '3', from: 'carol@other.com' }),
    ];
    const senderGroups = groupBySender(messages);
    const domainGroups = groupByDomain(senderGroups);
    expect(domainGroups).toHaveLength(2);
    const exampleDomain = domainGroups.find((d) => d.domain === 'example.com');
    expect(exampleDomain?.uniqueSenderCount).toBe(2);
    expect(exampleDomain?.totalCount).toBe(2);
  });

  it('sorts by totalCount descending', () => {
    const messages: MessageMetadata[] = [
      makeMsg({ id: '1', from: 'a@small.com' }),
      makeMsg({ id: '2', from: 'b@big.com' }),
      makeMsg({ id: '3', from: 'c@big.com' }),
    ];
    const domainGroups = groupByDomain(groupBySender(messages));
    expect(domainGroups[0].domain).toBe('big.com');
  });

  it('sets isSuspectedSpam if any member is spam', () => {
    const messages: MessageMetadata[] = Array.from({ length: 10 }, (_, i) =>
      makeMsg({
        id: String(i),
        from: 'spam@example.com',
        subject: 'Big offer deal sale',
        isUnread: true,
      }),
    );
    const senderGroups = groupBySender(messages);
    const domainGroups = groupByDomain(senderGroups);
    const eg = domainGroups.find((d) => d.domain === 'example.com');
    expect(eg?.isSuspectedSpam).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyTimeFilter
// ---------------------------------------------------------------------------

describe('applyTimeFilter', () => {
  it('returns all groups for filter type "all"', () => {
    const messages: MessageMetadata[] = [
      makeMsg({ id: '1', from: 'a@example.com' }),
    ];
    const groups = groupBySender(messages);
    expect(applyTimeFilter(groups, { type: 'all' })).toHaveLength(1);
  });

  it('removes groups whose lastDate is not older than cutoff', () => {
    const recentDate = new Date();
    recentDate.setMonth(recentDate.getMonth() - 1); // 1 month ago
    const messages: MessageMetadata[] = [
      makeMsg({ id: '1', from: 'a@example.com', date: recentDate.toISOString() }),
    ];
    const groups = groupBySender(messages);
    // Filter for older than 6 months — recent group should be excluded
    const result = applyTimeFilter(groups, { type: 'olderThan', months: 6 });
    expect(result).toHaveLength(0);
  });

  it('keeps groups whose lastDate is older than cutoff', () => {
    const oldDate = new Date();
    oldDate.setFullYear(oldDate.getFullYear() - 2); // 2 years ago
    const messages: MessageMetadata[] = [
      makeMsg({ id: '1', from: 'a@example.com', date: oldDate.toISOString() }),
    ];
    const groups = groupBySender(messages);
    const result = applyTimeFilter(groups, { type: 'olderThan', months: 6 });
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// applySearchFilter
// ---------------------------------------------------------------------------

describe('applySearchFilter', () => {
  const messages: MessageMetadata[] = [
    makeMsg({ id: '1', from: '"Alice Smith" <alice@example.com>' }),
    makeMsg({ id: '2', from: 'bob@other.com' }),
  ];
  const groups = groupBySender(messages);

  it('returns all groups for empty query', () => {
    expect(applySearchFilter(groups, '')).toHaveLength(2);
    expect(applySearchFilter(groups, '   ')).toHaveLength(2);
  });

  it('matches by email (case-insensitive)', () => {
    const result = applySearchFilter(groups, 'ALICE@EXAMPLE');
    expect(result).toHaveLength(1);
    expect(result[0].sender.email).toBe('alice@example.com');
  });

  it('matches by display name (case-insensitive)', () => {
    const result = applySearchFilter(groups, 'alice smith');
    expect(result).toHaveLength(1);
  });

  it('returns empty when no match', () => {
    expect(applySearchFilter(groups, 'nobody')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// detectSpam
// ---------------------------------------------------------------------------

describe('detectSpam', () => {
  function makeGroup(overrides: Partial<SenderGroup> = {}): SenderGroup {
    return {
      sender: { email: 'test@example.com', name: '', domain: 'example.com' },
      messageIds: [],
      count: 0,
      firstDate: '2024-01-01T00:00:00.000Z',
      lastDate: '2024-01-01T00:00:00.000Z',
      unreadCount: 0,
      unsubscribeLink: null,
      isUnsubscribed: false,
      spamReasons: [],
      isSuspectedSpam: false,
      countByYear: {},
      subjectClusters: [],
      ...overrides,
    };
  }

  it('detects keyword in subject', () => {
    const msgs = [makeMsg({ id: '1', from: 'test@example.com', subject: 'Big newsletter inside' })];
    const group = makeGroup({ messageIds: ['1'], count: 1 });
    const reasons = detectSpam(group, msgs);
    expect(reasons.some((r) => r.type === 'keyword')).toBe(true);
  });

  it('detects high unread ratio', () => {
    const msgs = Array.from({ length: 5 }, (_, i) =>
      makeMsg({ id: String(i), from: 'test@example.com', isUnread: true }),
    );
    const group = makeGroup({
      messageIds: msgs.map((m) => m.id),
      count: 5,
      unreadCount: 5,
    });
    const reasons = detectSpam(group, msgs);
    expect(reasons.some((r) => r.type === 'highUnreadRatio')).toBe(true);
  });

  it('detects repetitive subjects when count >= 10', () => {
    const msgs = Array.from({ length: 10 }, (_, i) =>
      makeMsg({ id: String(i), from: 'test@example.com', subject: 'Your order 12345 shipped' }),
    );
    const group = makeGroup({
      messageIds: msgs.map((m) => m.id),
      count: 10,
      unreadCount: 0,
    });
    const reasons = detectSpam(group, msgs);
    expect(reasons.some((r) => r.type === 'repetitiveSubjects')).toBe(true);
  });

  it('does not flag repetitive subjects when count < 10', () => {
    const msgs = Array.from({ length: 9 }, (_, i) =>
      makeMsg({ id: String(i), from: 'test@example.com', subject: 'Same subject every time' }),
    );
    const group = makeGroup({
      messageIds: msgs.map((m) => m.id),
      count: 9,
      unreadCount: 0,
    });
    const reasons = detectSpam(group, msgs);
    expect(reasons.some((r) => r.type === 'repetitiveSubjects')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizeSubject
// ---------------------------------------------------------------------------

describe('normalizeSubject', () => {
  it('replaces date patterns', () => {
    expect(normalizeSubject('Order from 2024-01-15')).toBe('order from #date#');
  });

  it('replaces order/tracking numbers', () => {
    expect(normalizeSubject('Your order ABC123 is ready')).toBe('your order #order# is ready');
  });

  it('replaces remaining numbers', () => {
    expect(normalizeSubject('You have 5 new messages')).toBe('you have #num# new messages');
  });

  it('trims and lowercases', () => {
    expect(normalizeSubject('  Hello World  ')).toBe('hello world');
  });
});

// ---------------------------------------------------------------------------
// clusterSubjects
// ---------------------------------------------------------------------------

describe('clusterSubjects', () => {
  it('returns [] for groups with fewer than 5 messages', () => {
    const msgs = Array.from({ length: 4 }, (_, i) =>
      makeMsg({ id: String(i), from: 'a@example.com' }),
    );
    const [group] = groupBySender(msgs);
    expect(clusterSubjects(group, msgs)).toHaveLength(0);
  });

  it('clusters messages by normalized pattern', () => {
    const msgs = [
      makeMsg({ id: '1', from: 'a@example.com', subject: 'Your order 111 shipped' }),
      makeMsg({ id: '2', from: 'a@example.com', subject: 'Your order 222 shipped' }),
      makeMsg({ id: '3', from: 'a@example.com', subject: 'Your order 333 shipped' }),
      makeMsg({ id: '4', from: 'a@example.com', subject: 'Newsletter digest weekly' }),
      makeMsg({ id: '5', from: 'a@example.com', subject: 'Newsletter digest weekly' }),
    ];
    const [group] = groupBySender(msgs);
    const clusters = clusterSubjects(group, msgs);
    expect(clusters.length).toBeGreaterThan(0);
    const allIds = clusters.flatMap((c) => c.messageIds);
    expect(allIds.sort()).toEqual(group.messageIds.sort());
  });

  it('merges small clusters into Other', () => {
    const msgs = [
      makeMsg({ id: '1', from: 'a@example.com', subject: 'Unique subject one' }),
      makeMsg({ id: '2', from: 'a@example.com', subject: 'Unique subject two' }),
      makeMsg({ id: '3', from: 'a@example.com', subject: 'Unique subject three' }),
      makeMsg({ id: '4', from: 'a@example.com', subject: 'Unique subject four' }),
      makeMsg({ id: '5', from: 'a@example.com', subject: 'Unique subject five' }),
    ];
    const [group] = groupBySender(msgs);
    const clusters = clusterSubjects(group, msgs);
    // All unique patterns → all go to Other
    const other = clusters.find((c) => c.label === 'Other');
    expect(other).toBeDefined();
  });
});
