import type {
  MessageMetadata,
  SenderGroup,
  DomainGroup,
  TimeFilter,
  SpamReason,
  SubjectCluster,
} from '../types';
import { parseSenderIdentity } from '../utils/parseSender';
import { extractUnsubscribeLink } from '../utils/unsubscribe';

// ---------------------------------------------------------------------------
// groupBySender
// ---------------------------------------------------------------------------

/**
 * Group messages by normalized sender email address.
 * Results are sorted by count descending.
 */
export function groupBySender(messages: MessageMetadata[]): SenderGroup[] {
  const map = new Map<string, SenderGroup>();

  for (const msg of messages) {
    const identity = parseSenderIdentity(msg.from);
    const key = identity.email;

    if (!map.has(key)) {
      map.set(key, {
        sender: identity,
        messageIds: [],
        count: 0,
        firstDate: msg.date,
        lastDate: msg.date,
        unreadCount: 0,
        unsubscribeLink: null,
        isUnsubscribed: false,
        spamReasons: [],
        isSuspectedSpam: false,
        countByYear: {},
        subjectClusters: [],
      });
    }

    const group = map.get(key)!;
    group.messageIds.push(msg.id);
    group.count += 1;

    if (msg.isUnread) group.unreadCount += 1;

    if (msg.date < group.firstDate) group.firstDate = msg.date;
    if (msg.date > group.lastDate) group.lastDate = msg.date;

    const year = new Date(msg.date).getFullYear();
    group.countByYear[year] = (group.countByYear[year] ?? 0) + 1;
  }

  const groups = Array.from(map.values());

  for (const group of groups) {
    group.spamReasons = detectSpam(group, messages);
    group.isSuspectedSpam = group.spamReasons.length > 0;
    group.subjectClusters = clusterSubjects(group, messages);

    const groupMessages = messages.filter((m) => group.messageIds.includes(m.id));
    group.unsubscribeLink = extractUnsubscribeLink(groupMessages);
  }

  return groups.sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// groupByDomain
// ---------------------------------------------------------------------------

/**
 * Group SenderGroups by sender domain.
 * Results are sorted by totalCount descending.
 */
export function groupByDomain(senderGroups: SenderGroup[]): DomainGroup[] {
  const map = new Map<string, DomainGroup>();

  for (const sg of senderGroups) {
    const domain = sg.sender.domain;

    if (!map.has(domain)) {
      map.set(domain, {
        domain,
        senderGroups: [],
        totalCount: 0,
        uniqueSenderCount: 0,
        lastDate: sg.lastDate,
        isSuspectedSpam: false,
      });
    }

    const dg = map.get(domain)!;
    dg.senderGroups.push(sg);
    dg.totalCount += sg.count;
    dg.uniqueSenderCount += 1;

    if (sg.lastDate > dg.lastDate) dg.lastDate = sg.lastDate;
    if (sg.isSuspectedSpam) dg.isSuspectedSpam = true;
  }

  return Array.from(map.values()).sort((a, b) => b.totalCount - a.totalCount);
}

// ---------------------------------------------------------------------------
// applyTimeFilter
// ---------------------------------------------------------------------------

/**
 * Filter SenderGroup messages to only those older than the cutoff date.
 * Groups with no remaining messages are removed.
 */
export function applyTimeFilter(
  groups: SenderGroup[],
  filter: TimeFilter,
): SenderGroup[] {
  if (filter.type === 'all') return groups;

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - filter.months);
  const cutoffIso = cutoff.toISOString();

  const result: SenderGroup[] = [];

  for (const group of groups) {
    // We need the original message list to filter — rebuild from messageIds
    // Since we only have messageIds here, we filter by date stored on the group.
    // applyTimeFilter works on SenderGroup level; to recompute per-message stats
    // we need the raw messages. This function accepts groups only, so we
    // recompute based on what's available in the group.
    //
    // For full per-message filtering, callers should use applyTimeFilterWithMessages.
    // Here we do a best-effort: keep the group if lastDate < cutoff, and
    // adjust firstDate/lastDate/count proportionally is not possible without
    // raw messages. The design says "keep only messages where date < cutoff",
    // so we expose a variant that takes messages too (used internally).
    //
    // For the public API we filter the group entirely based on lastDate.
    // The proper implementation is in applyTimeFilterWithMessages.
    if (group.lastDate < cutoffIso) {
      result.push(group);
    }
  }

  return result;
}

