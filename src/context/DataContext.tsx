import {
  createContext,
  useContext,
  useEffect,
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

  // On mount / auth change: try to load from cache
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const cached = MetadataCache.load(userId);
    if (!cached) return;

    const ageMs = Date.now() - new Date(cached.cachedAt).getTime();
    setMessages(cached.messages);
    setLastSyncedAt(cached.cachedAt);

    if (ageMs < CACHE_MAX_AGE_MS) {
      setSyncStatus('done');
    } else {
      // Cache is stale — load it but leave status as 'idle' to prompt re-sync
      setSyncStatus('idle');
    }
  }, [isAuthenticated, userId]);

  const startSync = useCallback(async () => {
    if (!userId) return;

    setSyncStatus('syncing');
    setSyncProgress({ downloaded: 0, total: 0 });
    setCacheWarning(false);

    try {
      const client = new GmailApiClient(async () => {
        const stored = getStoredAuth();
        if (!stored) throw new Error('Not authenticated');
        // Refresh if expiring soon (handled inside GmailApiClient too, but be explicit)
        if (stored.expiry - Date.now() < 60_000) {
          return refreshAccessToken();
        }
        return stored.access_token;
      });

      // Collect all message IDs from INBOX
      const allIds: string[] = [];
      let pageToken: string | undefined;

      do {
        const result = await client.listMessageIds({
          labelIds: ['INBOX'],
          pageToken,
        });
        allIds.push(...result.messageIds);
        pageToken = result.nextPageToken;
      } while (pageToken);

      setSyncProgress({ downloaded: 0, total: allIds.length });

      // Deduplicate IDs before fetching
      const uniqueIds = [...new Set(allIds)];

      // Batch-fetch metadata in chunks of BATCH_SIZE
      const fetched: MessageMetadata[] = [];
      for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
        const chunk = uniqueIds.slice(i, i + BATCH_SIZE);
        const batch = await client.batchGetMetadata(chunk);
        fetched.push(...batch);
        setSyncProgress({ downloaded: fetched.length, total: uniqueIds.length });
      }

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

  // Auto-start sync when authenticated and no cache exists
  useEffect(() => {
    if (isAuthenticated && userId && syncStatus === 'idle' && messages.length === 0) {
      void startSync();
    }
  }, [isAuthenticated, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const value: DataContextValue = {
    messages,
    syncStatus,
    syncProgress,
    lastSyncedAt,
    cacheWarning,
    startSync,
    clearCache,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
