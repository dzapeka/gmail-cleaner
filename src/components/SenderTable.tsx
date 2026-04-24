import {
  useRef,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type CSSProperties,
} from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type Row,
} from '@tanstack/react-table';
import type { SenderGroup, DomainGroup, SubjectCluster } from '../types/index';
import { useView } from '../context/ViewContext';
import { useData } from '../context/DataContext';

// ---------------------------------------------------------------------------
// SpamIndicator
// ---------------------------------------------------------------------------

function SpamIndicator({ group }: { group: SenderGroup }) {
  if (!group.isSuspectedSpam) return null;

  const tooltipParts: string[] = [];
  for (const reason of group.spamReasons) {
    if (reason.type === 'keyword') {
      tooltipParts.push(`Keyword matched: "${reason.matchedKeyword}"`);
    } else if (reason.type === 'highUnreadRatio') {
      tooltipParts.push(`High unread ratio: ${(reason.ratio * 100).toFixed(0)}%`);
    } else if (reason.type === 'repetitiveSubjects') {
      tooltipParts.push(`Repetitive subjects: ${(reason.ratio * 100).toFixed(0)}%`);
    }
  }

  return (
    <span
      title={tooltipParts.join('\n')}
      style={{ cursor: 'help', fontSize: '1rem', userSelect: 'none' }}
      aria-label="Suspected spam"
    >
      🚫
    </span>
  );
}

// ---------------------------------------------------------------------------
// UnsubscribeButton
// ---------------------------------------------------------------------------

interface UnsubscribeButtonProps {
  group: SenderGroup;
  onUnsubscribeClick: (group: SenderGroup) => void;
}

