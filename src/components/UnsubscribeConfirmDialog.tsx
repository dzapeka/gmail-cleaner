import { MetadataCache } from '../cache/MetadataCache';
import type { SenderGroup } from '../types/index';

interface UnsubscribeConfirmDialogProps {
  isOpen: boolean;
  group: SenderGroup | null;
  onClose: () => void;
}

export function UnsubscribeConfirmDialog({ isOpen, group, onClose }: UnsubscribeConfirmDialogProps) {
  if (!isOpen || !group) return null;

  function handleConfirm() {
    if (!group?.unsubscribeLink) return;
    window.open(group.unsubscribeLink, '_blank', 'noopener,noreferrer');
    MetadataCache.addUnsubscribed(group.sender.email);
    onClose();
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
          minWidth: '340px',
          maxWidth: '480px',
          width: '100%',
        }}
      >
        <h2 style={{ margin: '0 0 12px', fontSize: '18px' }}>Unsubscribe</h2>
        <p style={{ margin: '0 0 6px', color: '#444' }}>
          <strong>Sender:</strong> {group.sender.email}
        </p>
        <p style={{ margin: '0 0 20px', color: '#444', wordBreak: 'break-all', fontSize: '13px' }}>
          <strong>Link:</strong> {group.unsubscribeLink}
        </p>
        <p style={{ margin: '0 0 20px', color: '#555', fontSize: '14px' }}>
          This will open the unsubscribe page in a new tab.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
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
              background: '#1a73e8',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Unsubscribe
          </button>
        </div>
      </div>
    </div>
  );
}
