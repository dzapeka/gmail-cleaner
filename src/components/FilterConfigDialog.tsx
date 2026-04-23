import { useState } from 'react';
import { useView } from '../context/ViewContext';
import { useAuth } from '../context/AuthContext';
import { GmailApiClient } from '../api/gmailClient';
import { refreshAccessToken, getStoredAuth } from '../api/auth';

interface FilterAction {
  label: string;
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

const FILTER_ACTIONS: FilterAction[] = [
  { label: 'Delete automatically', addLabelIds: ['TRASH'] },
  { label: 'Mark as read', removeLabelIds: ['UNREAD'] },
  { label: 'Archive', removeLabelIds: ['INBOX'] },
  { label: 'Mark as spam', addLabelIds: ['SPAM'], removeLabelIds: ['INBOX'] },
];

interface FilterConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FilterConfigDialog({ isOpen, onClose }: FilterConfigDialogProps) {
  const { filteredSenderGroups, selection } = useView();
  const { accessToken } = useAuth();

  const [selectedActionIndex, setSelectedActionIndex] = useState(0);
  const [creating, setCreating] = useState(false);
  const [succeeded, setSucceeded] = useState<string[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  if (!isOpen) return null;

  const selectedEmails = Array.from(selection.selectedSenderEmails).filter((email) =>
    filteredSenderGroups.some((g) => g.sender.email === email),
  );

  function handleClose() {
    setCreating(false);
    setSucceeded([]);
    setFailed([]);
    setDone(false);
    setSelectedActionIndex(0);
    onClose();
  }

  async function handleConfirm() {
    if (!accessToken || selectedEmails.length === 0) return;

    const action = FILTER_ACTIONS[selectedActionIndex];
    const client = new GmailApiClient(async () => {
      const stored = getStoredAuth();
      if (stored) return stored.access_token;
      return refreshAccessToken();
    });

    setCreating(true);
    const ok: string[] = [];
    const err: string[] = [];

    for (const email of selectedEmails) {
      try {
        await client.createFilter(
          { from: email },
          {
            addLabelIds: action.addLabelIds,
            removeLabelIds: action.removeLabelIds,
          },
        );
        ok.push(email);
      } catch {
        err.push(email);
      }
    }

    setSucceeded(ok);
    setFailed(err);
    setCreating(false);
    setDone(true);
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
          minWidth: '380px',
          maxWidth: '520px',
          width: '100%',
        }}
      >
        <h2 style={{ margin: '0 0 12px', fontSize: '18px' }}>Create filters</h2>

        {!done && !creating && (
          <>
            <p style={{ margin: '0 0 8px', color: '#444', fontWeight: 500 }}>
              Selected senders ({selectedEmails.length}):
            </p>
            <ul style={{ margin: '0 0 16px', paddingLeft: '20px', color: '#555', maxHeight: '120px', overflowY: 'auto' }}>
              {selectedEmails.map((email) => (
                <li key={email} style={{ fontSize: '13px' }}>{email}</li>
              ))}
            </ul>

            <p style={{ margin: '0 0 8px', color: '#444', fontWeight: 500 }}>Action:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {FILTER_ACTIONS.map((action, i) => (
                <label key={action.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="filter-action"
                    checked={selectedActionIndex === i}
                    onChange={() => setSelectedActionIndex(i)}
                  />
                  {action.label}
                </label>
              ))}
            </div>

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
                disabled={selectedEmails.length === 0}
                style={{
                  padding: '8px 16px',
                  background: '#1a73e8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: selectedEmails.length === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  opacity: selectedEmails.length === 0 ? 0.6 : 1,
                }}
              >
                Create filters
              </button>
            </div>
          </>
        )}

        {creating && (
          <p style={{ color: '#444' }}>Creating filters…</p>
        )}

        {done && (
          <>
            {succeeded.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <p style={{ margin: '0 0 4px', color: '#188038', fontWeight: 500 }}>
                  Filters created for:
                </p>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#555' }}>
                  {succeeded.map((email) => (
                    <li key={email} style={{ fontSize: '13px' }}>{email}</li>
                  ))}
                </ul>
              </div>
            )}
            {failed.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <p style={{ margin: '0 0 4px', color: '#d93025', fontWeight: 500 }}>
                  Failed for:
                </p>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#555' }}>
                  {failed.map((email) => (
                    <li key={email} style={{ fontSize: '13px' }}>{email}</li>
                  ))}
                </ul>
              </div>
            )}
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
