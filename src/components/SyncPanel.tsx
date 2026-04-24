import { useData } from '../context/DataContext';

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
  const { syncStatus, syncProgress, lastSyncedAt, cacheWarning, startSync, stopSync } = useData();

  const isSyncing = syncStatus === 'syncing';
  const percentage =
    syncProgress.total > 0
      ? Math.round((syncProgress.downloaded / syncProgress.total) * 100)
      : 0;

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', background: '#fafafa', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>

      {/* Status text */}
      <div style={{ flex: 1, minWidth: '200px' }}>
        {isSyncing && (
          <div>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>
              Syncing... {syncProgress.downloaded} / {syncProgress.total} emails ({percentage}%)
            </div>
            <div style={{ background: '#e0e0e0', borderRadius: 4, height: 8, overflow: 'hidden', maxWidth: 300 }}>
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

        {syncStatus === 'done' && lastSyncedAt && (
          <span style={{ fontSize: 13, color: '#555' }}>
            Last synced: {relativeTime(lastSyncedAt)}
          </span>
        )}

        {syncStatus === 'idle' && !lastSyncedAt && (
          <span style={{ fontSize: 13, color: '#888' }}>Not synced yet</span>
        )}

        {syncStatus === 'idle' && lastSyncedAt && (
          <span style={{ fontSize: 13, color: '#555' }}>
            Sync stopped · Last synced: {relativeTime(lastSyncedAt)}
          </span>
        )}

        {syncStatus === 'error' && (
          <span style={{ color: '#d93025', fontSize: 13 }}>
            Sync failed. Please try again.
          </span>
        )}
      </div>

      {/* Cache warning */}
      {cacheWarning && (
        <div style={{
          fontSize: 12,
          color: '#856404',
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: 4,
          padding: '4px 10px',
        }}>
          Cache storage full. Data will not be saved between sessions.
        </div>
      )}

      {/* Action buttons */}
      {isSyncing ? (
        <button
          onClick={stopSync}
          style={{
            fontSize: 13,
            padding: '5px 14px',
            cursor: 'pointer',
            background: '#d93025',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
          }}
        >
          Stop
        </button>
      ) : (
        <button
          onClick={() => void startSync()}
          style={{
            fontSize: 13,
            padding: '5px 14px',
            cursor: 'pointer',
            background: '#1a73e8',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
          }}
        >
          {syncStatus === 'done' ? 'Re-sync' : 'Start sync'}
        </button>
      )}
    </div>
  );
}
