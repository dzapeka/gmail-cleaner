// Raw header from Gmail API
export interface EmailHeader {
  name: string;
  value: string;
}

// Minimal metadata per message (stored in cache)
export interface MessageMetadata {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string; // ISO 8601
  isUnread: boolean;
  listUnsubscribe: string | null;
}

// Parsed sender identity
export interface SenderIdentity {
  email: string; // normalized lowercase
  name: string;
  domain: string; // part after "@"
}

// Subject cluster within a SenderGroup
export interface SubjectCluster {
  label: 'Promotional' | 'Transactional' | 'Newsletter' | 'Other';
  normalizedPattern: string;
  messageIds: string[];
  count: number;
  exampleSubjects: string[]; // up to 3
}

// Reason a sender was flagged as suspected spam
export type SpamReason =
  | { type: 'keyword'; matchedKeyword: string }
  | { type: 'highUnreadRatio'; ratio: number }
  | { type: 'repetitiveSubjects'; ratio: number };

// Aggregated group for a single sender email address
export interface SenderGroup {
  sender: SenderIdentity;
  messageIds: string[];
  count: number;
  firstDate: string; // ISO 8601
  lastDate: string;  // ISO 8601
  unreadCount: number;
  unsubscribeLink: string | null;
  isUnsubscribed: boolean;
  spamReasons: SpamReason[];
  isSuspectedSpam: boolean;
  countByYear: Record<number, number>;
  subjectClusters: SubjectCluster[];
}

// Aggregated group for a domain
export interface DomainGroup {
  domain: string;
  senderGroups: SenderGroup[];
  totalCount: number;
  uniqueSenderCount: number;
  lastDate: string; // ISO 8601
  isSuspectedSpam: boolean;
}

// Time filter
export type TimeFilter =
  | { type: 'all' }
  | { type: 'newerThan'; months: number }   // show emails from last N months
  | { type: 'olderThan'; months: number };  // show emails older than N months

// Active filter state
export interface ActiveFilters {
  timeFilter: TimeFilter;
  searchQuery: string;
  showSpamOnly: boolean;
  groupingMode: 'sender' | 'domain';
  topN: number | 'all';
}

// What gets persisted to localStorage
export interface CachedSession {
  userId: string;
  email: string;
  cachedAt: string; // ISO 8601
  messages: MessageMetadata[];
  unsubscribedSenders: string[];
}

// Gmail filter creation payload
export interface GmailFilterSpec {
  criteria: {
    from: string;
  };
  action: {
    addLabelIds?: string[];
    removeLabelIds?: string[];
  };
}

// Selection state
export interface SelectionState {
  selectedSenderEmails: Set<string>;
  selectedMessageIds: Set<string>;
}
