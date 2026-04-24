/**
 * Security guarantees for token handling:
 *
 * - AccessToken is stored exclusively in sessionStorage, which is scoped to the
 *   current browser tab and cleared automatically when the tab is closed.
 *
 * - client_secret is stored only on the auth proxy server (server/index.ts) and
 *   never sent to the browser. The browser only sends code + code_verifier to
 *   the proxy, which adds the secret server-side before calling Google.
 *
 * - All Gmail API calls are made directly from the user's browser to
 *   https://www.googleapis.com/gmail/v1/. No proxy is involved in those requests.
 */

const AUTH_STORAGE_KEY = 'gmail-cleaner-auth';
const PKCE_VERIFIER_KEY = 'gmail-cleaner-pkce-verifier';
const AUTH_SERVER_URL = (import.meta.env.VITE_AUTH_SERVER_URL as string) ?? 'http://localhost:3001';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GMAIL_SCOPES =
  'openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify';

export interface StoredAuth {
  access_token: string;
  refresh_token: string;
  expiry: number;
  userId: string;
}

/** Generates a 64-byte random base64url string using crypto.getRandomValues */
export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}

/** SHA-256 hash of verifier, base64url encoded using Web Crypto API */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64urlEncode(new Uint8Array(digest));
}

/** Builds Google OAuth2 authorization URL with PKCE params */
export function buildAuthUrl(challenge: string): string {
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID as string,
    redirect_uri: import.meta.env.VITE_REDIRECT_URI as string,
    response_type: 'code',
    scope: GMAIL_SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

/** Exchanges authorization code for tokens via auth proxy server (client_secret stays server-side) */
export async function exchangeCodeForTokens(code: string, verifier: string): Promise<void> {
  const response = await fetch(`${AUTH_SERVER_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: verifier }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const auth: StoredAuth = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry: Date.now() + data.expires_in * 1000,
    userId: '',
  };

  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

/** Refreshes access token via auth proxy server */
export async function refreshAccessToken(): Promise<string> {
  const auth = getStoredAuth();
  if (!auth) throw new Error('No stored auth to refresh');

  const response = await fetch(`${AUTH_SERVER_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: auth.refresh_token }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  const updated: StoredAuth = {
    ...auth,
    access_token: data.access_token,
    expiry: Date.now() + data.expires_in * 1000,
  };

  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
  return data.access_token;
}

/** Reads and parses auth from sessionStorage */
export function getStoredAuth(): StoredAuth | null {
  const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

/** Removes auth from sessionStorage */
export function clearStoredAuth(): void {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

/** Returns true if token expires within 60 seconds */
export function isTokenExpiringSoon(): boolean {
  const auth = getStoredAuth();
  if (!auth) return true;
  return auth.expiry - Date.now() < 60_000;
}

/** Stores the PKCE verifier in sessionStorage */
export function storePkceVerifier(verifier: string): void {
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
}

/** Reads the PKCE verifier from sessionStorage */
export function getPkceVerifier(): string | null {
  return sessionStorage.getItem(PKCE_VERIFIER_KEY);
}

/** Removes the PKCE verifier from sessionStorage */
export function clearPkceVerifier(): void {
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
}

// --- Internal helpers ---

function base64urlEncode(bytes: Uint8Array): string {
  let str = '';
  for (const byte of bytes) {
    str += String.fromCharCode(byte);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
