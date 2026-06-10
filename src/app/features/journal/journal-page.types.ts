export type JournalViewMode = 'cards' | 'list';

export type JournalSortField =
  | 'created_at'
  | 'updated_at'
  | 'trading_date'
  | 'journal_name'
  | 'progress';

export type JournalSortDirection = 'asc' | 'desc';

export const JOURNAL_VIEW_STORAGE_KEY = 'dqos.journal.viewMode';
export const JOURNAL_SORT_FIELD_STORAGE_KEY = 'dqos.journal.sortField';
export const JOURNAL_SORT_DIR_STORAGE_KEY = 'dqos.journal.sortDirection';
