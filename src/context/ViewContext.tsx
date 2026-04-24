import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type {
  ActiveFilters,
  TimeFilter,
  SenderGroup,
  DomainGroup,
  SelectionState,
} from '../types/index';
import {
  groupBySender,
  groupByDomain,
  applyTimeFilterWithMessages,
  applySearchFilter,
} from '../data/DataProcessor';
import { useData } from './DataContext';

// ---------------------------------------------------------------------------
// Default filter state
// ---------------------------------------------------------------------------

const DEFAULT_FILTERS: ActiveFilters = {
  timeFilter: { type: 'all' },
  searchQuery: '',
  showSpamOnly: false,
  groupingMode: 'sender',
  topN: 20,
};

const DEFAULT_SELECTION: SelectionState = {
  selectedSenderEmails: new Set<string>(),
  selectedMessageIds: new Set<string>(),
};

// ---------------------------------------------------------------------------
// Context value interface
// ---------------------------------------------------------------------------

interface ViewContextValue {
  // Filters
  activeFilters: ActiveFilters;
  setTimeFilter: (filter: TimeFilter) => void;
  setSearchQuery: (query: string) => void;
  setShowSpamOnly: (show: boolean) => void;
  setGroupingMode: (mode: 'sender' | 'domain') => void;
  setTopN: (n: number | 'all') => void;

  // Derived data
  allSenderGroups: SenderGroup[];
  filteredSenderGroups: SenderGroup[];
  filteredDomainGroups: DomainGroup[];
  topNGroups: SenderGroup[];

  // Stats
  totalEmailCount: number;
  uniqueSenderCount: number;
  filteredEmailCount: number;
  isFiltered: boolean;
  resetFilters: () => void;

  // Selection
  selection: SelectionState;
  selectAll: () => void;
  deselectAll: () => void;
  toggleSender: (email: string) => void;
  toggleMessage: (id: string) => void;
  getSelectedEmailCount: () => number;
  resolveSelectedMessageIds: () => string[];

  // Post-deletion update
  removeDeletedMessages: (deletedIds: Set<string>) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ViewContext = createContext<ViewContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ViewProvider({ children }: { children: ReactNode }) {
  const { messages } = useData();

  const [activeFilters, setActiveFilters] = useState<ActiveFilters>(DEFAULT_FILTERS);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selection, setSelection] = useState<SelectionState>(DEFAULT_SELECTION);

