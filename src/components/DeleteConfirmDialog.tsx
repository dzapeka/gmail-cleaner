import { useState } from 'react';
import { useView } from '../context/ViewContext';
import { useAuth } from '../context/AuthContext';
import { GmailApiClient } from '../api/gmailClient';
import { refreshAccessToken, getStoredAuth } from '../api/auth';

const BATCH_SIZE = 50;

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleted: (deletedIds: Set<string>) => void;
}

export function DeleteConfirmDialog({ isOpen, onClose, onDeleted }: DeleteConfirmDialogProps) {
  const { resolveSelectedMessageIds } = useView();
  const { accessToken } = useAuth();

  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState(0); // 0–1
  const [deletedCount, setDeletedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const allIds = resolveSelectedMessageIds();
  const total = allIds.length;

  function handleClose() {
    setDeleting(false);
    setProgress(0);
    setDeletedCount(0);
    setErrorMessage(null);
    onClose();
  }

  async function handleConfirm() {
    if (!accessToken) return;

    const client = new GmailApiClient(async () => {
      const stored = getStoredAuth();
      if (stored) return stored.access_token;
      return refreshAccessToken();
    });

    setDeleting(true);
    setProgress(0);
    setDeletedCount(0);
    setErrorMessage(null);

    const batches: string[][] = [];
    for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
      batches.push(allIds.slice(i, i + BATCH_SIZE));
    }

    let deleted = 0;
    for (const batch of batches) {
      try {
        await client.trashMessages(batch);
        deleted += batch.length;
        setDeletedCount(deleted);
        setProgress(deleted / total);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(`Deleted ${deleted} of ${total} emails. Error: ${msg}`);
        setDeleting(false);
        return;
      }
    }

    onDeleted(new Set(allIds));
    handleClose();
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '8px',
          padding: '24px',
          minWidth: '360px',
          maxWidth: '480px',
          width: '100%',
        }}
      >
        <h2 style={{ margin: '0 0 12px', fontSize: '18px' }}>Delete emails</h2>

        {!deleting && !errorMessage && (
          <>
            <p style={{ margin: '0 0 20px', color: '#444' }}>
              Move <strong>{total}</strong> email{total !== 1 ? 's' : ''} to trash?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleClose}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  padding: '8px 16px',
                  background: '#d93025',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Delete
              </button>
            </div>
          </>
        )}

        {deleting && !errorMessage && (
          <>
            <p style={{ margin: '0 0 12px', color: '#444' }}>
              Deleting… {deletedCount} / {total}
            </p>
            <div
              style={{
                height: '8px',
                background: '#e0e0e0',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.round(progress * 100)}%`,
                  background: '#1a73e8',
                  transition: 'width 0.2s',
                }}
              />
            </div>
          </>
        )}

        {errorMessage && (
          <>
            <p style={{ margin: '0 0 20px', color: '#d93025' }}>{errorMessage}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleClose}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
