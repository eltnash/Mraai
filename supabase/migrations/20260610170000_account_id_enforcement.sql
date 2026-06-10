-- Enforce account_id on trades and gatekeeper_drafts; scope RLS to owned trading accounts.

CREATE OR REPLACE FUNCTION public.user_owns_trading_account(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trading_accounts
    WHERE id = p_account_id
      AND user_id = auth.uid()
  );
$$;

-- Backfill any remaining rows without account_id.
INSERT INTO public.trading_accounts (user_id, name, account_type)
SELECT DISTINCT user_id, 'Default Account', 'demo'::public.trading_account_type
FROM (
  SELECT user_id FROM public.trades WHERE account_id IS NULL
  UNION
  SELECT user_id FROM public.gatekeeper_drafts WHERE account_id IS NULL
) AS orphan_users
WHERE NOT EXISTS (
  SELECT 1 FROM public.trading_accounts ta
  WHERE ta.user_id = orphan_users.user_id AND ta.name = 'Default Account'
);

UPDATE public.trades t
SET account_id = ta.id
FROM public.trading_accounts ta
WHERE t.account_id IS NULL
  AND ta.user_id = t.user_id
  AND ta.name = 'Default Account';

UPDATE public.gatekeeper_drafts g
SET account_id = ta.id
FROM public.trading_accounts ta
WHERE g.account_id IS NULL
  AND ta.user_id = g.user_id
  AND ta.name = 'Default Account';

ALTER TABLE public.trades
  ALTER COLUMN account_id SET NOT NULL;

ALTER TABLE public.gatekeeper_drafts
  ALTER COLUMN account_id SET NOT NULL;

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gatekeeper_drafts_self ON public.gatekeeper_drafts;
CREATE POLICY gatekeeper_drafts_account_scope
  ON public.gatekeeper_drafts
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND public.user_owns_trading_account(account_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.user_owns_trading_account(account_id)
  );

DROP POLICY IF EXISTS trades_self ON public.trades;
DROP POLICY IF EXISTS trades_account_scope ON public.trades;
CREATE POLICY trades_account_scope
  ON public.trades
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND public.user_owns_trading_account(account_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.user_owns_trading_account(account_id)
  );
