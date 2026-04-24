import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { PreferencesCache, type UserPreferences } from '../cache/PreferencesCache';

interface PreferencesContextValue {
  trustedSenders: Set<string>;
  hiddenSenders: Set<string>;
  trustSender: (email: string) => void;
  untrustSender: (email: string) => void;
  hideSender: (email: string) => void;
  unhideSender: (email: string) => void;
  showHidden: boolean;
  setShowHidden: (show: boolean) => void;
  resetPreferences: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();

  const [prefs, setPrefs] = useState<UserPreferences>({ trustedSenders: [], hiddenSenders: [] });
  const [showHidden, setShowHidden] = useState(false);

  // Load preferences on mount / userId change
  useEffect(() => {
    if (!userId) return;
    setPrefs(PreferencesCache.load(userId));
  }, [userId]);

  const updatePrefs = useCallback((updater: (p: UserPreferences) => UserPreferences) => {
    if (!userId) return;
    setPrefs(prev => {
      const next = updater(prev);
      PreferencesCache.save(userId, next);
      return next;
    });
  }, [userId]);

  const trustSender = useCallback((email: string) => {
    updatePrefs(p => ({
      ...p,
      trustedSenders: p.trustedSenders.includes(email)
        ? p.trustedSenders
        : [...p.trustedSenders, email],
    }));
  }, [updatePrefs]);

  const untrustSender = useCallback((email: string) => {
    updatePrefs(p => ({
      ...p,
      trustedSenders: p.trustedSenders.filter(e => e !== email),
    }));
  }, [updatePrefs]);

  const hideSender = useCallback((email: string) => {
    updatePrefs(p => ({
      ...p,
      hiddenSenders: p.hiddenSenders.includes(email)
        ? p.hiddenSenders
        : [...p.hiddenSenders, email],
    }));
  }, [updatePrefs]);

  const unhideSender = useCallback((email: string) => {
    updatePrefs(p => ({
      ...p,
      hiddenSenders: p.hiddenSenders.filter(e => e !== email),
    }));
  }, [updatePrefs]);

  const resetPreferences = useCallback(() => {
    if (!userId) return;
    PreferencesCache.clear(userId);
    setPrefs({ trustedSenders: [], hiddenSenders: [] });
  }, [userId]);

  const value: PreferencesContextValue = {
    trustedSenders: new Set(prefs.trustedSenders),
    hiddenSenders: new Set(prefs.hiddenSenders),
    trustSender,
    untrustSender,
    hideSender,
    unhideSender,
    showHidden,
    setShowHidden,
    resetPreferences,
  };

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
