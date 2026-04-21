# Requirements Document

## Introduction

Gmail Cleaner is an application for analyzing, visualizing, and cleaning a Gmail inbox. The application connects to Gmail via OAuth 2.0, downloads email metadata, groups emails by sender, provides a convenient interface for browsing, and allows deleting unwanted emails or creating Gmail filters for automatic blocking.

## Glossary

- **App**: the Gmail Cleaner web application
- **User**: the Gmail account owner using the application
- **Gmail API**: Google's REST API for accessing the mailbox
- **Sender**: the email address and name of the person or organization that sent an email
- **SenderGroup**: the collection of all emails from a single sender
- **MessageMetadata**: email headers (From, Subject, Date) without downloading the body
- **GmailFilter**: a rule in Gmail that automatically processes incoming emails
- **Session**: an authorized user session after OAuth 2.0 login
- **AccessToken**: an OAuth 2.0 token for making requests to the Gmail API
- **Domain**: the part of an email address after the `@` symbol (e.g., `amazon.com`)
- **DomainGroup**: the collection of all SenderGroups whose email addresses belong to the same domain
- **SuspectedSpamSender**: a sender automatically flagged by the application as a potential source of unwanted emails
- **UnsubscribeLink**: a URL for unsubscribing from a mailing list, found in the `List-Unsubscribe` header or in the email body
- **TimeFilter**: a parameter that limits analysis to emails received within a specific time range
- **SubjectCluster**: a group of emails within a SenderGroup that share the same normalized subject pattern, labeled by category (Promotional, Transactional, Newsletter, or Other)

---

## Requirements

### Requirement 1: Google OAuth 2.0 Authorization

**User Story:** As a User, I want to sign in with my Google account, so that the App can securely access my mailbox.

#### Acceptance Criteria

1. THE App SHALL provide a Google OAuth 2.0 sign-in button on the main page.
2. WHEN the User clicks the sign-in button, THE App SHALL redirect them to the Google authorization page requesting `gmail.readonly` and `gmail.modify` permissions.
3. WHEN Google returns an authorization code, THE App SHALL exchange it for an AccessToken and store it within the Session.
4. IF Google authorization fails, THEN THE App SHALL display an error message and offer a retry option.
5. WHEN the User finishes working, THE App SHALL provide a sign-out option that clears the Session and AccessToken.

---

### Requirement 2: Downloading Email Metadata

**User Story:** As a User, I want the App to download all my emails, so that I can see the full picture of my mailbox.

#### Acceptance Criteria

1. WHEN the User successfully authenticates, THE App SHALL begin downloading MessageMetadata from the Gmail API.
2. THE App SHALL download MessageMetadata for all emails in the Inbox, Sent, and All Mail folders, including the From, Subject, and Date headers.
3. WHILE MessageMetadata download is in progress, THE App SHALL display a progress bar showing the number of emails downloaded.
4. THE App SHALL download MessageMetadata in pages of 500 emails per request to the Gmail API.
5. IF the Gmail API returns an error during download, THEN THE App SHALL retry the request up to 3 times with a 2-second interval before displaying an error message.
6. WHEN the download is complete, THE App SHALL store MessageMetadata in the browser's local cache to avoid re-downloading.

---

### Requirement 3: Grouping and Analysis by Sender

**User Story:** As a User, I want to see emails grouped by sender with the email count from each, so that I can understand who takes up the most space in my mailbox.

#### Acceptance Criteria

1. WHEN MessageMetadata download is complete, THE App SHALL group emails by sender email address into SenderGroups.
2. THE App SHALL display the list of SenderGroups sorted by email count in descending order.
3. THE App SHALL display for each SenderGroup: the sender's email address, sender name, email count, and date of the last email.
4. THE App SHALL provide the ability to sort the SenderGroup list by email count, date of last email, and alphabetically.
5. THE App SHALL provide a search field for filtering SenderGroups by sender email address or name.
6. WHEN the User types in the search field, THE App SHALL update the SenderGroup list in real time with no more than 100ms delay.

---

### Requirement 4: Data Visualization

**User Story:** As a User, I want to see a clear visualization of email distribution, so that I can quickly understand the structure of my mailbox.

#### Acceptance Criteria

1. THE App SHALL display a bar chart of the top-N senders by email count, where N defaults to 20.
2. THE App SHALL provide a control for changing the value of N with the following options: 10, 20, 50, 100, and "All senders".
3. WHEN the User changes the value of N, THE App SHALL update the bar chart and the sender table without reloading the page.
4. THE App SHALL display a table of all SenderGroups containing the columns: sender email address, sender name, email count, and percentage of total.
5. THE App SHALL implement pagination or infinite scroll in the sender table to handle a large number of records.
6. THE App SHALL display the total number of emails in the mailbox and the number of unique senders.
7. WHEN the User hovers over a bar in the chart, THE App SHALL display a tooltip with the sender name, email count, and percentage of total.
8. WHEN the User clicks on a bar in the chart, THE App SHALL scroll the sender table to the corresponding row and highlight it.

