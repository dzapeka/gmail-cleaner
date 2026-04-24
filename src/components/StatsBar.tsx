import { useView } from '../context/ViewContext';

export function StatsBar() {
  const {
    totalEmailCount,
    uniqueSenderCount,
    filteredEmailCount,
    filteredSenderGroups,
    isFiltered,
    resetFilters,
  } = useView();

  const filteredSenderCount = filteredSenderGroups.length;

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
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
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
    </div>
  );
}
