import { Injectable, inject } from '@angular/core';

import { GalleryMediaService } from '../../core/supabase/gallery-media.service';
import type { AuctionStrategy, JournalVideoEmbed, PillarJournalsSnapshot } from '../../core/models/database.types';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { formatJournalIdShort } from '../../shared/utils/journal-id.utils';
import { parseYoutubeUrl, youtubeThumbnailUrl } from '../../shared/utils/youtube-embed.utils';
import {
  type GalleryVideoComment,
  type GalleryVideoItem,
  type GalleryVideoJournalPostUpdate,
  type GalleryVideoUpdate,
  type GalleryVideoUploadInput,
  journalGalleryVideoItemId,
  sortGalleryVideos,
} from './gallery-video.types';
import {
  type GalleryAssetUpdate,
  type GalleryComment,
  type GalleryItem,
  type GalleryJournalPostUpdate,
  type GalleryPageData,
  type GalleryPortfolio,
  type GalleryUploadInput,
  journalGalleryItemId,
  sortGalleryItems,
} from './gallery.types';

interface RawGalleryPortfolio {
  id: string;
  account_id: string;
  auction_strategy: AuctionStrategy;
  name: string;
  description: string | null;
  sort_order: number;
}

interface RawGalleryAsset {
  id: string;
  account_id: string;
  auction_strategy: AuctionStrategy;
  portfolio_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  title: string | null;
  caption: string | null;
  rank_score: number | null;
  created_at: string;
}

interface RawGalleryJournalPost {
  id: string;
  trade_id: string;
  media_type: 'image' | 'video';
  screenshot_index: number | null;
  video_embed_id: string | null;
  posted_at: string;
  rank_score: number | null;
  portfolio_id: string | null;
}

interface RawGalleryComment {
  id: string;
  user_id: string;
  body: string;
  gallery_asset_id: string | null;
  trade_id: string | null;
  screenshot_index: number | null;
  created_at: string;
  updated_at: string;
}

interface RawGalleryVideo {
  id: string;
  account_id: string;
  auction_strategy: AuctionStrategy;
  portfolio_id: string | null;
  source_url: string;
  embed_url: string;
  youtube_video_id: string;
  title: string | null;
  caption: string | null;
  published_at: string | null;
  rank_score: number | null;
  created_at: string;
}

interface RawGalleryVideoComment {
  id: string;
  user_id: string;
  body: string;
  gallery_video_id: string | null;
  trade_id: string | null;
  video_embed_id: string | null;
  created_at: string;
  updated_at: string;
}

interface RawTrade {
  id: string;
  auction_strategy: AuctionStrategy | null;
  trading_date: string;
  net_profit: number | null;
  closed_at: string | null;
  symbol: string;
}

interface RawAudit {
  trade_id: string;
  pillar_journals: PillarJournalsSnapshot | null;
}

@Injectable({ providedIn: 'root' })
export class GalleryService {
  private readonly supabase = inject(SupabaseService);
  private readonly media = inject(GalleryMediaService);

