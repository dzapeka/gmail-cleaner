# Gmail Cleaner

A client-side web app to analyze, visualize, and clean your Gmail inbox. Groups emails by sender, detects spam, supports unsubscribing, bulk deletion, and Gmail filter creation.

All data stays in your browser — no backend server, no third-party storage.

## Features

- Groups emails by sender or domain with email counts
- Bar chart visualization (top N senders)
- Smart spam detection (keywords, unread ratio, repetitive subjects)
- Subject clustering (Promotional / Transactional / Newsletter / Other)
- One-click unsubscribe via `List-Unsubscribe` header
- Bulk delete emails (moves to trash)
- Create Gmail filters for selected senders
- Export sender list to CSV
- Time-based filtering (older than 6 months / 1 year / 2 years / 5 years)

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
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=your-client-secret
VITE_REDIRECT_URI=http://localhost:5173
```

### 3. Run the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Usage

1. Click **Sign in with Google** and authorize the app
2. The app will start syncing your inbox (may take a few minutes for large mailboxes)
3. Once synced, you'll see a bar chart and sender table
4. Use filters to find unwanted senders:
   - Toggle **Show spam only** to see auto-detected spam
   - Use **Time filter** to focus on old emails
   - Search by sender name or email
5. Select senders using checkboxes
6. Choose an action:
   - **Delete** — moves selected emails to trash
   - **Create filter** — sets up a Gmail rule for future emails
   - **Unsubscribe** — opens the unsubscribe link in a new tab
7. Use **Export CSV** to download the full sender list

---

## Notes

- The app only downloads email **metadata** (From, Subject, Date) — never the full email body
- Data is cached in `localStorage` for 24 hours to avoid re-downloading
- Gmail API is **free** — no charges for personal use
- The app works in **Testing mode** — only accounts added as Test Users can sign in

## Development

```bash
npm run test      # run tests once
npm run build     # production build
```
