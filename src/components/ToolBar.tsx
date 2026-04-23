import type { CSSProperties } from 'react';
import { useView } from '../context/ViewContext';
import type { TimeFilter } from '../types/index';

// ---------------------------------------------------------------------------
// SearchInput
// ---------------------------------------------------------------------------

function SearchInput() {
  const { activeFilters, setSearchQuery } = useView();

  return (
    <input
      type="search"
      placeholder="Search by sender name or email"
      value={activeFilters.searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      style={inputStyle}
      aria-label="Search senders"
    />
  );
}

// ---------------------------------------------------------------------------
// GroupingToggle
// ---------------------------------------------------------------------------

function GroupingToggle() {
  const { activeFilters, setGroupingMode } = useView();

  return (
    <div style={{ display: 'flex', border: '1px solid #dadce0', borderRadius: '4px', overflow: 'hidden' }}>
      <button
        onClick={() => setGroupingMode('sender')}
        style={{
          ...toggleBtnStyle,
          background: activeFilters.groupingMode === 'sender' ? '#1a73e8' : '#fff',
          color: activeFilters.groupingMode === 'sender' ? '#fff' : '#333',
        }}
        aria-pressed={activeFilters.groupingMode === 'sender'}
      >
        By sender
      </button>
      <button
        onClick={() => setGroupingMode('domain')}
        style={{
          ...toggleBtnStyle,
          background: activeFilters.groupingMode === 'domain' ? '#1a73e8' : '#fff',
          color: activeFilters.groupingMode === 'domain' ? '#fff' : '#333',
          borderLeft: '1px solid #dadce0',
        }}
        aria-pressed={activeFilters.groupingMode === 'domain'}
      >
        By domain
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SpamFilterToggle
// ---------------------------------------------------------------------------

function SpamFilterToggle() {
  const { activeFilters, setShowSpamOnly } = useView();

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={activeFilters.showSpamOnly}
        onChange={(e) => setShowSpamOnly(e.target.checked)}
        aria-label="Show spam only"
      />
      Show spam only
    </label>
  );
}

// ---------------------------------------------------------------------------
// TimeFilterSelect
// ---------------------------------------------------------------------------

type TimeFilterOption = {
  label: string;
  value: TimeFilter;
};

const TIME_FILTER_OPTIONS: TimeFilterOption[] = [
  { label: 'All emails', value: { type: 'all' } },
  { label: 'Older than 6 months', value: { type: 'olderThan', months: 6 } },
  { label: 'Older than 1 year', value: { type: 'olderThan', months: 12 } },
  { label: 'Older than 2 years', value: { type: 'olderThan', months: 24 } },
  { label: 'Older than 5 years', value: { type: 'olderThan', months: 60 } },
];

function timeFilterToKey(filter: TimeFilter): string {
  if (filter.type === 'all') return 'all';
  return `olderThan-${filter.months}`;
}

function keyToTimeFilter(key: string): TimeFilter {
  if (key === 'all') return { type: 'all' };
  const months = parseInt(key.replace('olderThan-', ''), 10);
  return { type: 'olderThan', months };
}

function TimeFilterSelect() {
  const { activeFilters, setTimeFilter } = useView();

  return (
    <select
      value={timeFilterToKey(activeFilters.timeFilter)}
      onChange={(e) => setTimeFilter(keyToTimeFilter(e.target.value))}
      style={{ ...inputStyle, width: 'auto' }}
      aria-label="Time filter"
    >
      {TIME_FILTER_OPTIONS.map((opt) => (
        <option key={timeFilterToKey(opt.value)} value={timeFilterToKey(opt.value)}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// ExportCsvButton
// ---------------------------------------------------------------------------

function ExportCsvButton({ onExportCsv }: { onExportCsv: () => void }) {
  return (
    <button onClick={onExportCsv} style={exportBtnStyle} aria-label="Export CSV">
      Export CSV
    </button>
  );
}

// ---------------------------------------------------------------------------
// ToolBar — public export
// ---------------------------------------------------------------------------

export function ToolBar({ onExportCsv }: { onExportCsv: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        background: '#fff',
        borderRadius: '6px',
        border: '1px solid #e0e0e0',
      }}
    >
      <SearchInput />
      <GroupingToggle />
      <SpamFilterToggle />
      <TimeFilterSelect />
      <ExportCsvButton onExportCsv={onExportCsv} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const inputStyle: CSSProperties = {
  padding: '0.35rem 0.6rem',
  border: '1px solid #dadce0',
  borderRadius: '4px',
  fontSize: '0.875rem',
  minWidth: '220px',
};

const toggleBtnStyle: CSSProperties = {
  padding: '0.35rem 0.75rem',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 500,
};

const exportBtnStyle: CSSProperties = {
  padding: '0.35rem 0.75rem',
  background: '#1a73e8',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 500,
  marginLeft: 'auto',
};