  async loadPageData(accountId: string): Promise<GalleryPageData> {
    const [portfolios, assets, posts, comments, videos, videoComments] = await Promise.all([
      this.loadPortfolios(accountId),
      this.loadAssets(accountId),
      this.loadJournalPosts(accountId),
      this.loadComments(accountId),
      this.loadStandaloneVideos(accountId),
      this.loadVideoComments(accountId),
    ]);

    const imagePosts = posts.filter((p) => p.media_type === 'image');
    const videoPosts = posts.filter((p) => p.media_type === 'video');

    const tradeIds = [...new Set(posts.map((p) => p.trade_id))];
    const [trades, audits] = await Promise.all([
      this.loadTradesByIds(tradeIds),
      this.loadAuditsForTradeIds(tradeIds),
    ]);

    const postMap = new Map(posts.map((p) => [this.postKey(p), p]));
    const commentCounts = this.buildCommentCounts(comments);
    const videoCommentCounts = this.buildVideoCommentCounts(videoComments);

    const storagePaths = new Set<string>(assets.map((a) => a.storage_path));
    for (const post of imagePosts) {
      const shot =
        audits.get(post.trade_id)?.pillar_journals?.outcome?.screenshots?.[post.screenshot_index ?? -1];
      if (shot?.storage_path) {
        storagePaths.add(shot.storage_path);
      }
    }

    const urlMap = await this.batchSignedUrls([...storagePaths]);

    const uploadItems: GalleryItem[] = assets.map((asset) => ({
      id: asset.id,
      source: 'upload',
      auctionStrategy: asset.auction_strategy,
      imageUrl: urlMap.get(asset.storage_path) ?? '',
      storagePath: asset.storage_path,
      fileName: asset.file_name,
      title: asset.title,
      caption: asset.caption,
      rankScore: asset.rank_score,
      portfolioId: asset.portfolio_id,
      editable: true,
      sortDate: asset.created_at,
      postedAt: null,
      commentCount: commentCounts.get(asset.id) ?? 0,
      tradeId: null,
      screenshotIndex: null,
      journalIdShort: null,
      symbol: null,
      netProfit: null,
      tradingDate: null,
      galleryAssetId: asset.id,
    }));

    const journalItems: GalleryItem[] = [];
    for (const post of imagePosts) {
      const trade = trades.get(post.trade_id);
      if (!trade?.auction_strategy) {
        continue;
      }
      const index = post.screenshot_index ?? -1;
      const shot = audits.get(post.trade_id)?.pillar_journals?.outcome?.screenshots?.[index];
      if (!shot?.storage_path) {
        continue;
      }
      const itemId = journalGalleryItemId(post.trade_id, index);
      journalItems.push({
        id: itemId,
        source: 'journal',
        auctionStrategy: trade.auction_strategy,
        imageUrl: urlMap.get(shot.storage_path) ?? '',
        storagePath: shot.storage_path,
        fileName: shot.file_name,
        title: null,
        caption: null,
        rankScore: post.rank_score,
        portfolioId: post.portfolio_id,
        editable: false,
        sortDate: trade.closed_at ?? trade.trading_date,
        postedAt: post.posted_at,
        commentCount: commentCounts.get(itemId) ?? 0,
        tradeId: post.trade_id,
        screenshotIndex: index,
        journalIdShort: formatJournalIdShort(post.trade_id),
        symbol: trade.symbol,
        netProfit: Number(trade.net_profit ?? 0),
        tradingDate: trade.trading_date,
        galleryAssetId: null,
      });
    }

    const uploadVideos: GalleryVideoItem[] = videos.map((video) => ({
      id: video.id,
      source: 'upload',
      auctionStrategy: video.auction_strategy,
      embedUrl: video.embed_url,
      sourceUrl: video.source_url,
      youtubeVideoId: video.youtube_video_id,
      thumbnailUrl: youtubeThumbnailUrl(video.youtube_video_id),
      title: video.title,
      caption: video.caption,
      publishedAt: video.published_at,
      rankScore: video.rank_score,
      portfolioId: video.portfolio_id,
      editable: true,
      sortDate: video.created_at,
      postedAt: null,
      commentCount: videoCommentCounts.get(video.id) ?? 0,
      tradeId: null,
      videoEmbedId: null,
      journalIdShort: null,
      symbol: null,
      netProfit: null,
      tradingDate: null,
      galleryVideoId: video.id,
    }));

    const journalVideos: GalleryVideoItem[] = [];
    for (const post of videoPosts) {
      const trade = trades.get(post.trade_id);
      const embedId = post.video_embed_id;
      if (!trade?.auction_strategy || !embedId) {
        continue;
      }
      const embed = this.findVideoEmbed(audits.get(post.trade_id), embedId);
      if (!embed) {
        continue;
      }
      const itemId = journalGalleryVideoItemId(post.trade_id, embedId);
      const videoId = embed.embed_url.match(/embed\/([^?]+)/)?.[1] ?? '';
      journalVideos.push({
        id: itemId,
        source: 'journal',
        auctionStrategy: trade.auction_strategy,
        embedUrl: embed.embed_url,
        sourceUrl: embed.source_url,
        youtubeVideoId: videoId,
        thumbnailUrl: youtubeThumbnailUrl(videoId),
        title: embed.title,
        caption: null,
        publishedAt: embed.published_at,
        rankScore: post.rank_score,
        portfolioId: post.portfolio_id,
        editable: false,
        sortDate: trade.closed_at ?? trade.trading_date,
        postedAt: post.posted_at,
        commentCount: videoCommentCounts.get(itemId) ?? 0,
        tradeId: post.trade_id,
        videoEmbedId: embedId,
        journalIdShort: formatJournalIdShort(post.trade_id),
        symbol: trade.symbol,
        netProfit: Number(trade.net_profit ?? 0),
        tradingDate: trade.trading_date,
        galleryVideoId: null,
      });
    }

    return {
      portfolios,
      items: sortGalleryItems([...uploadItems, ...journalItems]),
      comments,
      videos: sortGalleryVideos([...uploadVideos, ...journalVideos]),
      videoComments,
    };
  }