/**
 * Filter SenderGroup messages by time range, recomputing all per-group statistics.
 * Supports: all, newerThan (last N months), olderThan (older than N months).
 */
export function applyTimeFilterWithMessages(
  groups: SenderGroup[],
  filter: TimeFilter,
  allMessages: MessageMetadata[],
): SenderGroup[] {
  if (filter.type === 'all') return groups;

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - filter.months);
  const cutoffIso = cutoff.toISOString();

  const msgById = new Map<string, MessageMetadata>();
  for (const m of allMessages) msgById.set(m.id, m);

  const result: SenderGroup[] = [];

  for (const group of groups) {
    const filteredIds = group.messageIds.filter((id) => {
      const m = msgById.get(id);
      if (!m) return false;
      // newerThan: keep messages after cutoff; olderThan: keep messages before cutoff
      return filter.type === 'newerThan' ? m.date >= cutoffIso : m.date < cutoffIso;
    });

    if (filteredIds.length === 0) continue;

    const filteredMessages = filteredIds
      .map((id) => msgById.get(id)!)
      .filter(Boolean);

    let firstDate = filteredMessages[0].date;
    let lastDate = filteredMessages[0].date;
    let unreadCount = 0;
    const countByYear: Record<number, number> = {};

    for (const m of filteredMessages) {
      if (m.date < firstDate) firstDate = m.date;
      if (m.date > lastDate) lastDate = m.date;
      if (m.isUnread) unreadCount += 1;
      const year = new Date(m.date).getFullYear();
      countByYear[year] = (countByYear[year] ?? 0) + 1;
    }

    result.push({
      ...group,
      messageIds: filteredIds,
      count: filteredIds.length,
      firstDate,
      lastDate,
      unreadCount,
      countByYear,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// applySearchFilter
// ---------------------------------------------------------------------------

/**
 * Filter SenderGroups by a case-insensitive query against email or display name.
 * Returns all groups when query is empty/whitespace.
 */
export function applySearchFilter(
  groups: SenderGroup[],
  query: string,
): SenderGroup[] {
  const trimmed = query.trim();
  if (!trimmed) return groups;

  const lower = trimmed.toLowerCase();
  return groups.filter(
    (g) =>
      g.sender.email.toLowerCase().includes(lower) ||
      g.sender.name.toLowerCase().includes(lower),
  );
}

// ---------------------------------------------------------------------------
// detectSpam
// ---------------------------------------------------------------------------

const SPAM_KEYWORDS = [
  'unsubscribe',
  'promotion',
  'newsletter',
  'offer',
  'deal',
] as const;

/**
 * Evaluate all three spam rules for a SenderGroup and return matching reasons.
 */
export function detectSpam(
  group: SenderGroup,
  messages: MessageMetadata[],
): SpamReason[] {
  const reasons: SpamReason[] = [];

  // Build the set of messages belonging to this sender
  const senderMsgIds = new Set(group.messageIds);
  const senderMessages = messages.filter((m) => senderMsgIds.has(m.id));

  // Rule 1: Spam keywords in subjects
  for (const msg of senderMessages) {
    const subjectLower = msg.subject.toLowerCase();
    for (const kw of SPAM_KEYWORDS) {
      if (subjectLower.includes(kw)) {
        reasons.push({ type: 'keyword', matchedKeyword: kw });
        break; // only first match per sender
      }
    }
    if (reasons.some((r) => r.type === 'keyword')) break;
  }

  // Rule 2: High unread ratio
  if (group.count > 0) {
    const ratio = group.unreadCount / group.count;
    if (ratio >= 0.8) {
      reasons.push({ type: 'highUnreadRatio', ratio });
    }
  }

  // Rule 3: Repetitive subjects (only if count >= 10)
  if (group.count >= 10) {
    const patternCounts = new Map<string, number>();
    for (const msg of senderMessages) {
      const pattern = normalizeSubject(msg.subject);
      patternCounts.set(pattern, (patternCounts.get(pattern) ?? 0) + 1);
    }

    let maxCount = 0;
    for (const count of patternCounts.values()) {
      if (count > maxCount) maxCount = count;
    }

    const ratio = maxCount / group.count;
    if (ratio >= 0.7) {
      reasons.push({ type: 'repetitiveSubjects', ratio });
    }
  }

  return reasons;
}

// ---------------------------------------------------------------------------
// normalizeSubject + clusterSubjects
// ---------------------------------------------------------------------------

/**
 * Normalize a subject line for pattern matching:
 * - Date patterns → #DATE#
 * - Order/tracking numbers (6+ uppercase alphanumeric) → #ORDER#
 * - Remaining numbers → #NUM#
 * - Trim and lowercase
 */
export function normalizeSubject(subject: string): string {
  return subject
    .replace(/\b\d{1,4}[-/]\d{1,2}[-/]\d{1,4}\b/g, '#DATE#')
    .replace(/\b[A-Z0-9]{6,}\b/g, '#ORDER#')
    .replace(/\b\d+\b/g, '#NUM#')
    .trim()
    .toLowerCase();
}

const CLUSTER_LABELS: Array<{
  label: SubjectCluster['label'];
  keywords: string[];
}> = [
  {
    label: 'Transactional',
    keywords: [
      'order',
      'invoice',
      'receipt',
      'payment',
      'confirmation',
      'shipping',
      'delivery',
    ],
  },
  {
    label: 'Promotional',
    keywords: [
      'offer',
      'deal',
      'sale',
      'discount',
      '% off',
      'promotion',
      'limited time',
    ],
  },
  {
    label: 'Newsletter',
    keywords: ['newsletter', 'digest', 'weekly', 'monthly', 'update'],
  },
];

function labelForPattern(pattern: string): SubjectCluster['label'] {
  for (const { label, keywords } of CLUSTER_LABELS) {
    for (const kw of keywords) {
      if (pattern.includes(kw)) return label;
    }
  }
  return 'Other';
}

/**
 * Cluster messages from a SenderGroup by normalized subject pattern.
 * Returns [] for groups with fewer than 5 messages.
 */
export function clusterSubjects(
  group: SenderGroup,
  messages: MessageMetadata[],
): SubjectCluster[] {
  if (group.count < 5) return [];

  const senderMsgIds = new Set(group.messageIds);
  const senderMessages = messages.filter((m) => senderMsgIds.has(m.id));

  // Group by normalized pattern
  const patternMap = new Map<
    string,
    { messageIds: string[]; exampleSubjects: string[] }
  >();

  for (const msg of senderMessages) {
    const pattern = normalizeSubject(msg.subject);
    if (!patternMap.has(pattern)) {
      patternMap.set(pattern, { messageIds: [], exampleSubjects: [] });
    }
    const entry = patternMap.get(pattern)!;
    entry.messageIds.push(msg.id);
    if (entry.exampleSubjects.length < 3) {
      // Collect distinct original subjects
      if (!entry.exampleSubjects.includes(msg.subject)) {
        entry.exampleSubjects.push(msg.subject);
      }
    }
  }

  // Separate main clusters (>= 2 messages) from small ones
  const mainClusters: SubjectCluster[] = [];
  const otherIds: string[] = [];
  const otherExamples: string[] = [];

  for (const [pattern, data] of patternMap.entries()) {
    if (data.messageIds.length < 2) {
      otherIds.push(...data.messageIds);
      for (const ex of data.exampleSubjects) {
        if (otherExamples.length < 3 && !otherExamples.includes(ex)) {
          otherExamples.push(ex);
        }
      }
    } else {
      mainClusters.push({
        label: labelForPattern(pattern),
        normalizedPattern: pattern,
        messageIds: data.messageIds,
        count: data.messageIds.length,
        exampleSubjects: data.exampleSubjects,
      });
    }
  }

  if (otherIds.length > 0) {
    mainClusters.push({
      label: 'Other',
      normalizedPattern: 'other',
      messageIds: otherIds,
      count: otherIds.length,
      exampleSubjects: otherExamples,
    });
  }

  return mainClusters;
}
