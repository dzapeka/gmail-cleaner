import { useData } from '../context/DataContext';

/** Returns a human-readable relative time string from an ISO 8601 timestamp. */
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

export function SyncPanel() {
  const { syncStatus, syncProgress, lastSyncedAt, cacheWarning, startSync } = useData();

  const isSyncing = syncStatus === 'syncing';
  const percentage =
    syncProgress.total > 0
      ? Math.round((syncProgress.downloaded / syncProgress.total) * 100)
      : 0;

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', background: '#fafafa' }}>
      {/* Syncing state */}
      {isSyncing && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>
            Syncing... {syncProgress.downloaded} / {syncProgress.total} emails ({percentage}%)
          </div>
          <div style={{ background: '#e0e0e0', borderRadius: 4, height: 8, overflow: 'hidden' }}>
            <div
              style={{
                width: `${percentage}%`,
                height: '100%',
                background: '#1a73e8',
                transition: 'width 0.2s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Done state */}
      {syncStatus === 'done' && lastSyncedAt && (
        <div style={{ fontSize: 13, color: '#555', marginBottom: 6 }}>
          Last synced: {relativeTime(lastSyncedAt)}
        </div>
      )}

      {/* Error state */}
      {syncStatus === 'error' && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ color: '#d93025', fontSize: 13, marginRight: 12 }}>
            Sync failed. Please try again.
          </span>
          <button
            onClick={() => void startSync()}
            style={{
              fontSize: 12,
              padding: '3px 10px',
              cursor: 'pointer',
              background: '#d93025',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Cache warning */}
      {cacheWarning && (
        <div
          style={{
            fontSize: 12,
            color: '#856404',
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: 4,
            padding: '4px 10px',
            marginBottom: 8,
          }}
        >
          Cache storage full. Data will not be saved between sessions.
        </div>
      )}

      {/* Re-sync button */}
      <button
        onClick={() => void startSync()}
        disabled={isSyncing}
        style={{
          fontSize: 13,
          padding: '5px 14px',
          cursor: isSyncing ? 'not-allowed' : 'pointer',
          background: isSyncing ? '#ccc' : '#1a73e8',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          opacity: isSyncing ? 0.7 : 1,
        }}
      >
        Re-sync
      </button>
    </div>
  );
}
