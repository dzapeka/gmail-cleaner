# Design Document: Gmail Cleaner

## Overview

Gmail Cleaner is a fully client-side React + TypeScript single-page application (SPA) that connects to Gmail via OAuth 2.0 PKCE, downloads email metadata, and provides an interactive interface for analyzing, visualizing, and cleaning a Gmail inbox.

All Gmail API requests are made directly from the browser — there is no backend server. Sensitive data (access tokens, cached metadata) never leaves the user's device.

### Key Design Decisions

- **No backend**: OAuth 2.0 PKCE flow runs entirely in the browser, eliminating the need for a server to exchange authorization codes.
- **Metadata-only**: The app downloads only email headers (From, Subject, Date, List-Unsubscribe), never full message bodies, minimizing data exposure.
- **Local-first caching**: Downloaded metadata is stored in `localStorage` so subsequent sessions skip re-downloading.
- **Pure client-side processing**: All grouping, filtering, spam detection, and CSV generation happen in-browser.

---

## Architecture

### High-Level Component Tree

```
App
├── AuthProvider (OAuth 2.0 context)
│   ├── LoginPage
│   │   └── GoogleSignInButton
│   └── MainLayout (authenticated)
│       ├── Header
│       │   ├── UserInfo
│       │   └── SignOutButton
│       ├── SyncPanel
│       │   ├── SyncProgressBar
│       │   └── SyncControls (TimeFilter, re-sync)
│       ├── StatsBar (total emails, unique senders)
│       ├── ChartSection
│       │   ├── TopNControl
│       │   └── SenderBarChart (Recharts)
│       ├── ToolBar
│       │   ├── SearchInput
│       │   ├── GroupingToggle (By sender / By domain)
│       │   ├── SpamFilterToggle
│       │   ├── TimeFilterSelect
│       │   └── ExportCsvButton
│       ├── SenderTable (TanStack Table)
│       │   ├── SenderRow
│       │   │   ├── SelectCheckbox
│       │   │   ├── SpamIndicator
│       │   │   ├── UnsubscribeButton
│       │   │   └── ExpandToggle
│       │   └── ExpandedEmailList
│       ├── SelectionSummaryBar
│       │   ├── SelectedCount
│       │   ├── DeleteButton
│       │   └── CreateFilterButton
│       ├── DeleteConfirmDialog
│       ├── FilterConfigDialog
│       └── UnsubscribeConfirmDialog
```

### Data Flow

```
Google OAuth 2.0 PKCE
        │
        ▼
  AccessToken (sessionStorage)
        │
        ▼
  GmailApiClient
  ├── listMessages() → paginated message IDs
  └── batchGetMetadata() → MessageMetadata[]
        │
        ▼
  MetadataCache (localStorage)
        │
        ▼
  DataProcessor
  ├── groupBySender()   → SenderGroup[]
  ├── groupByDomain()   → DomainGroup[]
  ├── detectSpam()      → flags SuspectedSpamSender
  ├── clusterSubjects() → SubjectCluster[]
  └── extractUnsubscribeLinks()
        │
        ▼
  AppState (React context / useState)
  ├── senderGroups[]
  ├── domainGroups[]
  ├── activeFilters (time, search, spam, grouping mode)
  └── selection (selected sender IDs)
        │
        ▼
  UI Components (read from AppState, dispatch actions)
```

---

## Data Models

```typescript
// Raw header from Gmail API
interface EmailHeader {
  name: string;
  value: string;
}

// Minimal metadata per message (stored in cache)
interface MessageMetadata {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;          // ISO 8601
  isUnread: boolean;
  listUnsubscribe: string | null;
}

// Parsed sender identity
interface SenderIdentity {
  email: string;         // normalized lowercase
  name: string;
  domain: string;        // part after "@"
}

// Subject cluster within a SenderGroup
interface SubjectCluster {
  label: "Promotional" | "Transactional" | "Newsletter" | "Other";
  normalizedPattern: string;
  messageIds: string[];
  count: number;
  exampleSubjects: string[];  // up to 3
}

// Aggregated group for a single sender
interface SenderGroup {
  sender: SenderIdentity;
  messageIds: string[];
  count: number;
  firstDate: string;
  lastDate: string;
  unreadCount: number;
  unsubscribeLink: string | null;
  isUnsubscribed: boolean;
  spamReasons: SpamReason[];
  isSuspectedSpam: boolean;
  countByYear: Record<number, number>;
  subjectClusters: SubjectCluster[];
}

// Aggregated group for a domain
interface DomainGroup {
  domain: string;
  senderGroups: SenderGroup[];
  totalCount: number;
  uniqueSenderCount: number;
  lastDate: string;
  isSuspectedSpam: boolean;
}

type SpamReason =
  | { type: "keyword"; matchedKeyword: string }
  | { type: "highUnreadRatio"; ratio: number }
  | { type: "repetitiveSubjects"; ratio: number };

interface ActiveFilters {
  timeFilter: TimeFilter;
  searchQuery: string;
  showSpamOnly: boolean;
  groupingMode: "sender" | "domain";
  topN: number | "all";
}

type TimeFilter =
  | { type: "all" }
  | { type: "olderThan"; months: number };

interface CachedSession {
  userId: string;
  email: string;
  cachedAt: string;
  messages: MessageMetadata[];
  unsubscribedSenders: string[];
}

interface GmailFilterSpec {
  criteria: { from: string };
  action: {
    addLabelIds?: string[];
    removeLabelIds?: string[];
  };
}

interface SelectionState {
  selectedSenderEmails: Set<string>;
  selectedMessageIds: Set<string>;
}
```

