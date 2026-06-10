/** Short journal id for tables (first UUID segment, e.g. `1b699bfc`). */
export function formatJournalIdShort(id: string): string {
  const segment = id.split('-')[0];
  return segment && segment.length > 0 ? segment : id.slice(0, 8);
}
