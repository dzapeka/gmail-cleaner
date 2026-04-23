/**
 * Security guarantees for token handling:
 *
 * - AccessToken is stored exclusively in sessionStorage, which is scoped to the
 *   current browser tab and cleared automatically when the tab is closed.
 *   It is never written to localStorage, cookies, or any server-side storage.
 *
 * - No token is ever transmitted to third-party servers. The only endpoints
 *   that receive credentials are Google's own OAuth2 token endpoint
 *   (https://oauth2.googleapis.com/token) and the Gmail REST API.
 *
 * - All Gmail API calls are made directly from the user's browser to
 *   https://www.googleapis.com/gmail/v1/. No proxy server or backend
 *   intermediary is involved in these requests.
 */

const AUTH_STORAGE_KEY = 'gmail-cleaner-auth';
const PKCE_VERIFIER_KEY = 'gmail-cleaner-pkce-verifier';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GMAIL_SCOPES =
  'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify';

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

/** Exchanges authorization code for tokens and stores them in sessionStorage */
export async function exchangeCodeForTokens(code: string, verifier: string): Promise<void> {
  const params = new URLSearchParams({
    code,
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID as string,
    redirect_uri: import.meta.env.VITE_REDIRECT_URI as string,
    code_verifier: verifier,
    grant_type: 'authorization_code',
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
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
    userId: '', // populated later from userinfo
  };

  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

/** Reads refresh_token from sessionStorage, refreshes access token, updates storage, returns new token */
export async function refreshAccessToken(): Promise<string> {
  const auth = getStoredAuth();
  if (!auth) {
    throw new Error('No stored auth to refresh');
  }

  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID as string,
    refresh_token: auth.refresh_token,
    grant_type: 'refresh_token',
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
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
