import type { GatekeeperJournalSummary } from '../gatekeeper/gatekeeper-draft.types';
import type { JournalSortDirection, JournalSortField } from './journal-page.types';

export function sortJournals(
  journals: GatekeeperJournalSummary[],
  field: JournalSortField,
  direction: JournalSortDirection,
): GatekeeperJournalSummary[] {
  const mult = direction === 'asc' ? 1 : -1;
  return [...journals].sort((a, b) => mult * compareJournals(a, b, field));
}

function compareJournals(
  a: GatekeeperJournalSummary,
  b: GatekeeperJournalSummary,
  field: JournalSortField,
): number {
  switch (field) {
    case 'created_at':
      return a.created_at.localeCompare(b.created_at);
    case 'updated_at':
      return a.updated_at.localeCompare(b.updated_at);
    case 'trading_date':
      return a.trading_date.localeCompare(b.trading_date);
    case 'journal_name':
      return a.journal_name.localeCompare(b.journal_name, undefined, { sensitivity: 'base' });
    case 'progress':
      return a.step_progress.progressPct - b.step_progress.progressPct;
    default:
      return 0;
  }
}
