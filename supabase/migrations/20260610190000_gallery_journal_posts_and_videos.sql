-- Opt-in gallery posts for journal media + standalone video gallery.

CREATE TYPE public.gallery_journal_media_type AS ENUM ('image', 'video');

CREATE TABLE public.gallery_journal_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  media_type public.gallery_journal_media_type NOT NULL,
  screenshot_index integer,
  video_embed_id text,
  posted_at timestamptz NOT NULL DEFAULT now(),
  rank_score smallint CHECK (rank_score IS NULL OR (rank_score >= 1 AND rank_score <= 5)),
  portfolio_id uuid REFERENCES public.gallery_portfolios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (media_type = 'image' AND screenshot_index IS NOT NULL AND screenshot_index >= 0 AND video_embed_id IS NULL)
    OR (media_type = 'video' AND video_embed_id IS NOT NULL AND screenshot_index IS NULL)
  )
);

CREATE UNIQUE INDEX gallery_journal_posts_image_unique
  ON public.gallery_journal_posts(account_id, trade_id, screenshot_index)
  WHERE media_type = 'image';

CREATE UNIQUE INDEX gallery_journal_posts_video_unique
  ON public.gallery_journal_posts(account_id, trade_id, video_embed_id)
  WHERE media_type = 'video';

-- Migrate existing image overrides as posted items.
INSERT INTO public.gallery_journal_posts (
  account_id, user_id, trade_id, media_type, screenshot_index, posted_at, rank_score, portfolio_id
)
SELECT
  account_id, user_id, trade_id, 'image'::public.gallery_journal_media_type, screenshot_index,
  created_at, rank_score, portfolio_id
FROM public.gallery_item_overrides;

DROP TABLE public.gallery_item_overrides;

CREATE TABLE public.gallery_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auction_strategy public.auction_strategy NOT NULL,
  portfolio_id uuid REFERENCES public.gallery_portfolios(id) ON DELETE SET NULL,
  source_url text NOT NULL,
  embed_url text NOT NULL,
  youtube_video_id text NOT NULL,
  title text,
  caption text,
  published_at timestamptz,
  rank_score smallint CHECK (rank_score IS NULL OR (rank_score >= 1 AND rank_score <= 5)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.gallery_video_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gallery_video_id uuid REFERENCES public.gallery_videos(id) ON DELETE CASCADE,
  trade_id uuid REFERENCES public.trades(id) ON DELETE CASCADE,
  video_embed_id text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (gallery_video_id IS NOT NULL AND trade_id IS NULL AND video_embed_id IS NULL)
    OR (gallery_video_id IS NULL AND trade_id IS NOT NULL AND video_embed_id IS NOT NULL)
  )
);

CREATE INDEX gallery_journal_posts_account_idx ON public.gallery_journal_posts(account_id);
CREATE INDEX gallery_journal_posts_trade_idx ON public.gallery_journal_posts(trade_id);
CREATE INDEX gallery_videos_account_idx ON public.gallery_videos(account_id);
CREATE INDEX gallery_video_comments_account_idx ON public.gallery_video_comments(account_id);

ALTER TABLE public.gallery_journal_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_video_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY gallery_journal_posts_account_scope
  ON public.gallery_journal_posts
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.user_owns_trading_account(account_id))
  WITH CHECK (user_id = auth.uid() AND public.user_owns_trading_account(account_id));

CREATE POLICY gallery_videos_account_scope
  ON public.gallery_videos
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.user_owns_trading_account(account_id))
  WITH CHECK (user_id = auth.uid() AND public.user_owns_trading_account(account_id));

CREATE POLICY gallery_video_comments_account_scope
  ON public.gallery_video_comments
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.user_owns_trading_account(account_id))
  WITH CHECK (user_id = auth.uid() AND public.user_owns_trading_account(account_id));
