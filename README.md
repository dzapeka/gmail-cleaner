# Gmail Cleaner

A client-side web app to analyze, visualize, and clean your Gmail inbox. Groups emails by sender, detects spam, supports unsubscribing, bulk deletion, and Gmail filter creation.

All Gmail data stays in your browser — no third-party storage. A small local auth proxy server handles the OAuth token exchange to keep your `client_secret` out of the browser.

## Features

- Groups emails by sender or domain with email counts
- Bar chart visualization (top N senders, configurable)
- Smart spam detection (keywords, unread ratio, repetitive subjects)
- Subject clustering (Promotional / Transactional / Newsletter / Other)
- One-click unsubscribe via `List-Unsubscribe` header
- Bulk delete emails (moves to trash)
- Create Gmail filters for selected senders
- Export sender list to CSV
- Sync range selector (last week / month / 6 months / year / all mail)
- Merge or Replace sync modes
- Time-based display filter with grouped options (newer than / older than)
- Filtered stats bar showing "X of Y emails" with one-click clear
- **Trusted senders** — mark senders as trusted to suppress spam detection
- **Hidden senders** — hide senders from the list; preferences persist across sessions

---

## Google Cloud Setup

### 1. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **Select a project** → **New Project**
3. Give it a name (e.g. `gmail-cleaner`) and click **Create**

### 2. Enable Gmail API

1. Go to **APIs & Services → Library**
2. Search for **Gmail API** and click **Enable**

### 3. Configure OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**
2. Select **External** and click **Create**
3. Fill in:
   - App name: `My Gmail Cleaner App` (or any name)
   - User support email: your Gmail address
   - Developer contact email: your Gmail address
4. Click **Save and Continue** through the remaining steps
5. On the **Test users** step — click **+ Add users** and add your Gmail address
6. Click **Save and Continue**

### 4. Create OAuth 2.0 credentials

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Name: anything (e.g. `gmail-cleaner-local`)
5. Under **Authorized redirect URIs** click **+ Add URI** and enter:
   ```
   http://localhost:5173
   ```
6. Click **Create**
7. Copy the **Client ID** and **Client Secret**

---

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env` file

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```env
# Shared (used by both browser and server)
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_REDIRECT_URI=http://localhost:5173

# Browser only
VITE_AUTH_SERVER_URL=http://localhost:3001

# Server only (never sent to browser)
GOOGLE_CLIENT_SECRET=your-client-secret
```

### 3. Run the app

The app requires two processes running simultaneously. Open **two terminals**:

**Terminal 1 — auth proxy server:**
```bash
npm run server
```

**Terminal 2 — Vite dev server:**
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

> The auth proxy runs on `http://localhost:3001` and handles OAuth token exchange server-side so that `client_secret` is never exposed in the browser.

---

## Usage

1. Click **Sign in with Google** and authorize the app
2. Select a sync range (All mail / Last week / Last month / etc.) and click **Start sync**
   - **Merge** — adds new emails to existing cache (default, fast)
   - **Replace** — replaces cache with selected range only (requires confirmation)
3. Once synced, you'll see a bar chart and sender table
4. Use filters to find unwanted senders:
   - **Time filter** — grouped dropdown with "Newer than" and "Older than" options
   - **Show spam only** — auto-detected spam senders
   - **Search** — filter by sender name or email
   - **By domain** — group senders by domain instead of individual address
   - Stats bar shows `X of Y emails · A of B senders` when filters are active, with a **× Clear filters** button
5. Select senders using checkboxes
6. Manage individual senders with per-row actions:
   - **Trust** — marks sender as trusted, suppresses spam detection for them
   - **Hide** — hides sender from the list (shown in stats bar, toggle to reveal)
7. Choose a bulk action:
   - **Delete** — moves selected emails to trash
   - **Create filter** — sets up a Gmail rule for future emails
   - **Unsubscribe** — opens the unsubscribe link in a new tab
8. Use **Export CSV** to download the current filtered sender list

> Trusted and hidden sender preferences are saved in `localStorage` and **persist across sessions** — they are not cleared on sign-out.

---

## Security

- `client_secret` is stored only in `.env` on your machine and handled by the local auth proxy — it never reaches the browser
- Access tokens are stored in `sessionStorage` (cleared when the tab is closed)
- All Gmail API calls go directly from your browser to Google — no proxy involved
- Email data (metadata only) is cached in `localStorage` and never sent anywhere

## Notes

- The app only downloads email **metadata** (From, Subject, Date) — never the full email body
- Data is cached in browser `localStorage` under the key `gmail-cleaner-cache-<userId>` and persists between sessions until you sign out or clear the browser storage
- Trusted and hidden sender preferences are stored under `gmail-cleaner-preferences-<userId>` and are **not** cleared on sign-out
- Sync does **not** start automatically on login — select a range and click **Start sync**
- **Merge sync** adds new emails to the existing cache; **Replace sync** fully replaces it
- **Re-sync** fetches fresh data from Gmail — deleted emails will be removed from the cache
- Gmail API is **free** — no charges for personal use
- The app works in **Testing mode** — only accounts added as Test Users can sign in

## Development

```bash
npm run test      # run tests once
npm run build     # production build
```