function UnsubscribeButton({ group, onUnsubscribeClick }: UnsubscribeButtonProps) {
  if (group.unsubscribeLink === null) return null;

  return (
    <button
      onClick={() => onUnsubscribeClick(group)}
      style={{
        padding: '0.2rem 0.5rem',
        fontSize: '0.75rem',
        background: '#f1f3f4',
        border: '1px solid #dadce0',
        borderRadius: '4px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      Unsubscribe
    </button>
  );
}

// ---------------------------------------------------------------------------
// Cluster label colors
// ---------------------------------------------------------------------------

const CLUSTER_LABEL_COLORS: Record<SubjectCluster['label'], string> = {
  Promotional: '#e65100',
  Transactional: '#2e7d32',
  Newsletter: '#1565c0',
  Other: '#616161',
};

// ---------------------------------------------------------------------------
// ExpandedEmailList
// ---------------------------------------------------------------------------

interface ExpandedEmailListProps {
  group: SenderGroup;
  allMessages: Map<string, { subject: string; date: string }>;
  toggleMessage: (id: string) => void;
  selectedMessageIds: Set<string>;
}

function ExpandedEmailList({
  group,
  allMessages,
  toggleMessage,
  selectedMessageIds,
}: ExpandedEmailListProps) {
  const hasClusters = group.subjectClusters.length > 0;

  // Cluster breakdown summary string
  const clusterSummary = hasClusters
    ? group.subjectClusters
        .map((c) => `${c.label}: ${c.count}`)
        .join(', ')
    : null;

  // Individual emails (first 20)
  const MAX_INDIVIDUAL = 20;
  const individualIds = group.messageIds.slice(0, MAX_INDIVIDUAL);
  const remaining = group.messageIds.length - MAX_INDIVIDUAL;

  const cellStyle: CSSProperties = {
    padding: '0.25rem 0.5rem',
    fontSize: '0.8rem',
    borderBottom: '1px solid #f0f0f0',
  };

  return (
    <div style={{ padding: '0.5rem 1rem 0.5rem 2.5rem', background: '#fafafa' }}>
      {/* Cluster breakdown summary */}
      {clusterSummary && (
        <div style={{ fontSize: '0.8rem', color: '#555', marginBottom: '0.5rem' }}>
          {clusterSummary}
        </div>
      )}

      {/* Subject cluster sub-rows */}
      {hasClusters && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.5rem' }}>
          <tbody>
            {group.subjectClusters.map((cluster) => {
              const allSelected = cluster.messageIds.every((id) =>
                selectedMessageIds.has(id),
              );
              return (
                <tr key={cluster.normalizedPattern} style={{ background: '#f5f5f5' }}>
                  <td style={{ ...cellStyle, width: '2rem' }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => {
                        for (const id of cluster.messageIds) {
                          const isSelected = selectedMessageIds.has(id);
                          if (allSelected ? isSelected : !isSelected) {
                            toggleMessage(id);
                          }
                        }
                      }}
                      aria-label={`Select all in cluster ${cluster.label}`}
                    />
                  </td>
                  <td style={cellStyle}>
                    <span
                      style={{
                        background: CLUSTER_LABEL_COLORS[cluster.label],
                        color: '#fff',
                        borderRadius: '3px',
                        padding: '0.1rem 0.4rem',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        marginRight: '0.5rem',
                      }}
                    >
                      {cluster.label}
                    </span>
                    {cluster.count} emails
                  </td>
                  <td style={{ ...cellStyle, color: '#666' }}>
                    {cluster.exampleSubjects.slice(0, 3).join(', ')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Individual email rows */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {individualIds.map((id) => {
            const msg = allMessages.get(id);
            return (
              <tr key={id}>
                <td style={{ ...cellStyle, width: '2rem' }}>
                  <input
                    type="checkbox"
                    checked={selectedMessageIds.has(id)}
                    onChange={() => toggleMessage(id)}
                    aria-label={`Select email ${id}`}
                  />
                </td>
                <td style={cellStyle}>{msg?.subject ?? '(no subject)'}</td>
                <td style={{ ...cellStyle, color: '#888', whiteSpace: 'nowrap' }}>
                  {msg?.date ? new Date(msg.date).toLocaleDateString() : ''}
                </td>
              </tr>
            );
          })}
          {remaining > 0 && (
            <tr>
              <td colSpan={3} style={{ ...cellStyle, color: '#888', fontStyle: 'italic' }}>
                … and {remaining} more
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SenderTable props
// ---------------------------------------------------------------------------

export interface SenderTableProps {
  highlightedEmail: string | null;
  onUnsubscribeClick: (group: SenderGroup) => void;
}

// ---------------------------------------------------------------------------
// SenderTable — sender mode
// ---------------------------------------------------------------------------

const senderColumnHelper = createColumnHelper<SenderGroup>();

function SenderTableView({ highlightedEmail, onUnsubscribeClick }: SenderTableProps) {
  const {
    filteredSenderGroups,
    totalEmailCount,
    selection,
    toggleSender,
    toggleMessage,
    selectAll,
    deselectAll,
  } = useView();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [highlightedRow, setHighlightedRow] = useState<string | null>(null);

  // Row refs for scroll-to
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  // Build message lookup map from DataContext
  const { messages } = useData();
  const msgMap = useMemo(() => {
    const map = new Map<string, { subject: string; date: string }>();
    for (const m of messages) {
      map.set(m.id, { subject: m.subject, date: m.date });
    }
    return map;
  }, [messages]);

  // Scroll + highlight when highlightedEmail changes
  useEffect(() => {
    if (!highlightedEmail) return;

    const el = rowRefs.current.get(highlightedEmail);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    setHighlightedRow(highlightedEmail);
    const timer = setTimeout(() => setHighlightedRow(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightedEmail]);

  const toggleExpand = useCallback((email: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  }, []);

  const columns = [
    senderColumnHelper.display({
      id: 'select',
      header: () => (
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button onClick={selectAll} style={smallBtnStyle} title="Select all">✓</button>
          <button onClick={deselectAll} style={smallBtnStyle} title="Deselect all">✗</button>
        </div>
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selection.selectedSenderEmails.has(row.original.sender.email)}
          onChange={() => toggleSender(row.original.sender.email)}
          aria-label={`Select ${row.original.sender.email}`}
        />
      ),
      enableSorting: false,
    }),
    senderColumnHelper.display({
      id: 'expand',
      header: '',
      cell: ({ row }) => (
        <button
          onClick={() => toggleExpand(row.original.sender.email)}
          style={smallBtnStyle}
          aria-label={expandedRows.has(row.original.sender.email) ? 'Collapse' : 'Expand'}
        >
          {expandedRows.has(row.original.sender.email) ? '▾' : '▸'}
        </button>
      ),
      enableSorting: false,
    }),
    senderColumnHelper.accessor((row) => row.sender.name || row.sender.email, {
      id: 'sender',
      header: 'Sender',
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 500 }}>{row.original.sender.name || row.original.sender.email}</div>
          {row.original.sender.name && (
            <div style={{ fontSize: '0.75rem', color: '#666' }}>{row.original.sender.email}</div>
          )}
        </div>
      ),
    }),
    senderColumnHelper.accessor('count', {
      header: 'Emails',
      cell: ({ getValue }) => getValue().toLocaleString(),
    }),
    senderColumnHelper.accessor(
      (row) => (totalEmailCount > 0 ? (row.count / totalEmailCount) * 100 : 0),
      {
        id: 'percentage',
        header: '% of Total',
        cell: ({ getValue }) => `${(getValue() as number).toFixed(1)}%`,
      },
    ),
    senderColumnHelper.accessor('lastDate', {
      header: 'Last Email',
      cell: ({ getValue }) => new Date(getValue()).toLocaleDateString(),
    }),
    senderColumnHelper.display({
      id: 'spam',
      header: 'Spam',
      cell: ({ row }) => <SpamIndicator group={row.original} />,
      enableSorting: false,
    }),
    senderColumnHelper.display({
      id: 'unsubscribe',
      header: '',
      cell: ({ row }) => (
        <UnsubscribeButton group={row.original} onUnsubscribeClick={onUnsubscribeClick} />
      ),
      enableSorting: false,
    }),
  ];

  const table = useReactTable({
    data: filteredSenderGroups,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                    style={{
                      ...thStyle,
                      cursor: header.column.getCanSort() ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' && ' ↑'}
                    {header.column.getIsSorted() === 'desc' && ' ↓'}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row: Row<SenderGroup>) => {
              const email = row.original.sender.email;
              const isHighlighted = highlightedRow === email;
              const isExpanded = expandedRows.has(email);

              return (
                <>
                  <tr
                    key={row.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(email, el);
                      else rowRefs.current.delete(email);
                    }}
                    style={{
                      ...trStyle,
                      background: isHighlighted ? '#fff9c4' : undefined,
                      transition: 'background 0.3s',
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} style={tdStyle}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && (
                    <tr key={`${row.id}-expanded`}>
                      <td colSpan={columns.length} style={{ padding: 0 }}>
                        <ExpandedEmailList
                          group={row.original}
                          allMessages={msgMap}
                          toggleMessage={toggleMessage}
                          selectedMessageIds={selection.selectedMessageIds}
                        />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={paginationStyle}>
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          style={pageBtnStyle}
        >
          Prev
        </button>
        <span style={{ fontSize: '0.875rem' }}>
          Page {pageIndex + 1} of {pageCount || 1}
        </span>
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          style={pageBtnStyle}
        >
          Next
        </button>
        <span style={{ fontSize: '0.8rem', color: '#888' }}>
          ({filteredSenderGroups.length} senders, {pageSize} per page)
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DomainTable — domain mode
// ---------------------------------------------------------------------------

const domainColumnHelper = createColumnHelper<DomainGroup>();

function DomainTableView({ onUnsubscribeClick }: SenderTableProps) {
  const {
    filteredDomainGroups,
    selection,
    toggleSender,
    selectAll,
    deselectAll,
  } = useView();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((domain: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }, []);

  const columns = [
    domainColumnHelper.display({
      id: 'select',
      header: () => (
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button onClick={selectAll} style={smallBtnStyle} title="Select all">✓</button>
          <button onClick={deselectAll} style={smallBtnStyle} title="Deselect all">✗</button>
        </div>
      ),
      cell: ({ row }) => {
        const allSelected = row.original.senderGroups.every((sg) =>
          selection.selectedSenderEmails.has(sg.sender.email),
        );
        return (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => {
              for (const sg of row.original.senderGroups) {
                const isSelected = selection.selectedSenderEmails.has(sg.sender.email);
                if (allSelected ? isSelected : !isSelected) {
                  toggleSender(sg.sender.email);
                }
              }
            }}
            aria-label={`Select domain ${row.original.domain}`}
          />
        );
      },
      enableSorting: false,
    }),
    domainColumnHelper.display({
      id: 'expand',
      header: '',
      cell: ({ row }) => (
        <button
          onClick={() => toggleExpand(row.original.domain)}
          style={smallBtnStyle}
          aria-label={expandedRows.has(row.original.domain) ? 'Collapse' : 'Expand'}
        >
          {expandedRows.has(row.original.domain) ? '▾' : '▸'}
        </button>
      ),
      enableSorting: false,
    }),
    domainColumnHelper.accessor('domain', {
      header: 'Domain',
      cell: ({ getValue }) => <strong>{getValue()}</strong>,
    }),
    domainColumnHelper.accessor('totalCount', {
      header: 'Emails',
      cell: ({ getValue }) => getValue().toLocaleString(),
    }),
    domainColumnHelper.accessor('uniqueSenderCount', {
      header: 'Senders',
    }),
    domainColumnHelper.accessor('lastDate', {
      header: 'Last Email',
      cell: ({ getValue }) => new Date(getValue()).toLocaleDateString(),
    }),
    domainColumnHelper.display({
      id: 'spam',
      header: 'Spam',
      cell: ({ row }) =>
        row.original.isSuspectedSpam ? (
          <span title="One or more senders in this domain are suspected spam" style={{ cursor: 'help' }}>🚫</span>
        ) : null,
      enableSorting: false,
    }),
  ];

  const table = useReactTable({
    data: filteredDomainGroups,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                    style={{
                      ...thStyle,
                      cursor: header.column.getCanSort() ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' && ' ↑'}
                    {header.column.getIsSorted() === 'desc' && ' ↓'}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row: Row<DomainGroup>) => {
              const domain = row.original.domain;
              const isExpanded = expandedRows.has(domain);

              return (
                <>
                  <tr key={row.id} style={trStyle}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} style={tdStyle}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && (
                    <tr key={`${row.id}-expanded`}>
                      <td colSpan={columns.length} style={{ padding: '0.5rem 1rem 0.5rem 2.5rem', background: '#fafafa' }}>
                        <div style={{ fontSize: '0.85rem', color: '#555', marginBottom: '0.25rem' }}>
                          Senders in {domain}:
                        </div>
                        {row.original.senderGroups.map((sg) => (
                          <div key={sg.sender.email} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.2rem 0' }}>
                            <input
                              type="checkbox"
                              checked={selection.selectedSenderEmails.has(sg.sender.email)}
                              onChange={() => toggleSender(sg.sender.email)}
                              aria-label={`Select ${sg.sender.email}`}
                            />
                            <span>{sg.sender.name || sg.sender.email}</span>
                            <span style={{ color: '#888', fontSize: '0.8rem' }}>({sg.count})</span>
                            <SpamIndicator group={sg} />
                            <UnsubscribeButton group={sg} onUnsubscribeClick={onUnsubscribeClick} />
                          </div>
                        ))}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={paginationStyle}>
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          style={pageBtnStyle}
        >
          Prev
        </button>
        <span style={{ fontSize: '0.875rem' }}>
          Page {pageIndex + 1} of {pageCount || 1}
        </span>
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          style={pageBtnStyle}
        >
          Next
        </button>
        <span style={{ fontSize: '0.8rem', color: '#888' }}>
          ({filteredDomainGroups.length} domains, {pageSize} per page)
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SenderTable — public export
// ---------------------------------------------------------------------------

export function SenderTable({ highlightedEmail, onUnsubscribeClick }: SenderTableProps) {
  const { activeFilters } = useView();

  if (activeFilters.groupingMode === 'domain') {
    return <DomainTableView highlightedEmail={highlightedEmail} onUnsubscribeClick={onUnsubscribeClick} />;
  }

  return <SenderTableView highlightedEmail={highlightedEmail} onUnsubscribeClick={onUnsubscribeClick} />;
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.875rem',
};

const thStyle: CSSProperties = {
  padding: '0.5rem 0.75rem',
  textAlign: 'left',
  borderBottom: '2px solid #e0e0e0',
  background: '#f8f9fa',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const tdStyle: CSSProperties = {
  padding: '0.5rem 0.75rem',
  borderBottom: '1px solid #f0f0f0',
  verticalAlign: 'middle',
};

const trStyle: CSSProperties = {
  transition: 'background 0.15s',
};

const paginationStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.75rem 0.5rem',
  borderTop: '1px solid #e0e0e0',
};

const pageBtnStyle: CSSProperties = {
  padding: '0.3rem 0.75rem',
  border: '1px solid #dadce0',
  borderRadius: '4px',
  background: '#fff',
  cursor: 'pointer',
  fontSize: '0.875rem',
};

const smallBtnStyle: CSSProperties = {
  padding: '0.1rem 0.35rem',
  border: '1px solid #dadce0',
  borderRadius: '3px',
  background: '#f8f9fa',
  cursor: 'pointer',
  fontSize: '0.75rem',
};
