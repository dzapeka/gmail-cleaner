import { useView } from '../context/ViewContext';

export function StatsBar() {
  const { totalEmailCount, uniqueSenderCount } = useView();

  return (
    <div style={{ display: 'flex', gap: '2rem', padding: '0.75rem 1rem', background: '#f8f9fa', borderRadius: '6px' }}>
      <span>Total emails: <strong>{totalEmailCount.toLocaleString()}</strong></span>
      <span>Unique senders: <strong>{uniqueSenderCount.toLocaleString()}</strong></span>
    </div>
  );
}
