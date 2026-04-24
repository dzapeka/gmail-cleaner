import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { GmailApiClient } from '../api/gmailClient';
import { refreshAccessToken, getStoredAuth } from '../api/auth';
import { MetadataCache } from '../cache/MetadataCache';
import type { MessageMetadata, CachedSession } from '../types/index';

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const BATCH_SIZE = 100;

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

interface DataContextValue {
  messages: MessageMetadata[];
  syncStatus: SyncStatus;
  syncProgress: { downloaded: number; total: number };
  lastSyncedAt: string | null;
  cacheWarning: boolean;
  startSync: () => Promise<void>;
  stopSync: () => void;
  clearCache: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, accessToken, userId, userEmail } = useAuth();

  const [messages, setMessages] = useState<MessageMetadata[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncProgress, setSyncProgress] = useState({ downloaded: 0, total: 0 });
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [cacheWarning, setCacheWarning] = useState(false);

  // Cancellation flag — set to true to abort an in-progress sync
  const cancelledRef = useRef(false);

  // On mount / auth change: try to load from cache only (no auto-sync)
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const cached = MetadataCache.load(userId);
    if (!cached) return;

    setMessages(cached.messages);
    setLastSyncedAt(cached.cachedAt);
    setSyncStatus('done');
  }, [isAuthenticated, userId]);

  const stopSync = useCallback(() => {
    cancelledRef.current = true;
    setSyncStatus('idle');
  }, []);

  const startSync = useCallback(async () => {
    if (!userId) return;

    cancelledRef.current = false;
    setSyncStatus('syncing');
    setSyncProgress({ downloaded: 0, total: 0 });
    setCacheWarning(false);

    try {
      const client = new GmailApiClient(async () => {
        const stored = getStoredAuth();
        if (!stored) throw new Error('Not authenticated');
        if (stored.expiry - Date.now() < 60_000) {
          return refreshAccessToken();
        }
        return stored.access_token;
      });

      // Collect all message IDs from INBOX
      const allIds: string[] = [];
      let pageToken: string | undefined;

      do {
        if (cancelledRef.current) return;
        const result = await client.listMessageIds({ labelIds: ['INBOX'], pageToken });
        allIds.push(...result.messageIds);
        pageToken = result.nextPageToken;
      } while (pageToken);

      setSyncProgress({ downloaded: 0, total: allIds.length });

      const uniqueIds = [...new Set(allIds)];
      const fetched: MessageMetadata[] = [];

      for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
        if (cancelledRef.current) return;
        const chunk = uniqueIds.slice(i, i + BATCH_SIZE);
        const batch = await client.batchGetMetadata(chunk);
        fetched.push(...batch);
        setSyncProgress({ downloaded: fetched.length, total: uniqueIds.length });
      }

      if (cancelledRef.current) return;

      // Deduplicate by id
      const seen = new Set<string>();
      const deduped = fetched.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });

      const now = new Date().toISOString();
      const session: CachedSession = {
        userId,
        email: userEmail ?? '',
        cachedAt: now,
        messages: deduped,
        unsubscribedSenders: MetadataCache.getUnsubscribed(),
      };

      const saved = MetadataCache.save(userId, session);
      if (!saved) setCacheWarning(true);

      setMessages(deduped);
      setLastSyncedAt(now);
      setSyncStatus('done');
    } catch (err) {
      if (cancelledRef.current) return;
      console.error('Sync failed:', err);
      setSyncStatus('error');
    }
  }, [userId, userEmail]);

  const clearCache = useCallback(() => {
    if (!userId) return;
    MetadataCache.clear(userId);
    setMessages([]);
    setLastSyncedAt(null);
    setSyncStatus('idle');
  }, [userId]);

  const value: DataContextValue = {
    messages,
    syncStatus,
    syncProgress,
    lastSyncedAt,
    cacheWarning,
    startSync,
    stopSync,
    clearCache,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