---

### Requirement 5: Selecting Emails for Deletion

**User Story:** As a User, I want to select emails or sender groups for deletion, so that I can efficiently clean my mailbox.

#### Acceptance Criteria

1. THE App SHALL provide a checkbox next to each SenderGroup to select all emails from that sender.
2. THE App SHALL provide a "Select all" button to select all SenderGroups in the current filtered list.
3. WHEN the User selects one or more SenderGroups, THE App SHALL display the total number of selected emails in a summary row.
4. THE App SHALL provide the ability to expand a SenderGroup to view individual emails with the option to select each email separately.
5. WHEN the User expands a SenderGroup, THE App SHALL display the list of emails with subject, date, and the ability to select each email.

---

### Requirement 6: Deleting Emails

**User Story:** As a User, I want to delete selected emails, so that I can free up space and organize my mailbox.

#### Acceptance Criteria

1. WHEN the User selects one or more SenderGroups and clicks the "Delete" button, THE App SHALL display a confirmation dialog showing the number of emails to be deleted.
2. WHEN the User confirms deletion, THE App SHALL move the selected emails to the Gmail trash via the Gmail API.
3. THE App SHALL delete emails in batches of 50 emails per request to the Gmail API to comply with API limits.
4. WHILE deletion is in progress, THE App SHALL display a progress bar showing the number of deleted emails.
5. IF the Gmail API returns an error during deletion, THEN THE App SHALL stop the process, display the number of successfully deleted emails, and show an error message.
6. WHEN deletion is complete, THE App SHALL update the SenderGroup list by removing or reducing the email count for the affected senders.

---

### Requirement 7: Creating Gmail Filters

**User Story:** As a User, I want to create Gmail filters for selected senders, so that future emails from them are processed automatically.

#### Acceptance Criteria

1. WHEN the User selects one or more SenderGroups and clicks the "Create filter" button, THE App SHALL display a filter configuration dialog.
2. THE App SHALL provide the following actions to choose from in the filter dialog: "Delete automatically", "Mark as read", "Archive", and "Mark as spam".
3. WHEN the User confirms filter creation, THE App SHALL create a GmailFilter via the Gmail API for each selected sender.
4. IF the Gmail API returns an error during filter creation, THEN THE App SHALL display an error message indicating which senders the filter was not created for.
5. WHEN a filter is successfully created, THE App SHALL display a confirmation with the list of senders for whom filters were created.

---

### Requirement 8: Security and Privacy

**User Story:** As a User, I want to be confident that my data is protected and that the App does not store my emails on third-party servers.

#### Acceptance Criteria

1. THE App SHALL request only the minimum necessary OAuth 2.0 permissions: `gmail.readonly` and `gmail.modify`.
2. THE App SHALL store the AccessToken exclusively in browser memory (sessionStorage) and not transmit it to third-party servers.
3. THE App SHALL store MessageMetadata exclusively in the browser's local cache (localStorage) and not transmit it to third-party servers.
4. WHEN the Session ends or the User signs out, THE App SHALL delete the AccessToken and cached MessageMetadata from browser memory.
5. THE App SHALL make all requests to the Gmail API directly from the user's browser without an intermediate server layer.

---

### Requirement 9: Smart Detection of Unwanted Senders

**User Story:** As a User, I want the App to automatically detect suspected spam senders, so that I can quickly find and delete unwanted emails.

#### Acceptance Criteria

1. WHEN MessageMetadata analysis is complete, THE App SHALL automatically flag a SenderGroup as a SuspectedSpamSender if the subject of at least one email from that sender contains the words: "unsubscribe", "promotion", "newsletter", "offer", or "deal" (case-insensitive).
2. WHEN MessageMetadata analysis is complete, THE App SHALL automatically flag a SenderGroup as a SuspectedSpamSender if 80% or more of emails from that sender are unread.
3. WHEN MessageMetadata analysis is complete, THE App SHALL automatically flag a SenderGroup as a SuspectedSpamSender if the sender has sent 10 or more emails and 70% or more of those email subjects share the same structure (differing only in numbers or dates).
4. THE App SHALL display SuspectedSpamSenders in the SenderGroup list with a visual indicator (label or icon) that distinguishes them from regular senders.
5. THE App SHALL provide a filter to display only SuspectedSpamSenders in the SenderGroup list.
6. WHEN the User hovers over a SuspectedSpamSender indicator, THE App SHALL display a tooltip explaining the reason for the flag.

---

### Requirement 10: Time-Based Filtering

**User Story:** As a User, I want to filter emails by time range and view email activity trends by year, so that I can focus on old or new emails.

#### Acceptance Criteria

