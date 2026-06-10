import type {
  HtfContextSnapshot,
  JournalNoteTag,
  PillarJournalsSnapshot,
  PillarStepKey,
  QualificationPillarKey,
} from '../../core/models/database.types';
import type { EnrichedTradeRow, SetupAnalyticsRow, TradeJournalTag } from './dashboard.types';
import {
  confidenceLevelForCount,
  determineEdgeStatus,
} from './trading-metrics.utils';

const QUALIFICATION_PILLARS: QualificationPillarKey[] = [
  'location',
  'behavior',
  'confirmation',
  'invalidation',
];

const PILLAR_LABELS: Record<string, string> = {
  location: 'Location notes',
  behavior: 'Behavior notes',
  confirmation: 'Confirmation notes',
  invalidation: 'Invalidation notes',
  outcome: 'Outcome notes',
  htf: 'HTF notes',
};

const MIN_TAG_TRADES = 2;
const MIN_PAIR_TRADES = 2;

export function normalizeTagLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

function collectTagsFromJournal(
  tags: JournalNoteTag[],
  source: PillarStepKey | 'htf',
  htfTimeframe?: string,
): TradeJournalTag[] {
  const seen = new Set<string>();
  const result: TradeJournalTag[] = [];

  for (const tag of tags) {
    const label = tag.label?.trim();
    if (!label) continue;
    const normalized = normalizeTagLabel(label);
    if (!normalized) continue;
    const dedupeKey = `${source}:${htfTimeframe ?? ''}:${normalized}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result.push({ label, normalized, source, htfTimeframe });
  }

  return result;
}

export function extractJournalTagsFromAudit(audit: {
  pillar_journals?: PillarJournalsSnapshot | null;
  htf_context?: HtfContextSnapshot | null;
} | null | undefined): TradeJournalTag[] {
  if (!audit) return [];

  const tags: TradeJournalTag[] = [];
  const journals = audit.pillar_journals;

  if (journals) {
    for (const pillar of QUALIFICATION_PILLARS) {
      tags.push(...collectTagsFromJournal(journals[pillar].note_tags ?? [], pillar));
    }
    tags.push(...collectTagsFromJournal(journals.outcome?.note_tags ?? [], 'outcome'));
  }

  for (const entry of audit.htf_context?.timeframe_entries ?? []) {
    tags.push(
      ...collectTagsFromJournal(entry.note_tags ?? [], 'htf', entry.timeframe),
    );
  }

  return tags;
}

function canonicalLabel(labels: string[]): string {
  if (labels.length === 0) return '';
  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

function buildTagSetupRow(
  key: string,
  label: string,
  dimension: SetupAnalyticsRow['dimension'],
  slice: EnrichedTradeRow[],
  totalTrades: number,
  extras: Partial<SetupAnalyticsRow> = {},
): SetupAnalyticsRow {
  const count = slice.length;
  const pnls = slice.map((t) => Number(t.net_profit ?? 0));
  const wins = pnls.filter((p) => p > 0).length;
  const grossProfit = pnls.filter((p) => p > 0).reduce((s, p) => s + p, 0);
  const grossLoss = Math.abs(pnls.filter((p) => p < 0).reduce((s, p) => s + p, 0));
  const total = pnls.reduce((s, p) => s + p, 0);
  const rs = slice.map((t) => t.computed_r).filter((r): r is number => r != null);
  const expR = rs.length > 0 ? rs.reduce((s, r) => s + r, 0) / rs.length : null;
  const pf = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : 0;
  const maxDdPct = 0;

  return {
    dimension,
    key,
    label,
    tradeCount: count,
    winRate: count > 0 ? wins / count : 0,
    expectancyR: expR,
    expectancyDollars: count > 0 ? total / count : 0,
    profitFactor: pf,
    avgR: expR,
    confidenceLevel: confidenceLevelForCount(count),
    edgeStatus: determineEdgeStatus(count, expR, count > 0 ? total / count : 0, pf, maxDdPct),
    tagFrequencyPct: totalTrades > 0 ? count / totalTrades : 0,
    ...extras,
  };
}

export function computeNoteTagSetupRows(trades: EnrichedTradeRow[]): SetupAnalyticsRow[] {
  if (trades.length === 0) return [];

  const groups = new Map<
    string,
    { labels: string[]; source: string; trades: EnrichedTradeRow[] }
  >();

  for (const trade of trades) {
    const tradeTags = trade.journal_tags ?? [];
    const seenOnTrade = new Set<string>();

    for (const tag of tradeTags) {
      const key = `${tag.source}:${tag.htfTimeframe ?? ''}:${tag.normalized}`;
      if (seenOnTrade.has(key)) continue;
      seenOnTrade.add(key);

      const bucket = groups.get(key) ?? {
        labels: [],
        source: tag.htfTimeframe ? `htf (${tag.htfTimeframe})` : tag.source,
        trades: [],
      };
      bucket.labels.push(tag.label);
      bucket.trades.push(trade);
      groups.set(key, bucket);
    }
  }

  return [...groups.entries()]
    .filter(([, g]) => g.trades.length >= MIN_TAG_TRADES)
    .map(([key, g]) => {
      const display = canonicalLabel(g.labels);
      const pillarLabel = PILLAR_LABELS[g.source] ?? g.source;
      return buildTagSetupRow(
        key,
        display,
        'note_tag',
        g.trades,
        trades.length,
        {
          pillarSource: pillarLabel,
        },
      );
    })
    .sort((a, b) => (b.expectancyR ?? -999) - (a.expectancyR ?? -999));
}

export function computeTagPairSetupRows(trades: EnrichedTradeRow[]): SetupAnalyticsRow[] {
  if (trades.length === 0) return [];

  const pairGroups = new Map<
    string,
    {
      labelA: string;
      labelB: string;
      sourceA: string;
      sourceB: string;
      trades: EnrichedTradeRow[];
    }
  >();

  for (const trade of trades) {
    const tags = trade.journal_tags ?? [];
    const unique = new Map<string, TradeJournalTag>();
    for (const tag of tags) {
      const id = `${tag.source}:${tag.htfTimeframe ?? ''}:${tag.normalized}`;
      if (!unique.has(id)) unique.set(id, tag);
    }

    const list = [...unique.values()];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const ids = [a.normalized, b.normalized].sort();
        const pairKey = `${ids[0]}||${ids[1]}`;
        const bucket = pairGroups.get(pairKey) ?? {
          labelA: a.label,
          labelB: b.label,
          sourceA: a.source,
          sourceB: b.source,
          trades: [],
        };
        bucket.trades.push(trade);
        pairGroups.set(pairKey, bucket);
      }
    }
  }

  return [...pairGroups.entries()]
    .filter(([, g]) => g.trades.length >= MIN_PAIR_TRADES)
    .map(([key, g]) =>
      buildTagSetupRow(
        key,
        `${g.labelA} + ${g.labelB}`,
        'tag_pair',
        g.trades,
        trades.length,
        {
          pillarSource: `${PILLAR_LABELS[g.sourceA] ?? g.sourceA} × ${PILLAR_LABELS[g.sourceB] ?? g.sourceB}`,
          pairCooccurrence: g.trades.length,
        },
      ),
    )
    .sort((a, b) => (b.pairCooccurrence ?? 0) - (a.pairCooccurrence ?? 0));
}
