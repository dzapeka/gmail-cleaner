import type { CachedSession } from '../types/index';

const CACHE_KEY_PREFIX = 'gmail-cleaner-cache-';
const UNSUBSCRIBED_KEY = 'gmail-cleaner-unsubscribed';

export const MetadataCache = {
  /** Reads and parses the cached session for a given userId. Returns null on any error. */
  load(userId: string): CachedSession | null {
    try {
      const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${userId}`);
      if (!raw) return null;
      return JSON.parse(raw) as CachedSession;
    } catch {
      return null;
    }
  },

  /**
   * Serializes and writes the session to localStorage.
   * Returns false if a QuotaExceededError is encountered, true on success.
   */
  save(userId: string, session: CachedSession): boolean {
    try {
      localStorage.setItem(`${CACHE_KEY_PREFIX}${userId}`, JSON.stringify(session));
      return true;
    } catch (err) {
      if (
        err instanceof DOMException &&
        (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
      ) {
        console.warn('MetadataCache: localStorage quota exceeded, cache not saved.');
        return false;
      }
      throw err;
    }
  },

  /** Removes the cached session for a given userId from localStorage. */
  clear(userId: string): void {
    localStorage.removeItem(`${CACHE_KEY_PREFIX}${userId}`);
  },

  /** Returns the list of unsubscribed sender emails, or [] if not set / on error. */
  getUnsubscribed(): string[] {
    try {
      const raw = localStorage.getItem(UNSUBSCRIBED_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  },

  /** Adds an email to the unsubscribed list if not already present. */
  addUnsubscribed(email: string): void {
    const current = MetadataCache.getUnsubscribed();
    if (current.includes(email)) return;
    current.push(email);
    localStorage.setItem(UNSUBSCRIBED_KEY, JSON.stringify(current));
  },
};
