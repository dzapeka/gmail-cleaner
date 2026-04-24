import { useState } from 'react';
import { useData, SYNC_RANGES, type SyncRange, type SyncMode } from '../context/DataContext';

function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
}

// Confirmation dialog for Replace mode
interface ReplaceConfirmProps {
  range: SyncRange;
  cachedCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function ReplaceConfirmDialog({ range, cachedCount, onConfirm, onCancel }: ReplaceConfirmProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 8, padding: 24,
        maxWidth: 420, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
      }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Replace cached data?</h3>
        <p style={{ margin: '0 0 8px', color: '#444', fontSize: 14 }}>
          This will sync <strong>{range.label.toLowerCase()}</strong> and replace your current cache
          {cachedCount > 0 ? ` (${cachedCount.toLocaleString()} emails)` : ''}.
        </p>
        <p style={{ margin: '0 0 20px', color: '#888', fontSize: 13 }}>
          Emails outside this range will be removed from the local cache.
          Use <strong>Merge</strong> to keep existing data.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '7px 16px', border: '1px solid #ccc', borderRadius: 4,
            background: '#fff', cursor: 'pointer', fontSize: 13,
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            padding: '7px 16px', background: '#d93025', color: '#fff',
            border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 500,
          }}>Replace & Sync</button>
        </div>
      </div>
    </div>
  );
}

export function SyncPanel() {
  const { syncStatus, syncProgress, lastSyncedAt, lastSyncResult, cacheWarning, messages, startSync, stopSync } = useData();

  const [selectedRange, setSelectedRange] = useState<SyncRange>(SYNC_RANGES[0]);
  const [selectedMode, setSelectedMode] = useState<SyncMode>('merge');
  const [showConfirm, setShowConfirm] = useState(false);

  const isSyncing = syncStatus === 'syncing';
  const percentage = syncProgress.total > 0
    ? Math.round((syncProgress.downloaded / syncProgress.total) * 100)
    : 0;

  function handleSyncClick() {
    if (selectedMode === 'replace' && messages.length > 0) {
      setShowConfirm(true);
    } else {
      void startSync({ range: selectedRange, mode: selectedMode });
    }
  }

  function handleConfirmReplace() {
    setShowConfirm(false);
    void startSync({ range: selectedRange, mode: 'replace' });
  }

  return (
    <>
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid #e0e0e0',
        background: '#fafafa', display: 'flex', flexWrap: 'wrap',
        alignItems: 'center', gap: '10px',
      }}>

        {/* Range selector */}
        <select
          value={selectedRange.label}
          onChange={e => setSelectedRange(SYNC_RANGES.find(r => r.label === e.target.value) ?? SYNC_RANGES[0])}
          disabled={isSyncing}
          style={{
            padding: '5px 8px', border: '1px solid #dadce0', borderRadius: 4,
            fontSize: 13, background: '#fff', cursor: isSyncing ? 'not-allowed' : 'pointer',
          }}
          aria-label="Sync range"
        >
          {SYNC_RANGES.map(r => (
            <option key={r.label} value={r.label}>{r.label}</option>
          ))}
        </select>

        {/* Mode toggle */}
        <div style={{ display: 'flex', border: '1px solid #dadce0', borderRadius: 4, overflow: 'hidden' }}>
          {(['merge', 'replace'] as SyncMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setSelectedMode(mode)}
              disabled={isSyncing}
              title={mode === 'merge'
                ? 'Add new emails to existing cache'
                : 'Replace cache with selected range only'}
              style={{
                padding: '5px 12px', border: 'none', fontSize: 13,
                cursor: isSyncing ? 'not-allowed' : 'pointer',
                background: selectedMode === mode ? '#1a73e8' : '#fff',
                color: selectedMode === mode ? '#fff' : '#333',
                fontWeight: selectedMode === mode ? 500 : 400,
                borderRight: mode === 'merge' ? '1px solid #dadce0' : 'none',
              }}
            >
              {mode === 'merge' ? 'Merge' : 'Replace'}
            </button>
          ))}
        </div>

        {/* Start / Stop button */}
        {isSyncing ? (
          <button onClick={stopSync} style={{
            padding: '5px 14px', background: '#d93025', color: '#fff',
            border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 500,
          }}>
            Stop
          </button>
        ) : (
          <button onClick={handleSyncClick} style={{
            padding: '5px 14px', background: '#1a73e8', color: '#fff',
            border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 500,
          }}>
            {syncStatus === 'done' ? 'Re-sync' : 'Start sync'}
          </button>
        )}

        {/* Status */}
        <div style={{ flex: 1, minWidth: 200 }}>
          {isSyncing && (
            <div>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 3 }}>
                Syncing... {syncProgress.downloaded} / {syncProgress.total} ({percentage}%)
              </div>
              <div style={{ background: '#e0e0e0', borderRadius: 4, height: 6, overflow: 'hidden', maxWidth: 260 }}>
                <div style={{
                  width: `${percentage}%`, height: '100%',
                  background: '#1a73e8', transition: 'width 0.2s',
                }} />
              </div>
            </div>
          )}

          {syncStatus === 'done' && (
            <span style={{ fontSize: 12, color: '#555' }}>
              {lastSyncResult && (
                <span style={{ marginRight: 8, color: '#188038' }}>
                  +{lastSyncResult.added} new · {lastSyncResult.total.toLocaleString()} total
                </span>
              )}
              {lastSyncedAt && `Last synced: ${relativeTime(lastSyncedAt)}`}
            </span>
          )}

          {syncStatus === 'idle' && !lastSyncedAt && (
            <span style={{ fontSize: 12, color: '#888' }}>Not synced yet</span>
          )}

          {syncStatus === 'idle' && lastSyncedAt && (
            <span style={{ fontSize: 12, color: '#888' }}>
              Stopped · Last synced: {relativeTime(lastSyncedAt)}
            </span>
          )}

          {syncStatus === 'error' && (
            <span style={{ fontSize: 12, color: '#d93025' }}>Sync failed. Please try again.</span>
          )}
        </div>

        {/* Cache warning */}
        {cacheWarning && (
          <div style={{
            fontSize: 12, color: '#856404', background: '#fff3cd',
            border: '1px solid #ffc107', borderRadius: 4, padding: '3px 10px',
          }}>
            Cache storage full. Data will not be saved between sessions.
          </div>
        )}
      </div>

      {/* Replace confirmation dialog */}
      {showConfirm && (
        <ReplaceConfirmDialog
          range={selectedRange}
          cachedCount={messages.length}
          onConfirm={handleConfirmReplace}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}