---

## Gmail API Integration

### OAuth 2.0 PKCE Flow (Browser-Only)

```
1. User clicks "Sign in with Google"
2. App generates code_verifier (64-byte random, base64url) and code_challenge (SHA-256)
3. App stores code_verifier in sessionStorage
4. App redirects to Google authorization endpoint with PKCE params
5. Google redirects back with ?code=<auth_code>
6. App POSTs to https://oauth2.googleapis.com/token with code + code_verifier
7. App receives { access_token, expires_in, refresh_token }
8. App stores tokens in sessionStorage under "gmail-cleaner-auth"
```

Token refresh: before each API call, if token expires within 60 seconds, refresh transparently.

### Metadata Download

- Paginate `users.messages.list` (500 per page) across INBOX, SENT, ALL_MAIL
- Batch-fetch metadata in groups of 100 using `format=METADATA`
- Headers fetched: From, Subject, Date, List-Unsubscribe
- Parse labelIds to determine `isUnread` (presence of "UNREAD" label)

### Batch Deletion

```
POST /gmail/v1/users/me/messages/batchModify
{ ids: string[50], addLabelIds: ["TRASH"] }
```

---

## State Management

Three React contexts:

| Context | Responsibility |
|---|---|
| `AuthContext` | OAuth tokens, sign-in/sign-out |
| `DataContext` | Raw `MessageMetadata[]`, sync status, cache |
| `ViewContext` | `ActiveFilters`, derived groups, selection state |

Derived state via `useMemo`:
```
MessageMetadata[] + ActiveFilters → filteredSenderGroups → filteredDomainGroups
```
Search debounced at 80ms.

---

## Local Caching Strategy

| Storage | Key | Content | Cleared on |
|---|---|---|---|
| `sessionStorage` | `gmail-cleaner-auth` | tokens + userId | sign-out, tab close |
| `localStorage` | `gmail-cleaner-cache-<userId>` | `CachedSession` | sign-out, re-sync |
| `localStorage` | `gmail-cleaner-unsubscribed` | `string[]` emails | sign-out |

Cache older than 24 hours prompts re-sync.

---

## Smart Spam Detection Algorithm

Three rules — any match sets `isSuspectedSpam = true`:

**Rule 1: Spam keywords in subjects**
Keywords: `["unsubscribe", "promotion", "newsletter", "offer", "deal"]`

**Rule 2: High unread ratio**
`unreadCount / count >= 0.8`

**Rule 3: Repetitive subject structure**
`count >= 10` AND top normalized pattern >= 70% of subjects.
Normalization: replace dates → `#DATE#`, numbers → `#NUM#`.

---

## Subject Clustering Algorithm

Only for groups with `count >= 5`.

1. Normalize subjects: dates → `#DATE#`, order numbers → `#ORDER#`, numbers → `#NUM#`
2. Group by normalized pattern
3. Merge clusters with < 2 messages into "Other"
4. Label by keyword priority (Transactional > Promotional > Newsletter > Other):

| Label | Keywords |
|---|---|
| Transactional | order, invoice, receipt, payment, confirmation, shipping, delivery |
| Promotional | offer, deal, sale, discount, % off, promotion, limited time |
| Newsletter | newsletter, digest, weekly, monthly, update |
| Other | no match |

5. Collect up to 3 example subjects per cluster.

---

## Unsubscribe Link Detection

Parse `List-Unsubscribe` header — prefer `https://` > `http://` > `mailto:`.

```typescript
function parseUnsubscribeLink(headerValue: string): string | null {
  const matches = [...headerValue.matchAll(/<([^>]+)>/g)].map(m => m[1]);
  return matches.find(u => u.startsWith("https://"))
      ?? matches.find(u => u.startsWith("http://"))
      ?? matches.find(u => u.startsWith("mailto:"))
      ?? null;
}
```