  async uploadAsset(accountId: string, input: GalleryUploadInput): Promise<void> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const uploaded = await this.media.upload(accountId, input.file);

    const { error } = await this.supabase.client.from('gallery_assets').insert({
      account_id: accountId,
      user_id: user.id,
      auction_strategy: input.auctionStrategy,
      portfolio_id: input.portfolioId ?? null,
      storage_path: uploaded.storagePath,
      file_name: uploaded.fileName,
      mime_type: uploaded.mimeType,
      title: input.title ?? null,
      caption: input.caption ?? null,
      rank_score: input.rankScore ?? null,
    });

    if (error) {
      await this.media.remove(uploaded.storagePath).catch(() => undefined);
      throw new Error(error.message);
    }
  }

  async uploadVideo(accountId: string, input: GalleryVideoUploadInput): Promise<void> {
    const parsed = parseYoutubeUrl(input.sourceUrl);
    if (!parsed) {
      throw new Error('Paste a valid YouTube link.');
    }

    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { error } = await this.supabase.client.from('gallery_videos').insert({
      account_id: accountId,
      user_id: user.id,
      auction_strategy: input.auctionStrategy,
      portfolio_id: input.portfolioId ?? null,
      source_url: parsed.sourceUrl,
      embed_url: parsed.embedUrl,
      youtube_video_id: parsed.videoId,
      title: input.title ?? null,
      caption: input.caption ?? null,
      published_at: input.publishedAt ?? null,
      rank_score: input.rankScore ?? null,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  async updateAsset(assetId: string, update: GalleryAssetUpdate): Promise<void> {
    await this.patchRow('gallery_assets', assetId, update as Record<string, unknown>, {
      title: 'title',
      caption: 'caption',
      auctionStrategy: 'auction_strategy',
      portfolioId: 'portfolio_id',
      rankScore: 'rank_score',
    });
  }

  async updateVideo(videoId: string, update: GalleryVideoUpdate): Promise<void> {
    await this.patchRow('gallery_videos', videoId, update as Record<string, unknown>, {
      title: 'title',
      caption: 'caption',
      auctionStrategy: 'auction_strategy',
      portfolioId: 'portfolio_id',
      rankScore: 'rank_score',
      publishedAt: 'published_at',
    });
  }

  async deleteAsset(assetId: string, storagePath: string): Promise<void> {
    const { error } = await this.supabase.client.from('gallery_assets').delete().eq('id', assetId);
    if (error) {
      throw new Error(error.message);
    }
    await this.media.remove(storagePath);
  }

  async deleteVideo(videoId: string): Promise<void> {
    const { error } = await this.supabase.client.from('gallery_videos').delete().eq('id', videoId);
    if (error) {
      throw new Error(error.message);
    }
  }

  async updateJournalImagePost(accountId: string, input: GalleryJournalPostUpdate): Promise<void> {
    await this.updateJournalPost(accountId, 'image', input.tradeId, {
      screenshot_index: input.screenshotIndex,
      portfolio_id: input.portfolioId ?? null,
      rank_score: input.rankScore ?? null,
    });
  }

  async updateJournalVideoPost(accountId: string, input: GalleryVideoJournalPostUpdate): Promise<void> {
    await this.updateJournalPost(accountId, 'video', input.tradeId, {
      video_embed_id: input.videoEmbedId,
      portfolio_id: input.portfolioId ?? null,
      rank_score: input.rankScore ?? null,
    });
  }

  async createPortfolio(
    accountId: string,
    auctionStrategy: AuctionStrategy,
    name: string,
    description?: string | null,
  ): Promise<GalleryPortfolio> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await this.supabase.client
      .from('gallery_portfolios')
      .insert({
        account_id: accountId,
        user_id: user.id,
        auction_strategy: auctionStrategy,
        name: name.trim(),
        description: description?.trim() || null,
      })
      .select('id, account_id, auction_strategy, name, description, sort_order')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Could not create portfolio');
    }

    return this.mapPortfolio(data as RawGalleryPortfolio);
  }

  async updatePortfolio(portfolioId: string, name: string, description?: string | null): Promise<void> {
    const { error } = await this.supabase.client
      .from('gallery_portfolios')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', portfolioId);

    if (error) {
      throw new Error(error.message);
    }
  }

  async deletePortfolio(portfolioId: string): Promise<void> {
    const { error } = await this.supabase.client.from('gallery_portfolios').delete().eq('id', portfolioId);
    if (error) {
      throw new Error(error.message);
    }
  }

  async addComment(
    accountId: string,
    body: string,
    target: { galleryAssetId: string } | { tradeId: string; screenshotIndex: number },
  ): Promise<GalleryComment> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await this.supabase.client
      .from('gallery_comments')
      .insert(
        'galleryAssetId' in target
          ? {
              account_id: accountId,
              user_id: user.id,
              body: body.trim(),
              gallery_asset_id: target.galleryAssetId,
              trade_id: null,
              screenshot_index: null,
            }
          : {
              account_id: accountId,
              user_id: user.id,
              body: body.trim(),
              gallery_asset_id: null,
              trade_id: target.tradeId,
              screenshot_index: target.screenshotIndex,
            },
      )
      .select('id, user_id, body, gallery_asset_id, trade_id, screenshot_index, created_at, updated_at')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Could not add comment');
    }

    return this.mapComment(data as RawGalleryComment);
  }

  async addVideoComment(
    accountId: string,
    body: string,
    target: { galleryVideoId: string } | { tradeId: string; videoEmbedId: string },
  ): Promise<GalleryVideoComment> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await this.supabase.client
      .from('gallery_video_comments')
      .insert(
        'galleryVideoId' in target
          ? {
              account_id: accountId,
              user_id: user.id,
              body: body.trim(),
              gallery_video_id: target.galleryVideoId,
              trade_id: null,
              video_embed_id: null,
            }
          : {
              account_id: accountId,
              user_id: user.id,
              body: body.trim(),
              gallery_video_id: null,
              trade_id: target.tradeId,
              video_embed_id: target.videoEmbedId,
            },
      )
      .select('id, user_id, body, gallery_video_id, trade_id, video_embed_id, created_at, updated_at')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Could not add comment');
    }

    return this.mapVideoComment(data as RawGalleryVideoComment);
  }

  async updateComment(commentId: string, body: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('gallery_comments')
      .update({ body: body.trim(), updated_at: new Date().toISOString() })
      .eq('id', commentId);
    if (error) {
      throw new Error(error.message);
    }
  }

  async updateVideoComment(commentId: string, body: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('gallery_video_comments')
      .update({ body: body.trim(), updated_at: new Date().toISOString() })
      .eq('id', commentId);
    if (error) {
      throw new Error(error.message);
    }
  }

  async deleteComment(commentId: string): Promise<void> {
    const { error } = await this.supabase.client.from('gallery_comments').delete().eq('id', commentId);
    if (error) {
      throw new Error(error.message);
    }
  }

  async deleteVideoComment(commentId: string): Promise<void> {
    const { error } = await this.supabase.client.from('gallery_video_comments').delete().eq('id', commentId);
    if (error) {
      throw new Error(error.message);
    }
  }

  private async updateJournalPost(
    accountId: string,
    mediaType: 'image' | 'video',
    tradeId: string,
    fields: Record<string, unknown>,
  ): Promise<void> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    let query = this.supabase.client
      .from('gallery_journal_posts')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('account_id', accountId)
      .eq('trade_id', tradeId)
      .eq('media_type', mediaType);

    if (mediaType === 'image') {
      query = query.eq('screenshot_index', fields['screenshot_index'] as number);
    } else {
      query = query.eq('video_embed_id', fields['video_embed_id'] as string);
    }

    const { error } = await query;
    if (error) {
      throw new Error(error.message);
    }
  }

  private async patchRow(
    table: string,
    id: string,
    update: Record<string, unknown>,
    fieldMap: Record<string, string>,
  ): Promise<void> {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const [key, column] of Object.entries(fieldMap)) {
      if (update[key] !== undefined) {
        payload[column] = update[key];
      }
    }
    const { error } = await this.supabase.client.from(table).update(payload).eq('id', id);
    if (error) {
      throw new Error(error.message);
    }
  }

  private postKey(post: RawGalleryJournalPost): string {
    if (post.media_type === 'image') {
      return `image:${post.trade_id}:${post.screenshot_index}`;
    }
    return `video:${post.trade_id}:${post.video_embed_id}`;
  }

  private findVideoEmbed(audit: RawAudit | undefined, embedId: string): JournalVideoEmbed | null {
    const embeds = audit?.pillar_journals?.outcome?.video_embeds ?? [];
    return embeds.find((e) => e.id === embedId) ?? null;
  }

  private async loadPortfolios(accountId: string): Promise<GalleryPortfolio[]> {
    const { data, error } = await this.supabase.client
      .from('gallery_portfolios')
      .select('id, account_id, auction_strategy, name, description, sort_order')
      .eq('account_id', accountId)
      .order('sort_order')
      .order('name');

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => this.mapPortfolio(row as RawGalleryPortfolio));
  }

  private async loadAssets(accountId: string): Promise<RawGalleryAsset[]> {
    const { data, error } = await this.supabase.client
      .from('gallery_assets')
      .select(
        'id, account_id, auction_strategy, portfolio_id, storage_path, file_name, mime_type, title, caption, rank_score, created_at',
      )
      .eq('account_id', accountId);

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as RawGalleryAsset[];
  }

  private async loadStandaloneVideos(accountId: string): Promise<RawGalleryVideo[]> {
    const { data, error } = await this.supabase.client
      .from('gallery_videos')
      .select(
        'id, account_id, auction_strategy, portfolio_id, source_url, embed_url, youtube_video_id, title, caption, published_at, rank_score, created_at',
      )
      .eq('account_id', accountId);

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as RawGalleryVideo[];
  }

  private async loadJournalPosts(accountId: string): Promise<RawGalleryJournalPost[]> {
    const { data, error } = await this.supabase.client
      .from('gallery_journal_posts')
      .select('id, trade_id, media_type, screenshot_index, video_embed_id, posted_at, rank_score, portfolio_id')
      .eq('account_id', accountId);

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as RawGalleryJournalPost[];
  }

  private async loadComments(accountId: string): Promise<GalleryComment[]> {
    const { data, error } = await this.supabase.client
      .from('gallery_comments')
      .select('id, user_id, body, gallery_asset_id, trade_id, screenshot_index, created_at, updated_at')
      .eq('account_id', accountId)
      .order('created_at');

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => this.mapComment(row as RawGalleryComment));
  }

  private async loadVideoComments(accountId: string): Promise<GalleryVideoComment[]> {
    const { data, error } = await this.supabase.client
      .from('gallery_video_comments')
      .select('id, user_id, body, gallery_video_id, trade_id, video_embed_id, created_at, updated_at')
      .eq('account_id', accountId)
      .order('created_at');

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => this.mapVideoComment(row as RawGalleryVideoComment));
  }

  private async loadTradesByIds(tradeIds: string[]): Promise<Map<string, RawTrade>> {
    if (tradeIds.length === 0) {
      return new Map();
    }

    const { data, error } = await this.supabase.client
      .from('trades')
      .select('id, auction_strategy, trading_date, net_profit, closed_at, symbol')
      .in('id', tradeIds)
      .eq('status', 'CLOSED');

    if (error) {
      throw new Error(error.message);
    }

    const map = new Map<string, RawTrade>();
    for (const row of (data ?? []) as RawTrade[]) {
      map.set(row.id, row);
    }
    return map;
  }

  private async loadAuditsForTradeIds(tradeIds: string[]): Promise<Map<string, RawAudit>> {
    if (tradeIds.length === 0) {
      return new Map();
    }

    const { data, error } = await this.supabase.client
      .from('execution_audits')
      .select('trade_id, pillar_journals')
      .in('trade_id', tradeIds);

    if (error) {
      throw new Error(error.message);
    }

    const map = new Map<string, RawAudit>();
    for (const row of (data ?? []) as RawAudit[]) {
      map.set(row.trade_id, row);
    }
    return map;
  }

  private buildCommentCounts(comments: GalleryComment[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const comment of comments) {
      let key: string | null = null;
      if (comment.galleryAssetId) {
        key = comment.galleryAssetId;
      } else if (comment.tradeId != null && comment.screenshotIndex != null) {
        key = journalGalleryItemId(comment.tradeId, comment.screenshotIndex);
      }
      if (key) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }

  private buildVideoCommentCounts(comments: GalleryVideoComment[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const comment of comments) {
      let key: string | null = null;
      if (comment.galleryVideoId) {
        key = comment.galleryVideoId;
      } else if (comment.tradeId && comment.videoEmbedId) {
        key = journalGalleryVideoItemId(comment.tradeId, comment.videoEmbedId);
      }
      if (key) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }

  private async batchSignedUrls(paths: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    await Promise.all(
      paths.map(async (path) => {
        try {
          const url = await this.media.signedUrl(path);
          map.set(path, url);
        } catch {
          // skip broken paths
        }
      }),
    );
    return map;
  }

  private mapPortfolio(row: RawGalleryPortfolio): GalleryPortfolio {
    return {
      id: row.id,
      accountId: row.account_id,
      auctionStrategy: row.auction_strategy,
      name: row.name,
      description: row.description,
      sortOrder: row.sort_order,
    };
  }

  private mapComment(row: RawGalleryComment): GalleryComment {
    return {
      id: row.id,
      userId: row.user_id,
      body: row.body,
      galleryAssetId: row.gallery_asset_id,
      tradeId: row.trade_id,
      screenshotIndex: row.screenshot_index,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapVideoComment(row: RawGalleryVideoComment): GalleryVideoComment {
    return {
      id: row.id,
      userId: row.user_id,
      body: row.body,
      galleryVideoId: row.gallery_video_id,
      tradeId: row.trade_id,
      videoEmbedId: row.video_embed_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
