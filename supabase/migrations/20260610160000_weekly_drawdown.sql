-- Weekly drawdown limit; hierarchy: daily <= weekly <= max (enforced in app).
ALTER TABLE public.trading_accounts
  ADD COLUMN IF NOT EXISTS weekly_drawdown_pct NUMERIC(5, 2);

COMMENT ON COLUMN public.trading_accounts.weekly_drawdown_pct IS
  'Max closed-trade loss allowed in the current trading week (Mon-Fri) as % of starting capital. Must be >= daily and <= max drawdown.';

-- Backfill: place weekly between daily and max when missing.
UPDATE public.trading_accounts
SET weekly_drawdown_pct = LEAST(
  COALESCE(max_drawdown_pct, 10),
  GREATEST(
    COALESCE(daily_drawdown_pct, 5),
    COALESCE(daily_drawdown_pct, 5) * 2
  )
)
WHERE weekly_drawdown_pct IS NULL
  AND daily_drawdown_pct IS NOT NULL
  AND max_drawdown_pct IS NOT NULL;

UPDATE public.trading_accounts
SET weekly_drawdown_pct = COALESCE(daily_drawdown_pct, 5)
WHERE weekly_drawdown_pct IS NULL;
