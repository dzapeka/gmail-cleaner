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

const BATCH_SIZE = 100;

export type SyncMode = 'replace' | 'merge';

export interface SyncRange {
  label: string;
  // undefined = all mail, otherwise number of days back
  days?: number;
}

export const SYNC_RANGES: SyncRange[] = [
  { label: 'All mail' },
  { label: 'Last week', days: 7 },
  { label: 'Last month', days: 30 },
  { label: 'Last 6 months', days: 180 },
  { label: 'Last year', days: 365 },
  { label: 'Last 2 years', days: 730 },
  { label: 'Last 5 years', days: 1825 },
];

export interface SyncOptions {
  range: SyncRange;
  mode: SyncMode;
}

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

interface SyncResult {
  added: number;
  total: number;
}

interface DataContextValue {
  messages: MessageMetadata[];
  syncStatus: SyncStatus;
  syncProgress: { downloaded: number; total: number };
  lastSyncedAt: string | null;
  lastSyncResult: SyncResult | null;
  cacheWarning: boolean;
  startSync: (options: SyncOptions) => Promise<void>;
  stopSync: () => void;
  clearCache: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, userId, userEmail } = useAuth();

  const [messages, setMessages] = useState<MessageMetadata[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncProgress, setSyncProgress] = useState({ downloaded: 0, total: 0 });
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [cacheWarning, setCacheWarning] = useState(false);

  const cancelledRef = useRef(false);

  // On mount: load from cache
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

  const startSync = useCallback(async (options: SyncOptions) => {
    if (!userId) return;

    cancelledRef.current = false;
    setSyncStatus('syncing');
    setSyncProgress({ downloaded: 0, total: 0 });
    setCacheWarning(false);
    setLastSyncResult(null);

    try {
      const client = new GmailApiClient(async () => {
        const stored = getStoredAuth();
        if (!stored) throw new Error('Not authenticated');
        if (stored.expiry - Date.now() < 60_000) return refreshAccessToken();
        return stored.access_token;
      });

      // Build Gmail query for date range
      let query: string | undefined;
      if (options.range.days !== undefined) {
        const after = new Date();
        after.setDate(after.getDate() - options.range.days);
        // Gmail query format: after:YYYY/MM/DD
        const y = after.getFullYear();
        const m = String(after.getMonth() + 1).padStart(2, '0');
        const d = String(after.getDate()).padStart(2, '0');
        query = `after:${y}/${m}/${d}`;
      }

      // Collect all message IDs
      const allIds: string[] = [];
      let pageToken: string | undefined;

      do {
        if (cancelledRef.current) return;
        const result = await client.listMessageIds({
          labelIds: ['INBOX'],
          pageToken,
          query,
        });
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

      // Merge or replace
      let finalMessages: MessageMetadata[];
      let addedCount: number;

      if (options.mode === 'merge') {
        // Load existing cache and merge — new messages override old ones with same id
        const cached = MetadataCache.load(userId);
        const existingMap = new Map<string, MessageMetadata>();
        for (const m of cached?.messages ?? []) existingMap.set(m.id, m);
        for (const m of fetched) existingMap.set(m.id, m);
        finalMessages = Array.from(existingMap.values());
        addedCount = fetched.filter(m => !cached?.messages.some(e => e.id === m.id)).length;
      } else {
        // Replace — deduplicate fetched only
        const seen = new Set<string>();
        finalMessages = fetched.filter(m => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        addedCount = finalMessages.length;
      }

      const now = new Date().toISOString();
      const session: CachedSession = {
        userId,
        email: userEmail ?? '',
        cachedAt: now,
        messages: finalMessages,
        unsubscribedSenders: MetadataCache.getUnsubscribed(),
      };

      const saved = MetadataCache.save(userId, session);
      if (!saved) setCacheWarning(true);

      setMessages(finalMessages);
      setLastSyncedAt(now);
      setLastSyncResult({ added: addedCount, total: finalMessages.length });
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
    setLastSyncResult(null);
  }, [userId]);

  const value: DataContextValue = {
    messages,
    syncStatus,
    syncProgress,
    lastSyncedAt,
    lastSyncResult,
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
