import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Allow requests from the Vite dev server
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
const REDIRECT_URI = process.env.REDIRECT_URI ?? 'http://localhost:5173';

// POST /auth/token — exchange authorization code for tokens
app.post('/auth/token', async (req, res) => {
  const { code, code_verifier } = req.body as { code?: string; code_verifier?: string };

  if (!code || !code_verifier) {
    res.status(400).json({ error: 'Missing code or code_verifier' });
    return;
  }

  try {
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

    const data = await response.json();

    if (!response.ok) {
      res.status(response.status).json(data);
      return;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

// POST /auth/refresh — refresh access token
app.post('/auth/refresh', async (req, res) => {
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

    const data = await response.json();

    if (!response.ok) {
      res.status(response.status).json(data);
      return;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Auth proxy server running on http://localhost:${PORT}`);
});