  // Debounce search query at 80ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(activeFilters.searchQuery);
    }, 80);
    return () => clearTimeout(timer);
  }, [activeFilters.searchQuery]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  // 1. All sender groups — memoized on messages only
  const allSenderGroups = useMemo<SenderGroup[]>(
    () => groupBySender(messages),
    [messages],
  );

  // 2. Filtered sender groups — apply time, search, spam filters in order
  const filteredSenderGroups = useMemo<SenderGroup[]>(() => {
    let groups = applyTimeFilterWithMessages(
      allSenderGroups,
      activeFilters.timeFilter,
      messages,
    );
    groups = applySearchFilter(groups, debouncedSearchQuery);
    if (activeFilters.showSpamOnly) {
      groups = groups.filter((g) => g.isSuspectedSpam === true);
    }
    return groups;
  }, [allSenderGroups, activeFilters.timeFilter, activeFilters.showSpamOnly, debouncedSearchQuery, messages]);

  // 3. Filtered domain groups
  const filteredDomainGroups = useMemo<DomainGroup[]>(
    () => groupByDomain(filteredSenderGroups),
    [filteredSenderGroups],
  );

  // 4. Top-N groups (already sorted by count desc from groupBySender)
  const topNGroups = useMemo<SenderGroup[]>(() => {
    if (activeFilters.topN === 'all') return filteredSenderGroups;
    return filteredSenderGroups.slice(0, activeFilters.topN);
  }, [filteredSenderGroups, activeFilters.topN]);

  // 5. Stats
  const totalEmailCount = useMemo(() => messages.length, [messages]);
  const uniqueSenderCount = useMemo(() => allSenderGroups.length, [allSenderGroups]);
  const filteredEmailCount = useMemo(
    () => filteredSenderGroups.reduce((sum, g) => sum + g.count, 0),
    [filteredSenderGroups],
  );
  const isFiltered = useMemo(
    () => activeFilters.timeFilter.type !== 'all' || activeFilters.searchQuery.trim() !== '' || activeFilters.showSpamOnly,
    [activeFilters],
  );

  // ---------------------------------------------------------------------------
  // Filter setters
  // ---------------------------------------------------------------------------

  const setTimeFilter = useCallback((filter: TimeFilter) => {
    setActiveFilters((prev) => ({ ...prev, timeFilter: filter }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setActiveFilters((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  const setShowSpamOnly = useCallback((show: boolean) => {
    setActiveFilters((prev) => ({ ...prev, showSpamOnly: show }));
  }, []);

  const setGroupingMode = useCallback((mode: 'sender' | 'domain') => {
    setActiveFilters((prev) => ({ ...prev, groupingMode: mode }));
  }, []);

  const setTopN = useCallback((n: number | 'all') => {
    setActiveFilters((prev) => ({ ...prev, topN: n }));
  }, []);

  const resetFilters = useCallback(() => {
    setActiveFilters((prev) => ({
      ...prev,
      timeFilter: { type: 'all' },
      searchQuery: '',
      showSpamOnly: false,
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // Selection helpers
  // ---------------------------------------------------------------------------

  const selectAll = useCallback(() => {
    setSelection({
      selectedSenderEmails: new Set(filteredSenderGroups.map((g) => g.sender.email)),
      selectedMessageIds: new Set<string>(),
    });
  }, [filteredSenderGroups]);

  const deselectAll = useCallback(() => {
    setSelection({
      selectedSenderEmails: new Set<string>(),
      selectedMessageIds: new Set<string>(),
    });
  }, []);

  const toggleSender = useCallback(
    (email: string) => {
      setSelection((prev) => {
        const newSenderEmails = new Set(prev.selectedSenderEmails);
        const newMessageIds = new Set(prev.selectedMessageIds);

        if (newSenderEmails.has(email)) {
          newSenderEmails.delete(email);
        } else {
          newSenderEmails.add(email);
        }

        // Remove individually selected message IDs belonging to this sender
        const senderGroup = allSenderGroups.find((g) => g.sender.email === email);
        if (senderGroup) {
          for (const id of senderGroup.messageIds) {
            newMessageIds.delete(id);
          }
        }

        return {
          selectedSenderEmails: newSenderEmails,
          selectedMessageIds: newMessageIds,
        };
      });
    },
    [allSenderGroups],
  );

  const toggleMessage = useCallback((id: string) => {
    setSelection((prev) => {
      const newMessageIds = new Set(prev.selectedMessageIds);
      if (newMessageIds.has(id)) {
        newMessageIds.delete(id);
      } else {
        newMessageIds.add(id);
      }
      return { ...prev, selectedMessageIds: newMessageIds };
    });
  }, []);

  const getSelectedEmailCount = useCallback((): number => {
    // Sum counts for selected sender emails
    let count = 0;
    for (const email of selection.selectedSenderEmails) {
      const group = filteredSenderGroups.find((g) => g.sender.email === email);
      if (group) count += group.count;
    }

    // Add individually selected message IDs not already covered by a sender selection
    const coveredBySelectedSenders = new Set<string>();
    for (const email of selection.selectedSenderEmails) {
      const group = allSenderGroups.find((g) => g.sender.email === email);
      if (group) {
        for (const id of group.messageIds) {
          coveredBySelectedSenders.add(id);
        }
      }
    }

    for (const id of selection.selectedMessageIds) {
      if (!coveredBySelectedSenders.has(id)) {
        count += 1;
      }
    }

    return count;
  }, [selection, filteredSenderGroups, allSenderGroups]);

  const resolveSelectedMessageIds = useCallback((): string[] => {
    const result = new Set<string>();

    // All message IDs from selected senders
    for (const email of selection.selectedSenderEmails) {
      const group = allSenderGroups.find((g) => g.sender.email === email);
      if (group) {
        for (const id of group.messageIds) {
          result.add(id);
        }
      }
    }

    // Individually selected message IDs
    for (const id of selection.selectedMessageIds) {
      result.add(id);
    }

    return Array.from(result);
  }, [selection, allSenderGroups]);

  // ---------------------------------------------------------------------------
  // Post-deletion update
  // ---------------------------------------------------------------------------

  const removeDeletedMessages = useCallback((deletedIds: Set<string>) => {
    setSelection((prev) => {
      // Remove deleted IDs from selectedMessageIds
      const newMessageIds = new Set(prev.selectedMessageIds);
      for (const id of deletedIds) {
        newMessageIds.delete(id);
      }

      // For each selected sender, check if all their messages are deleted
      const newSenderEmails = new Set(prev.selectedSenderEmails);
      for (const email of prev.selectedSenderEmails) {
        const group = allSenderGroups.find((g) => g.sender.email === email);
        if (group) {
          const allDeleted = group.messageIds.every((id) => deletedIds.has(id));
          if (allDeleted) {
            newSenderEmails.delete(email);
          }
        }
      }

      return {
        selectedSenderEmails: newSenderEmails,
        selectedMessageIds: newMessageIds,
      };
    });
  }, [allSenderGroups]);

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------

  const value: ViewContextValue = {
    activeFilters,
    setTimeFilter,
    setSearchQuery,
    setShowSpamOnly,
    setGroupingMode,
    setTopN,
    allSenderGroups,
    filteredSenderGroups,
    filteredDomainGroups,
    topNGroups,
    totalEmailCount,
    uniqueSenderCount,
    filteredEmailCount,
    isFiltered,
    resetFilters,
    selection,
    selectAll,
    deselectAll,
    toggleSender,
    toggleMessage,
    getSelectedEmailCount,
    resolveSelectedMessageIds,
    removeDeletedMessages,
  };

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useView(): ViewContextValue {
  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error('useView must be used within ViewProvider');
  return ctx;
}
