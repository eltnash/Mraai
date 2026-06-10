-- Auction strategy: trader's rejection vs acceptance read at the level (Behavior step).
CREATE TYPE public.auction_strategy AS ENUM ('Level_Rejection', 'Level_Acceptance');

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS auction_strategy public.auction_strategy;

COMMENT ON COLUMN public.trades.auction_strategy IS
  'Trader-selected auction read on Behavior step: rejection (responsive) vs acceptance (initiative) at the level.';
