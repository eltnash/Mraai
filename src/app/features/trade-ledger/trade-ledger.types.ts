export interface TradeLedgerRow {
  tradeId: string;
  /** Same as tradeId when a journal session exists — shown in Trade History and Journal. */
  journalId: string;
  journalName: string | null;
  entryTime: string | null;
  ticket: string | null;
  side: 'buy' | 'sell';
  volume: number | null;
  symbol: string;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  exitTime: string | null;
  exitPrice: number | null;
  commission: number;
  fee: number;
  swap: number;
  profit: number | null;
  comment: string | null;
  closedAtStop: boolean;
  closedAtTakeProfit: boolean;
}

export interface TradeLedgerPage {
  rows: TradeLedgerRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface TradeLedgerPageTotals {
  commission: number;
  fee: number;
  swap: number;
  profit: number;
}

export const TRADE_LEDGER_PAGE_SIZE = 20;