---

## CSV Export

UTF-8 BOM + 8 fields: email, name, count, %, first date, last date, spam flag, unsubscribe flag.
Filename: `gmail-cleaner-export-YYYY-MM-DD.csv`.

---

## Correctness Properties

### Property 1: Grouping completeness
Every message appears in exactly one SenderGroup. **Validates: Req 3.1**

### Property 2: Sorting correctness
Sorted array is in correct order and contains same elements. **Validates: Req 3.2, 3.4**

### Property 3: Search filter correctness
Every result matches query; no match is omitted. **Validates: Req 3.5**

### Property 4: Top-N selection correctness
Returns exactly `min(N, total)` highest-count groups. **Validates: Req 4.1**

### Property 5: Aggregate statistics correctness
Total count = `messages.length`; sum of `countByYear` = `group.count`. **Validates: Req 4.6, 10.4**

### Property 6: Tooltip content completeness
Tooltip contains name, count, percentage, and spam reasons. **Validates: Req 4.7, 9.6**

### Property 7: Selection invariant
After "Select all", selection = all filtered groups; count = sum of counts. **Validates: Req 5.2, 5.3**

### Property 8: Expanded group completeness
Expanded list has exactly one row per messageId. **Validates: Req 5.5**

### Property 9: Deletion batch size
Every batch ≤ 50 IDs; union = original set. **Validates: Req 6.3**

### Property 10: Post-deletion state consistency
No deleted IDs remain; counts updated. **Validates: Req 6.6**

### Property 11: Spam detection correctness
All three rules applied correctly; no false positives. **Validates: Req 9.1, 9.2, 9.3**

### Property 12: Spam filter correctness
Filtered result contains only `isSuspectedSpam === true` groups. **Validates: Req 9.5**

### Property 13: Spam indicator rendering
Indicator present iff `isSuspectedSpam === true`. **Validates: Req 9.4**

### Property 14: Time filter correctness
Every returned message satisfies the date constraint. **Validates: Req 10.1**

### Property 15: Cache round-trip
Save + load produces deeply equal `CachedSession`. **Validates: Req 2.6, 11.5**

### Property 16: Unsubscribe link parsing
Correct URL preference order; null when no URLs. **Validates: Req 11.1**

### Property 17: Unsubscribe button visibility
Button shown iff `unsubscribeLink` is non-null. **Validates: Req 11.2, 11.6**

### Property 18: CSV field completeness
One row per group; all 8 fields correct. **Validates: Req 12.2**

### Property 19: CSV filter correctness
CSV contains exactly the filtered rows. **Validates: Req 12.4**

### Property 20: Domain grouping correctness
Every SenderGroup in exactly one DomainGroup by domain. **Validates: Req 13.2**

### Property 21: DomainGroup aggregate correctness
`totalCount`, `uniqueSenderCount`, `lastDate` computed correctly. **Validates: Req 13.3**

### Property 22: DomainGroup selection resolution
Union of messageIds = all member SenderGroup messageIds, no duplicates. **Validates: Req 13.5**

### Property 23: Subject clustering completeness
For `count >= 5`: union of cluster messageIds = group.messageIds exactly. **Validates: Req 14.1**

---

## Error Handling

| Scenario | Behavior |
|---|---|
| OAuth redirect fails | Show error banner with retry |
| Token expired | Refresh transparently, retry once |
| Gmail API 429 | Exponential backoff: 2s, 4s, 8s |
| Gmail API 5xx | Retry 3x with 2s delay, then show error |
| Gmail API 4xx | Show error immediately |
| localStorage quota exceeded | Warn user, continue without cache |
| Malformed List-Unsubscribe | Return null, log warning |
| CSV download blocked | Show clipboard fallback |
| OAuth scopes denied | Explain required permissions |

---

## Testing Strategy

### Unit Tests (Vitest)
- `groupBySender`, `groupByDomain`, `detectSpam`, `clusterSubjects`
- `applyTimeFilter`, `applySearchFilter`, `parseUnsubscribeLink`, `generateCsv`, `parseSenderEmail`

### Property-Based Tests (fast-check, min 100 iterations)
P1–P23 as listed above. Each tagged: `// Feature: gmail-cleaner, Property N: <text>`

### Integration Tests
- OAuth PKCE flow (mock auth server)
- Gmail API pagination (mock server)
- Batch deletion with partial failure

### Component Tests (React Testing Library)
- LoginPage, SenderTable, SenderBarChart, DeleteConfirmDialog, FilterConfigDialog
