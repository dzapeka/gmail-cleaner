# Implementation Plan: Gmail Cleaner

## Overview

Implement a fully client-side React + TypeScript SPA that connects to Gmail via OAuth 2.0 PKCE, downloads email metadata, and provides an interactive interface for analyzing, visualizing, and cleaning a Gmail inbox. The stack is React + TypeScript + Vite, Recharts for charts, TanStack Table v8 for the sender table, Vitest + React Testing Library for tests, and fast-check for property-based tests.

## Tasks

- [x] 1. Project scaffolding and core type definitions
  - Initialize Vite + React + TypeScript project with the directory structure: `src/types`, `src/api`, `src/data`, `src/cache`, `src/context`, `src/components`, `src/hooks`, `src/utils`
  - Create `src/types/index.ts` with all interfaces and types from the design: `EmailHeader`, `MessageMetadata`, `SenderIdentity`, `SubjectCluster`, `SenderGroup`, `DomainGroup`, `SpamReason`, `ActiveFilters`, `TimeFilter`, `CachedSession`, `GmailFilterSpec`, `SelectionState`
  - Install dependencies: `recharts`, `@tanstack/react-table`, `fast-check`, `vitest`, `@testing-library/react`, `@testing-library/user-event`
  - Configure Vitest in `vite.config.ts`
  - _Requirements: 1.1, 2.2, 3.1, 4.4, 5.1_

- [x] 2. OAuth 2.0 PKCE authentication
  - [x] 2.1 Implement `src/api/auth.ts` with PKCE helpers: `generateCodeVerifier()`, `generateCodeChallenge(verifier)`, `buildAuthUrl(challenge)`, `exchangeCodeForTokens(code, verifier)`, `refreshAccessToken(refreshToken)`
    - Store `access_token`, `refresh_token`, `expiry`, `userId` in `sessionStorage` under key `gmail-cleaner-auth`
    - _Requirements: 1.2, 1.3, 8.2_
  - [x] 2.2 Implement `src/context/AuthContext.tsx` — `AuthProvider` that manages the full PKCE lifecycle, handles the `/auth/callback` redirect, exposes `{ isAuthenticated, accessToken, signIn, signOut }` via React context
    - On `signOut`, clear `sessionStorage` and `localStorage` entries
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 8.4_
  - [x] 2.3 Implement `src/components/LoginPage.tsx` and `src/components/GoogleSignInButton.tsx`
    - Show error banner with retry option when OAuth fails
    - _Requirements: 1.1, 1.4_

- [x] 3. Gmail API client
  - [x] 3.1 Implement `src/api/gmailClient.ts` — `GmailApiClient` class with methods: `listMessageIds(pageToken?, labelIds?, query?)`, `batchGetMetadata(ids[])`, `trashMessages(ids[])`, `createFilter(criteria, action)`
    - Attach `Authorization: Bearer <token>` header automatically
    - Implement retry logic: up to 3 retries with 2-second delay on 5xx / 429; exponential backoff (2s, 4s, 8s) on 429
    - Transparently refresh token when within 60 seconds of expiry before each call
    - _Requirements: 2.4, 2.5, 6.3, 7.3, 8.5_
  - [ ]* 3.2 Write unit tests for `GmailApiClient` retry logic and token refresh
    - _Requirements: 2.5_

- [x] 4. Metadata download and caching
  - [x] 4.1 Implement `src/cache/MetadataCache.ts` — `load(userId)`, `save(userId, session)`, `clear(userId)` using `localStorage` key `gmail-cleaner-cache-<userId>`; handle `QuotaExceededError` gracefully
    - Also manage `gmail-cleaner-unsubscribed` key in `localStorage`
    - _Requirements: 2.6, 8.3, 8.4, 11.5_
  - [ ]* 4.2 Write property test for cache round-trip (Property 15)
    - **Validates: Requirements 2.6, 11.5**
  - [x] 4.3 Implement `src/context/DataContext.tsx` — `DataProvider` that orchestrates metadata download: paginate `listMessageIds` (500 per page) across INBOX, SENT, ALL_MAIL labels, batch-fetch metadata in groups of 100, report progress, load from / save to `MetadataCache`
    - Show "Last synced: X ago" indicator; prompt re-sync if cache is older than 24 hours
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_
  - [x] 4.4 Implement `src/components/SyncPanel.tsx` with `SyncProgressBar` and sync controls (TimeFilter select, Re-sync button)
    - _Requirements: 2.3, 10.1_

