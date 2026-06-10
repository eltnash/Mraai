import type { TradingAccount } from '../models/database.types';

export type AccountRiskViolation =
  | 'capital_exhausted'
  | 'max_drawdown'
  | 'weekly_drawdown'
  | 'daily_drawdown';

export interface AccountRiskStatus {
  blocked: boolean;
  violations: AccountRiskViolation[];
  /** Closed-trade net P&amp;L for the current trading day (can be negative). */
  todayNetProfit: number;
  /** Closed-trade net P&amp;L for the current trading week (Mon–Fri, can be negative). */
  weekNetProfit: number;
  maxDrawdownPct: number;
  weeklyDrawdownPct: number;
  dailyDrawdownPct: number;
}

export function localTradingDateIso(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Trading week Mon–Fri in the user's local timezone. Sat/Sun use the prior Mon–Fri window. */
export function localWeekDateRange(date = new Date()): { start: string; end: string } {
  const cursor = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = cursor.getDay();

  if (weekday === 0) {
    cursor.setDate(cursor.getDate() - 2);
  } else if (weekday === 6) {
    cursor.setDate(cursor.getDate() - 1);
  }

  const adjustedWeekday = cursor.getDay();
  const daysFromMonday = adjustedWeekday === 0 ? 6 : adjustedWeekday - 1;
  const monday = new Date(cursor);
  monday.setDate(cursor.getDate() - daysFromMonday);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  return {
    start: localTradingDateIso(monday),
    end: localTradingDateIso(friday),
  };
}

export function evaluateAccountRisk(
  account: TradingAccount,
  todayNetProfit: number,
  weekNetProfit: number,
): AccountRiskStatus {
  const starting = Number(account.starting_capital ?? 0);
  const balance = Number(account.current_balance ?? starting);
  const maxLimit = Number(account.max_drawdown_pct ?? 0);
  const weeklyLimit = Number(account.weekly_drawdown_pct ?? 0);
  const dailyLimit = Number(account.daily_drawdown_pct ?? 0);

  const violations: AccountRiskViolation[] = [];

  if (balance <= 0) {
    violations.push('capital_exhausted');
  }

  if (starting > 0) {
    const maxDrawdownPct = ((starting - balance) / starting) * 100;
    if (maxDrawdownPct >= maxLimit) {
      violations.push('max_drawdown');
    }

    const weekLoss = weekNetProfit < 0 ? Math.abs(weekNetProfit) : 0;
    const weeklyDrawdownPct = (weekLoss / starting) * 100;
    if (weeklyDrawdownPct >= weeklyLimit) {
      violations.push('weekly_drawdown');
    }

    const todayLoss = todayNetProfit < 0 ? Math.abs(todayNetProfit) : 0;
    const dailyDrawdownPct = (todayLoss / starting) * 100;
    if (dailyDrawdownPct >= dailyLimit) {
      violations.push('daily_drawdown');
    }

    return {
      blocked: violations.length > 0,
      violations,
      todayNetProfit,
      weekNetProfit,
      maxDrawdownPct,
      weeklyDrawdownPct,
      dailyDrawdownPct,
    };
  }

  return {
    blocked: violations.length > 0,
    violations,
    todayNetProfit,
    weekNetProfit,
    maxDrawdownPct: 0,
    weeklyDrawdownPct: 0,
    dailyDrawdownPct: 0,
  };
}

export function riskViolationLabel(violation: AccountRiskViolation): string {
  switch (violation) {
    case 'capital_exhausted':
      return 'Account capital exhausted';
    case 'max_drawdown':
      return 'Max drawdown limit reached';
    case 'weekly_drawdown':
      return 'Weekly drawdown limit reached';
    case 'daily_drawdown':
      return 'Daily drawdown limit reached';
  }
}

export function formatRiskBlockMessage(status: AccountRiskStatus): string {
  if (!status.blocked) {
    return '';
  }

  const labels = status.violations.map(riskViolationLabel);
  return `${labels.join('. ')}. Update account rules in Settings to resume executions and new records.`;
}

export function formatRiskAlertDetail(status: AccountRiskStatus, currency = 'USD'): string {
  const money = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const details: string[] = status.violations.map(riskViolationLabel);

  if (status.violations.includes('max_drawdown')) {
    details.push(`total drawdown ${status.maxDrawdownPct.toFixed(2)}%`);
  }
  if (status.violations.includes('weekly_drawdown')) {
    const loss = status.weekNetProfit < 0 ? money(Math.abs(status.weekNetProfit)) : money(0);
    details.push(`Mon–Fri closed loss ${loss} (${status.weeklyDrawdownPct.toFixed(2)}% of capital)`);
  }
  if (status.violations.includes('daily_drawdown')) {
    const loss = status.todayNetProfit < 0 ? money(Math.abs(status.todayNetProfit)) : money(0);
    details.push(`today's closed loss ${loss} (${status.dailyDrawdownPct.toFixed(2)}% of capital)`);
  }

  return `${details.join(' · ')}. Executions and new journal records are paused until you update rules in Settings.`;
}
