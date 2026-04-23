import { useView } from '../context/ViewContext';

interface SelectionSummaryBarProps {
  onDeleteClick: () => void;
  onCreateFilterClick: () => void;
}

export function SelectionSummaryBar({ onDeleteClick, onCreateFilterClick }: SelectionSummaryBarProps) {
  const { getSelectedEmailCount } = useView();
  const count = getSelectedEmailCount();

  if (count === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 16px',
        background: '#e8f0fe',
        borderRadius: '6px',
        marginBottom: '12px',
      }}
    >
      <span style={{ fontWeight: 500 }}>{count} email{count !== 1 ? 's' : ''} selected</span>
      <button
        onClick={onDeleteClick}
        style={{
          padding: '6px 14px',
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
      <button
        onClick={onCreateFilterClick}
        style={{
          padding: '6px 14px',
          background: '#1a73e8',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        Create filter
      </button>
    </div>
  );
}
