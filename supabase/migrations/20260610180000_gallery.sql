-- Strategy gallery: user uploads, journal overrides, portfolios, and comments.

CREATE TABLE public.gallery_portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auction_strategy public.auction_strategy NOT NULL,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.gallery_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auction_strategy public.auction_strategy NOT NULL,
  portfolio_id uuid REFERENCES public.gallery_portfolios(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  title text,
  caption text,
  rank_score smallint CHECK (rank_score IS NULL OR (rank_score >= 1 AND rank_score <= 5)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.gallery_item_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  screenshot_index integer NOT NULL CHECK (screenshot_index >= 0),
  portfolio_id uuid REFERENCES public.gallery_portfolios(id) ON DELETE SET NULL,
  rank_score smallint CHECK (rank_score IS NULL OR (rank_score >= 1 AND rank_score <= 5)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, trade_id, screenshot_index)
);

CREATE TABLE public.gallery_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gallery_asset_id uuid REFERENCES public.gallery_assets(id) ON DELETE CASCADE,
  trade_id uuid REFERENCES public.trades(id) ON DELETE CASCADE,
  screenshot_index integer CHECK (screenshot_index IS NULL OR screenshot_index >= 0),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (gallery_asset_id IS NOT NULL AND trade_id IS NULL AND screenshot_index IS NULL)
    OR (gallery_asset_id IS NULL AND trade_id IS NOT NULL AND screenshot_index IS NOT NULL)
  )
);

CREATE INDEX gallery_portfolios_account_idx ON public.gallery_portfolios(account_id);
CREATE INDEX gallery_assets_account_idx ON public.gallery_assets(account_id);
CREATE INDEX gallery_assets_strategy_idx ON public.gallery_assets(account_id, auction_strategy);
CREATE INDEX gallery_item_overrides_account_idx ON public.gallery_item_overrides(account_id);
CREATE INDEX gallery_comments_account_idx ON public.gallery_comments(account_id);
CREATE INDEX gallery_comments_asset_idx ON public.gallery_comments(gallery_asset_id);
CREATE INDEX gallery_comments_journal_idx ON public.gallery_comments(trade_id, screenshot_index);

ALTER TABLE public.gallery_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_item_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY gallery_portfolios_account_scope
  ON public.gallery_portfolios
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.user_owns_trading_account(account_id))
  WITH CHECK (user_id = auth.uid() AND public.user_owns_trading_account(account_id));

CREATE POLICY gallery_assets_account_scope
  ON public.gallery_assets
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.user_owns_trading_account(account_id))
  WITH CHECK (user_id = auth.uid() AND public.user_owns_trading_account(account_id));

CREATE POLICY gallery_item_overrides_account_scope
  ON public.gallery_item_overrides
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.user_owns_trading_account(account_id))
  WITH CHECK (user_id = auth.uid() AND public.user_owns_trading_account(account_id));

CREATE POLICY gallery_comments_account_scope
  ON public.gallery_comments
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.user_owns_trading_account(account_id))
  WITH CHECK (user_id = auth.uid() AND public.user_owns_trading_account(account_id));
