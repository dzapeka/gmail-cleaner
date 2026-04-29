import 'dotenv/config';
import express from 'express';
import cors from 'cors';

console.log('[server] Starting...');
console.log('[server] NODE_VERSION:', process.version);
console.log('[server] CWD:', process.cwd());
console.log('[server] ENV CHECK - CLIENT_ID:', process.env.VITE_GOOGLE_CLIENT_ID ? 'SET' : 'MISSING');
console.log('[server] ENV CHECK - CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'MISSING');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(cors({ origin: process.env.VITE_REDIRECT_URI ?? 'http://localhost:5173' }));

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
const REDIRECT_URI = process.env.VITE_REDIRECT_URI ?? 'http://localhost:5173';

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /auth/token — exchange authorization code for tokens
app.post('/auth/token', async (req, res) => {
  console.log('[/auth/token] Request received');
  const { code, code_verifier } = req.body as { code?: string; code_verifier?: string };

  if (!code || !code_verifier) {
    console.log('[/auth/token] Missing code or code_verifier');
    res.status(400).json({ error: 'Missing code or code_verifier' });
    return;
  }

  try {
    console.log('[/auth/token] Calling Google token endpoint...');
    const params = new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code_verifier,
      grant_type: 'authorization_code',
    });

    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    console.log('[/auth/token] Google response status:', response.status);
    const data = await response.json();

    if (!response.ok) {
      console.log('[/auth/token] Google error:', JSON.stringify(data));
      res.status(response.status).json(data);
      return;
    }

    console.log('[/auth/token] Success');
    res.json(data);
  } catch (err) {
    console.error('[/auth/token] Exception:', err);
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

// POST /auth/refresh — refresh access token
app.post('/auth/refresh', async (req, res) => {
  console.log('[/auth/refresh] Request received');
  const { refresh_token } = req.body as { refresh_token?: string };

  if (!refresh_token) {
    res.status(400).json({ error: 'Missing refresh_token' });
    return;
  }

  try {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token,
      grant_type: 'refresh_token',
    });

    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    console.log('[/auth/refresh] Google response status:', response.status);
    const data = await response.json();

    if (!response.ok) {
      console.log('[/auth/refresh] Google error:', JSON.stringify(data));
      res.status(response.status).json(data);
      return;
    }

    res.json(data);
  } catch (err) {
    console.error('[/auth/refresh] Exception:', err);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Handle uncaught errors to prevent silent exit
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled rejection:', reason);
});

process.on('exit', (code) => {
  console.log('[server] Process exiting with code:', code);
});

process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received');
});

process.on('SIGINT', () => {
  console.log('[server] SIGINT received');
  process.exit(0);
});

const PORT = process.env.PORT ?? 5174;
const server = app.listen(PORT, () => {
  console.log(`[server] Auth proxy server running on http://localhost:${PORT}`);
  console.log('[server] Server is ready to accept connections');
});

server.on('error', (err) => {
  console.error('[server] Server error:', err);
});

console.log('[server] app.listen() called, waiting for connections...');
