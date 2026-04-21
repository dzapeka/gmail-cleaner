import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  buildAuthUrl,
  clearStoredAuth,
  exchangeCodeForTokens,
  generateCodeChallenge,
  generateCodeVerifier,
  getStoredAuth,
  getPkceVerifier,
  storePkceVerifier,
  clearPkceVerifier,
  type StoredAuth,
} from '../api/auth';

const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';
const UNSUBSCRIBED_KEY = 'gmail-cleaner-unsubscribed';

interface AuthContextValue {
  isAuthenticated: boolean;
  accessToken: string | null;
  userId: string | null;
  userEmail: string | null;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(() => getStoredAuth());
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle OAuth callback on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const oauthError = params.get('error');

    if (oauthError) {
      setError('Authorization failed. Please try again.');
      history.replaceState(null, '', window.location.pathname);
      return;
    }

    if (!code) return;

    const verifier = getPkceVerifier();
    if (!verifier) {
      setError('Authorization failed. Please try again.');
      history.replaceState(null, '', window.location.pathname);
      return;
    }

    // Exchange code for tokens, then fetch user info
    (async () => {
      try {
        await exchangeCodeForTokens(code, verifier);
        clearPkceVerifier();

        const stored = getStoredAuth();
        if (!stored) throw new Error('No auth after token exchange');

        // Fetch user info to get email and id
        const userInfoRes = await fetch(USERINFO_ENDPOINT, {
          headers: { Authorization: `Bearer ${stored.access_token}` },
        });
        if (!userInfoRes.ok) throw new Error('Failed to fetch user info');

        const userInfo = (await userInfoRes.json()) as { id: string; email: string };

        // Update stored auth with userId
        const updated: StoredAuth = { ...stored, userId: userInfo.id };
        sessionStorage.setItem('gmail-cleaner-auth', JSON.stringify(updated));

        setAuth(updated);
        setUserEmail(userInfo.email);
        history.replaceState(null, '', window.location.pathname);
      } catch (err) {
        setError('Authorization failed. Please try again.');
        clearStoredAuth();
        clearPkceVerifier();
        history.replaceState(null, '', window.location.pathname);
      }
    })();
  }, []);

  // If we already have stored auth (e.g. page refresh within same session), fetch user email
  useEffect(() => {
    if (!auth || userEmail) return;
    (async () => {
      try {
        const res = await fetch(USERINFO_ENDPOINT, {
          headers: { Authorization: `Bearer ${auth.access_token}` },
        });
        if (!res.ok) return;
        const info = (await res.json()) as { id: string; email: string };
        setUserEmail(info.email);
      } catch {
        // silently ignore — token may be expired, will be refreshed on next API call
      }
    })();
  }, [auth, userEmail]);

  const signIn = useCallback(async () => {
    setError(null);
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    storePkceVerifier(verifier);
    window.location.href = buildAuthUrl(challenge);
  }, []);

  const signOut = useCallback(() => {
    clearStoredAuth();
    clearPkceVerifier();
    sessionStorage.removeItem(UNSUBSCRIBED_KEY);

    // Remove all gmail-cleaner-cache-* keys from localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('gmail-cleaner-cache-')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));

    setAuth(null);
    setUserEmail(null);
  }, []);

  const value: AuthContextValue = {
    isAuthenticated: auth !== null,
    accessToken: auth?.access_token ?? null,
    userId: auth?.userId ?? null,
    userEmail,
    error,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
