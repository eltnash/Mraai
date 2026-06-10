export interface DrawdownLimits {
  daily_drawdown_pct: number;
  weekly_drawdown_pct: number;
  max_drawdown_pct: number;
}

export function validateDrawdownHierarchy(limits: DrawdownLimits): string | null {
  const { daily_drawdown_pct: daily, weekly_drawdown_pct: weekly, max_drawdown_pct: max } = limits;

  if (daily <= 0 || weekly <= 0 || max <= 0) {
    return 'Drawdown limits must be greater than zero.';
  }
  if (weekly < daily) {
    return 'Weekly drawdown must be at least the daily limit.';
  }
  if (max < weekly) {
    return 'Max drawdown must be at least the weekly limit.';
  }

  return null;
}
