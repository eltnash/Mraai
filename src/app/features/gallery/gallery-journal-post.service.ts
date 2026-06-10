import { Injectable, inject } from '@angular/core';

import { SupabaseService } from '../../core/supabase/supabase.service';

export type GalleryJournalMediaType = 'image' | 'video';

export interface GalleryJournalPostKey {
  tradeId: string;
  mediaType: GalleryJournalMediaType;
  screenshotIndex?: number;
  videoEmbedId?: string;
}

export interface GalleryJournalPostRow {
  id: string;
  tradeId: string;
  mediaType: GalleryJournalMediaType;
  screenshotIndex: number | null;
  videoEmbedId: string | null;
  postedAt: string;
  rankScore: number | null;
  portfolioId: string | null;
}

@Injectable({ providedIn: 'root' })
export class GalleryJournalPostService {
  private readonly supabase = inject(SupabaseService);

  async loadPostedForTrade(tradeId: string): Promise<GalleryJournalPostRow[]> {
    const { data, error } = await this.supabase.client
      .from('gallery_journal_posts')
      .select('id, trade_id, media_type, screenshot_index, video_embed_id, posted_at, rank_score, portfolio_id')
      .eq('trade_id', tradeId);

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => ({
      id: row.id as string,
      tradeId: row.trade_id as string,
      mediaType: row.media_type as GalleryJournalMediaType,
      screenshotIndex: row.screenshot_index as number | null,
      videoEmbedId: row.video_embed_id as string | null,
      postedAt: row.posted_at as string,
      rankScore: row.rank_score as number | null,
      portfolioId: row.portfolio_id as string | null,
    }));
  }

  isImagePosted(posts: GalleryJournalPostRow[], screenshotIndex: number): boolean {
    return posts.some((p) => p.mediaType === 'image' && p.screenshotIndex === screenshotIndex);
  }

  isVideoPosted(posts: GalleryJournalPostRow[], videoEmbedId: string): boolean {
    return posts.some((p) => p.mediaType === 'video' && p.videoEmbedId === videoEmbedId);
  }

  async post(accountId: string, key: GalleryJournalPostKey): Promise<void> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { error } = await this.supabase.client.from('gallery_journal_posts').insert({
      account_id: accountId,
      user_id: user.id,
      trade_id: key.tradeId,
      media_type: key.mediaType,
      screenshot_index: key.mediaType === 'image' ? key.screenshotIndex ?? null : null,
      video_embed_id: key.mediaType === 'video' ? key.videoEmbedId ?? null : null,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  async unpost(key: GalleryJournalPostKey): Promise<void> {
    let query = this.supabase.client
      .from('gallery_journal_posts')
      .delete()
      .eq('trade_id', key.tradeId)
      .eq('media_type', key.mediaType);

    if (key.mediaType === 'image') {
      query = query.eq('screenshot_index', key.screenshotIndex ?? -1);
    } else {
      query = query.eq('video_embed_id', key.videoEmbedId ?? '');
    }

    const { error } = await query;
    if (error) {
      throw new Error(error.message);
    }
  }
}
