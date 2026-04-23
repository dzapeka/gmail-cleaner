import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import { useView } from '../context/ViewContext';
import type { SenderGroup } from '../types/index';

// ---------------------------------------------------------------------------
// TopNControl
// ---------------------------------------------------------------------------

function TopNControl() {
  const { activeFilters, setTopN } = useView();

  const options: Array<number | 'all'> = [10, 20, 50, 100, 'all'];

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setTopN(val === 'all' ? 'all' : Number(val));
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <label htmlFor="topn-select" style={{ fontSize: '0.875rem', color: '#555' }}>
        Show top:
      </label>
      <select
        id="topn-select"
        value={activeFilters.topN === 'all' ? 'all' : String(activeFilters.topN)}
        onChange={handleChange}
        style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.875rem' }}
      >
        {options.map((opt) => (
          <option key={String(opt)} value={String(opt)}>
            {opt === 'all' ? 'All senders' : opt}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

interface CustomTooltipProps extends TooltipProps<number, string> {
  totalEmailCount: number;
}

function CustomTooltip({ active, payload, totalEmailCount }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const group = payload[0].payload as SenderGroup;
  const count = group.count;
  const percentage = totalEmailCount > 0 ? ((count / totalEmailCount) * 100).toFixed(1) : '0.0';

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #ddd',
      borderRadius: '6px',
      padding: '0.5rem 0.75rem',
      fontSize: '0.8125rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{group.sender.name || group.sender.email}</div>
      <div>{group.sender.email}</div>
      <div>Emails: {count.toLocaleString()}</div>
      <div>{percentage}% of total</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SenderBarChart
// ---------------------------------------------------------------------------

interface SenderBarChartProps {
  onBarClick: (email: string) => void;
}

function SenderBarChart({ onBarClick }: SenderBarChartProps) {
  const { topNGroups, totalEmailCount } = useView();

  if (topNGroups.length === 0) {
    return (
      <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '0.9rem' }}>
        No data to display
      </div>
    );
  }

  function handleBarClick(data: SenderGroup) {
    onBarClick(data.sender.email);
  }

  function tickFormatter(value: string): string {
    return value.length > 15 ? value.slice(0, 15) + '…' : value;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={topNGroups} margin={{ top: 8, right: 16, left: 0, bottom: 60 }}>
        <XAxis
          dataKey="sender.email"
          tickFormatter={tickFormatter}
          angle={-45}
          textAnchor="end"
          interval={0}
          tick={{ fontSize: 11 }}
        />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip content={<CustomTooltip totalEmailCount={totalEmailCount} />} />
        <Bar dataKey="count" onClick={handleBarClick} cursor="pointer">
          {topNGroups.map((entry) => (
            <Cell key={entry.sender.email} fill="#1a73e8" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// ChartSection (public export)
// ---------------------------------------------------------------------------

export function ChartSection({ onBarClick }: { onBarClick: (email: string) => void }) {
  return (
    <div style={{ padding: '1rem', background: '#fff', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
        <TopNControl />
      </div>
      <SenderBarChart onBarClick={onBarClick} />
    </div>
  );
}
