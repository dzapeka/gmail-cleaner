// Stores user preferences (trusted/hidden senders) in localStorage.
// Intentionally NOT cleared on sign-out — preferences persist across sessions.
// Key is scoped to userId so multiple accounts don't share preferences.

const KEY_PREFIX = 'gmail-cleaner-preferences-';

export interface UserPreferences {
  trustedSenders: string[];  // emails that should never be flagged as spam
  hiddenSenders: string[];   // emails hidden from the sender table
}

const DEFAULT_PREFS: UserPreferences = {
  trustedSenders: [],
  hiddenSenders: [],
};

export const PreferencesCache = {
  load(userId: string): UserPreferences {
    try {
      const raw = localStorage.getItem(`${KEY_PREFIX}${userId}`);
      if (!raw) return { ...DEFAULT_PREFS };
      return JSON.parse(raw) as UserPreferences;
    } catch {
      return { ...DEFAULT_PREFS };
    }
  },

  save(userId: string, prefs: UserPreferences): void {
    try {
      localStorage.setItem(`${KEY_PREFIX}${userId}`, JSON.stringify(prefs));
    } catch {
      console.warn('PreferencesCache: failed to save preferences');
    }
  },

  addTrusted(userId: string, email: string): void {
    const prefs = PreferencesCache.load(userId);
    if (!prefs.trustedSenders.includes(email)) {
      prefs.trustedSenders.push(email);
      PreferencesCache.save(userId, prefs);
    }
  },

  removeTrusted(userId: string, email: string): void {
    const prefs = PreferencesCache.load(userId);
    prefs.trustedSenders = prefs.trustedSenders.filter(e => e !== email);
    PreferencesCache.save(userId, prefs);
  },

  addHidden(userId: string, email: string): void {
    const prefs = PreferencesCache.load(userId);
    if (!prefs.hiddenSenders.includes(email)) {
      prefs.hiddenSenders.push(email);
      PreferencesCache.save(userId, prefs);
    }
  },

  removeHidden(userId: string, email: string): void {
    const prefs = PreferencesCache.load(userId);
    prefs.hiddenSenders = prefs.hiddenSenders.filter(e => e !== email);
    PreferencesCache.save(userId, prefs);
  },

  clear(userId: string): void {
    localStorage.removeItem(`${KEY_PREFIX}${userId}`);
  },
};