1. THE App SHALL provide a TimeFilter to limit analysis to emails older than N months or N years, where N is an integer greater than 0.
2. THE App SHALL provide predefined TimeFilter values: "Older than 6 months", "Older than 1 year", "Older than 2 years", "Older than 5 years", and "All emails".
3. WHEN the User changes the TimeFilter, THE App SHALL update the SenderGroup list, chart, and statistics according to the selected time range without reloading the page.
4. THE App SHALL display a breakdown of email count by year as a separate statistics section for each SenderGroup.
5. WHEN the User expands a SenderGroup, THE App SHALL display the email count from that sender for each calendar year as a separate row.

---

### Requirement 11: Unsubscribing from Mailing Lists

**User Story:** As a User, I want to unsubscribe from unwanted mailing lists with a single click directly from the App, so that I stop receiving new emails from those senders.

#### Acceptance Criteria

1. WHEN the App downloads MessageMetadata, THE App SHALL check for the presence of the `List-Unsubscribe` header in emails of each SenderGroup and store the found UnsubscribeLink.
2. THE App SHALL display an "Unsubscribe" button next to a SenderGroup for which an UnsubscribeLink has been found.
3. WHEN the User clicks the "Unsubscribe" button, THE App SHALL display a confirmation dialog with the sender's address and the UnsubscribeLink URL.
4. WHEN the User confirms the unsubscribe action, THE App SHALL open the UnsubscribeLink in a new browser tab.
5. WHEN the User confirms the unsubscribe action, THE App SHALL mark the SenderGroup as "Unsubscribed" in the list and store this status in the browser's local cache.
6. IF no UnsubscribeLink is found for a SenderGroup, THEN THE App SHALL not display the "Unsubscribe" button for that SenderGroup.

---

### Requirement 12: Exporting the Sender List

**User Story:** As a User, I want to export the sender list to a CSV file, so that I can analyze the data in external tools.

#### Acceptance Criteria

1. THE App SHALL provide an "Export CSV" button to download the SenderGroup list in CSV format.
2. THE App SHALL include the following fields for each SenderGroup in the CSV file: sender email address, sender name, email count, percentage of total, date of first email, date of last email, SuspectedSpamSender flag, and UnsubscribeLink availability flag.
3. THE App SHALL generate the CSV file name in the format `gmail-cleaner-export-YYYY-MM-DD.csv`, where `YYYY-MM-DD` is the current date.
4. WHEN the User applies a TimeFilter or SuspectedSpamSender filter, THE App SHALL export to CSV only the filtered SenderGroups currently displayed in the list.
5. THE App SHALL encode the CSV file in UTF-8 with BOM for correct display in Microsoft Excel.

---

### Requirement 13: Grouping by Domain

**User Story:** As a User, I want to switch between grouping emails by email address and by domain, so that I can see the total volume of emails from organizations rather than just individual addresses.

#### Acceptance Criteria

1. THE App SHALL provide a grouping mode toggle with two values: "By sender" and "By domain".
2. WHEN the User selects "By domain" mode, THE App SHALL merge all SenderGroups with the same domain into a DomainGroup and display the list of DomainGroups instead of the list of SenderGroups.
3. THE App SHALL display for each DomainGroup: the domain, total email count, number of unique senders within the domain, and date of the last email.
4. WHEN the User expands a DomainGroup, THE App SHALL display the list of SenderGroups belonging to that DomainGroup with the email count from each.
5. WHEN the User selects a DomainGroup for deletion or filter creation, THE App SHALL apply the action to all SenderGroups within that DomainGroup.
6. WHEN the User switches between grouping modes, THE App SHALL preserve the current TimeFilter and search query and apply them to the new display mode.

---

### Requirement 14: Subject Clustering within SenderGroups

**User Story:** As a User, I want to see emails from a sender grouped by subject patterns, so that I can identify and delete only the promotional emails while keeping important ones like invoices or order confirmations.

#### Acceptance Criteria

1. WHEN a SenderGroup has 5 or more emails, THE App SHALL analyze subject patterns and group them into SubjectClusters.
2. WHEN a SenderGroup is expanded, THE App SHALL display its SubjectClusters showing the cluster label, email count per cluster, and up to 3 example subjects.
3. THE App SHALL provide a checkbox at the SubjectCluster level so the User can select individual clusters for deletion independently of the parent SenderGroup checkbox.
4. THE App SHALL automatically label each SubjectCluster using pattern detection: subjects matching order/invoice-related keywords receive the "Transactional" label, subjects matching promotional keywords receive the "Promotional" label, subjects matching newsletter patterns receive the "Newsletter" label, and all remaining subjects receive the "Other" label.
5. WHEN the User selects a SubjectCluster, THE App SHALL update the selected email count in the summary bar to reflect only the emails in the selected clusters.
6. THE App SHALL display the SubjectCluster breakdown in the SenderGroup row summary (e.g., "Promotional: 380, Transactional: 120").
