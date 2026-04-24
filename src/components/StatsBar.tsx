import { useView } from '../context/ViewContext';
import { usePreferences } from '../context/PreferencesContext';

export function StatsBar() {
  const {
    totalEmailCount,
    uniqueSenderCount,
    filteredEmailCount,
    filteredSenderGroups,
    isFiltered,
    hiddenEmailCount,
    hiddenSenderCount,
    resetFilters,
  } = useView();
  const { showHidden, setShowHidden, hiddenSenders } = usePreferences();

  const filteredSenderCount = filteredSenderGroups.length;
  const hasHidden = hiddenSenders.size > 0;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '1.5rem',
      padding: '0.6rem 1rem',
      background: '#f8f9fa',
      borderRadius: '6px',
      fontSize: '0.875rem',
    }}>
      {isFiltered ? (
        <>
          <span>
            Showing:{' '}
            <strong>{filteredEmailCount.toLocaleString()}</strong>
            {' of '}
            <strong>{totalEmailCount.toLocaleString()}</strong>
            {' emails'}
          </span>
          <span>
            <strong>{filteredSenderCount.toLocaleString()}</strong>
            {' of '}
            <strong>{uniqueSenderCount.toLocaleString()}</strong>
            {' senders'}
          </span>
          <button
            onClick={resetFilters}
            style={{
              padding: '2px 10px',
              fontSize: '0.8rem',
              background: '#fff',
              border: '1px solid #dadce0',
              borderRadius: '12px',
              cursor: 'pointer',
              color: '#555',
            }}
          >
            × Clear filters
          </button>
        </>
      ) : (
        <>
          <span>Total emails: <strong>{totalEmailCount.toLocaleString()}</strong></span>
          <span>Unique senders: <strong>{uniqueSenderCount.toLocaleString()}</strong></span>
        </>
      )}

      {/* Hidden senders indicator */}
      {hasHidden && (
        <button
          onClick={() => setShowHidden(!showHidden)}
          style={{
            padding: '2px 10px',
            fontSize: '0.8rem',
            background: showHidden ? '#fce8e6' : '#fff',
            border: '1px solid #dadce0',
            borderRadius: '12px',
            cursor: 'pointer',
            color: showHidden ? '#d93025' : '#888',
            marginLeft: 'auto',
          }}
          title={showHidden ? 'Click to hide them again' : 'Click to show hidden senders'}
        >
          {showHidden
            ? `Showing ${hiddenSenderCount} hidden`
            : `${hiddenSenderCount} hidden (${hiddenEmailCount.toLocaleString()} emails)`}
        </button>
      )}
    </div>
  );
}
