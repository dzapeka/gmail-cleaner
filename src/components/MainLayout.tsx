import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Header } from './Header';
import { SyncPanel } from './SyncPanel';
import { StatsBar } from './StatsBar';
import { ChartSection } from './ChartSection';
import { ToolBar } from './ToolBar';
import { SelectionSummaryBar } from './SelectionSummaryBar';
import { SenderTable } from './SenderTable';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { FilterConfigDialog } from './FilterConfigDialog';
import { UnsubscribeConfirmDialog } from './UnsubscribeConfirmDialog';
import { useView } from '../context/ViewContext';
import { generateCsv, downloadCsv } from '../utils/csvExport';
import type { SenderGroup } from '../types/index';

export function MainLayout() {
  const { filteredSenderGroups, totalEmailCount, removeDeletedMessages } = useView();

  const [highlightedEmail, setHighlightedEmail] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [unsubOpen, setUnsubOpen] = useState(false);
  const [unsubGroup, setUnsubGroup] = useState<SenderGroup | null>(null);

  function handleBarClick(email: string) {
    setHighlightedEmail(email);
  }

  function handleExportCsv() {
    const csv = generateCsv(filteredSenderGroups, totalEmailCount);
    downloadCsv(csv);
  }

  function handleDeleted(deletedIds: Set<string>) {
    removeDeletedMessages(deletedIds);
    setDeleteOpen(false);
  }

  function handleUnsubscribeClick(group: SenderGroup) {
    setUnsubGroup(group);
    setUnsubOpen(true);
  }

  return (
    <div style={layoutStyle}>
      <Header />
      <SyncPanel />

      <main style={mainStyle}>
        <StatsBar />
        <ChartSection onBarClick={handleBarClick} />
        <ToolBar onExportCsv={handleExportCsv} />
        <SelectionSummaryBar
          onDeleteClick={() => setDeleteOpen(true)}
          onCreateFilterClick={() => setFilterOpen(true)}
        />
        <SenderTable
          highlightedEmail={highlightedEmail}
          onUnsubscribeClick={handleUnsubscribeClick}
        />
      </main>

      <DeleteConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={handleDeleted}
      />
      <FilterConfigDialog
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
      />
      <UnsubscribeConfirmDialog
        isOpen={unsubOpen}
        group={unsubGroup}
        onClose={() => setUnsubOpen(false)}
      />
    </div>
  );
}

const layoutStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
  background: '#f1f3f4',
};

const mainStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  padding: '1rem',
  maxWidth: '1400px',
  width: '100%',
  margin: '0 auto',
  boxSizing: 'border-box',
};