- [x] 5. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 6. Core data processing — grouping and filtering
  - [x] 6.1 Implement `src/utils/parseSender.ts` — `parseSenderEmail(from: string): string` and `parseSenderIdentity(from: string): SenderIdentity` handling RFC 5322 display-name + address format and bare addresses
    - _Requirements: 3.1_
  - [x] 6.2 Implement `src/data/DataProcessor.ts` — `groupBySender(messages: MessageMetadata[]): SenderGroup[]`
    - _Requirements: 3.1, 3.3, 10.4_
  - [ ]* 6.3 Write property test for grouping completeness (Property 1)
    - **Validates: Requirements 3.1**
  - [ ]* 6.4 Write property test for aggregate statistics correctness (Property 5)
    - **Validates: Requirements 4.6, 10.4**
  - [x] 6.5 Implement `groupByDomain(senderGroups: SenderGroup[]): DomainGroup[]` in `DataProcessor.ts`
    - _Requirements: 13.2, 13.3_
  - [ ]* 6.6 Write property test for domain grouping correctness (Property 20)
    - **Validates: Requirements 13.2**
  - [ ]* 6.7 Write property test for DomainGroup aggregate correctness (Property 21)
    - **Validates: Requirements 13.3**
  - [x] 6.8 Implement `applyTimeFilter(groups: SenderGroup[], filter: TimeFilter): SenderGroup[]` in `DataProcessor.ts`
    - _Requirements: 10.1, 10.2, 10.3_
  - [ ]* 6.9 Write property test for time filter correctness (Property 14)
    - **Validates: Requirements 10.1**
  - [x] 6.10 Implement `applySearchFilter(groups: SenderGroup[], query: string): SenderGroup[]` in `DataProcessor.ts`
    - _Requirements: 3.5, 3.6_
  - [ ]* 6.11 Write property test for search filter correctness (Property 3)
    - **Validates: Requirements 3.5**

- [x] 7. Spam detection and subject clustering
  - [x] 7.1 Implement `detectSpam(group: SenderGroup, messages: MessageMetadata[]): SpamReason[]` in `DataProcessor.ts`
    - _Requirements: 9.1, 9.2, 9.3_
  - [ ]* 7.2 Write property test for spam detection correctness (Property 11)
    - **Validates: Requirements 9.1, 9.2, 9.3**
  - [x] 7.3 Implement `normalizeSubject(subject: string): string` and `clusterSubjects(group: SenderGroup, messages: MessageMetadata[]): SubjectCluster[]` in `DataProcessor.ts`
    - _Requirements: 14.1, 14.2, 14.4_
  - [ ]* 7.4 Write property test for subject clustering completeness (Property 23)
    - **Validates: Requirements 14.1**
  - [x] 7.5 Wire `detectSpam` and `clusterSubjects` into `groupBySender`
    - _Requirements: 9.1, 9.2, 9.3, 14.1_

- [ ] 8. Unsubscribe link detection and CSV export
  - [ ] 8.1 Implement `parseUnsubscribeLink(headerValue: string): string | null` in `src/utils/unsubscribe.ts`
    - _Requirements: 11.1_
  - [ ]* 8.2 Write property test for unsubscribe link parsing (Property 16)
    - **Validates: Requirements 11.1**
  - [ ] 8.3 Implement `extractUnsubscribeLink` in `DataProcessor.ts`
    - _Requirements: 11.1_
  - [ ] 8.4 Implement `generateCsv` and `downloadCsv` in `src/utils/csvExport.ts`
    - _Requirements: 12.1, 12.2, 12.3, 12.5_
  - [ ]* 8.5 Write property test for CSV field completeness (Property 18)
    - **Validates: Requirements 12.2**
  - [ ]* 8.6 Write property test for CSV filter correctness (Property 19)
    - **Validates: Requirements 12.4**

- [ ] 9. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [ ] 10. View context and derived state
  - [ ] 10.1 Implement `src/context/ViewContext.tsx` — `ViewProvider` managing `ActiveFilters`, derived groups via `useMemo`, and `SelectionState`
    - _Requirements: 3.6, 4.3, 10.3, 13.6_
  - [ ] 10.2 Implement top-N selection logic inside `ViewContext`
    - _Requirements: 4.1, 4.2_
  - [ ]* 10.3 Write property test for top-N selection correctness (Property 4)
    - **Validates: Requirements 4.1**
  - [ ] 10.4 Implement sorting logic in `ViewContext`
    - _Requirements: 3.2, 3.4_
  - [ ]* 10.5 Write property test for sorting correctness (Property 2)
    - **Validates: Requirements 3.2, 3.4**
  - [ ] 10.6 Implement selection helpers in `ViewContext`: `selectAll`, `deselectAll`, `toggleSender`, `toggleMessage`, `getSelectedEmailCount`
    - _Requirements: 5.1, 5.2, 5.3_
  - [ ]* 10.7 Write property test for selection invariant (Property 7)
    - **Validates: Requirements 5.2, 5.3**
  - [ ] 10.8 Implement `resolveSelectedMessageIds(selectedDomainGroups)` in `ViewContext`
    - _Requirements: 13.5_
  - [ ]* 10.9 Write property test for DomainGroup selection resolution (Property 22)
    - **Validates: Requirements 13.5**

