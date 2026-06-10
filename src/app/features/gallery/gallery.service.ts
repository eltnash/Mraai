import { Injectable, inject } from '@angular/core';

import { GalleryMediaService } from '../../core/supabase/gallery-media.service';
import type { AuctionStrategy, PillarJournalsSnapshot } from '../../core/models/database.types';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { formatJournalIdShort } from '../../shared/utils/journal-id.utils';
import {
  type GalleryAssetUpdate,
  type GalleryComment,
  type GalleryItem,
  type GalleryJournalOverrideInput,
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

interface RawGalleryOverride {
  id: string;
  trade_id: string;
  screenshot_index: number;
  portfolio_id: string | null;
  rank_score: number | null;
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

interface RawWinningTrade {
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
    const [portfolios, assets, overrides, comments, trades, audits] = await Promise.all([
      this.loadPortfolios(accountId),
      this.loadAssets(accountId),
      this.loadOverrides(accountId),
      this.loadComments(accountId),
      this.loadWinningTrades(accountId),
      this.loadAuditsForAccount(accountId),
    ]);

    const overrideMap = new Map(
      overrides.map((o) => [`${o.trade_id}:${o.screenshot_index}`, o]),
    );
    const commentCounts = this.buildCommentCounts(comments);

    const storagePaths = new Set<string>();
    for (const asset of assets) {
      storagePaths.add(asset.storage_path);
    }
    for (const trade of trades) {
      const screenshots = audits.get(trade.id)?.pillar_journals?.outcome?.screenshots ?? [];
      for (const shot of screenshots) {
        if (shot.storage_path) {
          storagePaths.add(shot.storage_path);
        }
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
    for (const trade of trades) {
      if (!trade.auction_strategy) {
        continue;
      }
      const screenshots = audits.get(trade.id)?.pillar_journals?.outcome?.screenshots ?? [];
      screenshots.forEach((shot, index) => {
        if (!shot.storage_path) {
          return;
        }
        const overrideKey = `${trade.id}:${index}`;
        const override = overrideMap.get(overrideKey);
        const itemId = journalGalleryItemId(trade.id, index);
        journalItems.push({
          id: itemId,
          source: 'journal',
          auctionStrategy: trade.auction_strategy!,
          imageUrl: urlMap.get(shot.storage_path) ?? '',
          storagePath: shot.storage_path,
          fileName: shot.file_name,
          title: null,
          caption: null,
          rankScore: override?.rank_score ?? null,
          portfolioId: override?.portfolio_id ?? null,
          editable: false,
          sortDate: trade.closed_at ?? trade.trading_date,
          commentCount: commentCounts.get(itemId) ?? 0,
          tradeId: trade.id,
          screenshotIndex: index,
          journalIdShort: formatJournalIdShort(trade.id),
          symbol: trade.symbol,
          netProfit: Number(trade.net_profit ?? 0),
          tradingDate: trade.trading_date,
          galleryAssetId: null,
        });
      });
    }

    const items = sortGalleryItems([...uploadItems, ...journalItems]);
    return { portfolios, items, comments };
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

  async updateAsset(assetId: string, update: GalleryAssetUpdate): Promise<void> {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (update.title !== undefined) payload['title'] = update.title;
    if (update.caption !== undefined) payload['caption'] = update.caption;
    if (update.auctionStrategy !== undefined) payload['auction_strategy'] = update.auctionStrategy;
    if (update.portfolioId !== undefined) payload['portfolio_id'] = update.portfolioId;
    if (update.rankScore !== undefined) payload['rank_score'] = update.rankScore;

    const { error } = await this.supabase.client.from('gallery_assets').update(payload).eq('id', assetId);
    if (error) {
      throw new Error(error.message);
    }
  }

  async deleteAsset(assetId: string, storagePath: string): Promise<void> {
    const { error } = await this.supabase.client.from('gallery_assets').delete().eq('id', assetId);
    if (error) {
      throw new Error(error.message);
    }
    await this.media.remove(storagePath);
  }

  async upsertJournalOverride(accountId: string, input: GalleryJournalOverrideInput): Promise<void> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { error } = await this.supabase.client.from('gallery_item_overrides').upsert(
      {
        account_id: accountId,
        user_id: user.id,
        trade_id: input.tradeId,
        screenshot_index: input.screenshotIndex,
        portfolio_id: input.portfolioId ?? null,
        rank_score: input.rankScore ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id,trade_id,screenshot_index' },
    );

    if (error) {
      throw new Error(error.message);
    }
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

  async updateComment(commentId: string, body: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('gallery_comments')
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

  private async loadOverrides(accountId: string): Promise<RawGalleryOverride[]> {
    const { data, error } = await this.supabase.client
      .from('gallery_item_overrides')
      .select('id, trade_id, screenshot_index, portfolio_id, rank_score')
      .eq('account_id', accountId);

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as RawGalleryOverride[];
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

  private async loadWinningTrades(accountId: string): Promise<RawWinningTrade[]> {
    const { data, error } = await this.supabase.client
      .from('trades')
      .select('id, auction_strategy, trading_date, net_profit, closed_at, symbol')
      .eq('account_id', accountId)
      .eq('status', 'CLOSED')
      .gt('net_profit', 0);

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as RawWinningTrade[];
  }

  private async loadAuditsForAccount(accountId: string): Promise<Map<string, RawAudit>> {
    const { data: tradeRows, error: tradeError } = await this.supabase.client
      .from('trades')
      .select('id')
      .eq('account_id', accountId)
      .eq('status', 'CLOSED')
      .gt('net_profit', 0);

    if (tradeError) {
      throw new Error(tradeError.message);
    }

    const tradeIds = (tradeRows ?? []).map((row) => row.id as string);
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
}