- [ ] 11. Statistics bar and chart section
  - [ ] 11.1 Implement `src/components/StatsBar.tsx`
    - _Requirements: 4.6_
  - [ ] 11.2 Implement `src/components/ChartSection.tsx` with `TopNControl` and `SenderBarChart` (Recharts)
    - _Requirements: 4.1, 4.2, 4.3, 4.7, 4.8_

- [ ] 12. Sender table
  - [ ] 12.1 Implement `src/components/SenderTable.tsx` using TanStack Table v8
    - _Requirements: 3.2, 3.3, 3.4, 4.4, 4.5, 4.8_
  - [ ] 12.2 Implement `SenderRow` with `SelectCheckbox`, `SpamIndicator`, `UnsubscribeButton`, `ExpandToggle`
    - _Requirements: 5.1, 9.4, 9.6, 11.2, 11.6_
  - [ ]* 12.3 Write property test for spam indicator rendering (Property 13)
    - **Validates: Requirements 9.4**
  - [ ]* 12.4 Write property test for unsubscribe button visibility (Property 17)
    - **Validates: Requirements 11.2, 11.6**
  - [ ] 12.5 Implement `ExpandedEmailList` with SubjectCluster sub-rows and breakdown summary
    - _Requirements: 5.4, 5.5, 14.2, 14.3, 14.5, 14.6_
  - [ ]* 12.6 Write property test for expanded group completeness (Property 8)
    - **Validates: Requirements 5.5**

- [ ] 13. Toolbar and filter controls
  - [ ] 13.1 Implement `src/components/ToolBar.tsx` with all filter controls and ExportCsvButton
    - _Requirements: 3.5, 3.6, 9.5, 10.1, 10.2, 10.3, 12.1, 12.4, 13.1, 13.6_
  - [ ]* 13.2 Write property test for spam filter correctness (Property 12)
    - **Validates: Requirements 9.5**

- [ ] 14. Selection summary bar and deletion flow
  - [ ] 14.1 Implement `src/components/SelectionSummaryBar.tsx`
    - _Requirements: 5.3_
  - [ ] 14.2 Implement `src/components/DeleteConfirmDialog.tsx`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [ ]* 14.3 Write property test for deletion batch size (Property 9)
    - **Validates: Requirements 6.3**
  - [ ]* 14.4 Write property test for post-deletion state consistency (Property 10)
    - **Validates: Requirements 6.6**

- [ ] 15. Filter creation and unsubscribe flows
  - [ ] 15.1 Implement `src/components/FilterConfigDialog.tsx`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [ ] 15.2 Implement `src/components/UnsubscribeConfirmDialog.tsx`
    - _Requirements: 11.3, 11.4, 11.5_

- [ ] 16. Header, layout wiring, and security hardening
  - [ ] 16.1 Implement `src/components/Header.tsx` and `src/components/MainLayout.tsx`
    - _Requirements: 1.5_
  - [ ] 16.2 Wire all contexts into `App.tsx`
    - _Requirements: 1.1, 8.1, 8.2, 8.3, 8.4, 8.5_
  - [ ] 16.3 Verify security requirements: token storage, data isolation, no proxy
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 17. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Remaining property-based tests
  - [ ]* 18.1 Write property test for tooltip content completeness (Property 6)
    - **Validates: Requirements 4.7, 9.6**

- [ ] 19. Component tests (React Testing Library)
  - [ ]* 19.1 Write component test for `LoginPage`
    - _Requirements: 1.1, 1.4_
  - [ ]* 19.2 Write component test for `SenderTable`
    - _Requirements: 3.2, 3.3, 4.4, 4.5_
  - [ ]* 19.3 Write component test for `SenderBarChart`
    - _Requirements: 4.7, 4.8_
  - [ ]* 19.4 Write component test for `DeleteConfirmDialog`
    - _Requirements: 6.1_
  - [ ]* 19.5 Write component test for `FilterConfigDialog`
    - _Requirements: 7.2_

- [ ] 20. Final checkpoint — Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use fast-check (minimum 100 iterations each)
- All property tests must include the comment `// Feature: gmail-cleaner, Property N: <property_text>`
