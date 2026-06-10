import type { AuctionStrategy } from '../../core/models/database.types';
import type { GalleryItemSource, GallerySourceFilter } from './gallery.types';

export type GalleryVideoItemSource = GalleryItemSource;

export interface GalleryVideoItem {
  id: string;
  source: GalleryVideoItemSource;
  auctionStrategy: AuctionStrategy;
  embedUrl: string;
  sourceUrl: string;
  youtubeVideoId: string;
  thumbnailUrl: string;
  title: string | null;
  caption: string | null;
  publishedAt: string | null;
  rankScore: number | null;
  portfolioId: string | null;
  editable: boolean;
  sortDate: string;
  postedAt: string | null;
  commentCount: number;
  tradeId: string | null;
  videoEmbedId: string | null;
  journalIdShort: string | null;
  symbol: string | null;
  netProfit: number | null;
  tradingDate: string | null;
  galleryVideoId: string | null;
}

export interface GalleryVideoComment {
  id: string;
  body: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  galleryVideoId: string | null;
  tradeId: string | null;
  videoEmbedId: string | null;
}

export interface GalleryVideoUploadInput {
  sourceUrl: string;
  auctionStrategy: AuctionStrategy;
  title?: string | null;
  caption?: string | null;
  publishedAt?: string | null;
  portfolioId?: string | null;
  rankScore?: number | null;
}

export interface GalleryVideoUpdate {
  title?: string | null;
  caption?: string | null;
  auctionStrategy?: AuctionStrategy;
  portfolioId?: string | null;
  rankScore?: number | null;
  publishedAt?: string | null;
}

export interface GalleryVideoJournalPostUpdate {
  tradeId: string;
  videoEmbedId: string;
  portfolioId?: string | null;
  rankScore?: number | null;
}

export function journalGalleryVideoItemId(tradeId: string, videoEmbedId: string): string {
  return `journal-video:${tradeId}:${videoEmbedId}`;
}

export function sortGalleryVideos(items: GalleryVideoItem[]): GalleryVideoItem[] {
  return [...items].sort((a, b) => {
    const pubA = a.publishedAt ?? '';
    const pubB = b.publishedAt ?? '';
    if (pubA !== pubB) {
      return pubB.localeCompare(pubA);
    }
    const rankA = a.rankScore ?? 0;
    const rankB = b.rankScore ?? 0;
    if (rankA !== rankB) {
      return rankB - rankA;
    }
    const postedA = a.postedAt ?? a.sortDate;
    const postedB = b.postedAt ?? b.sortDate;
    return postedB.localeCompare(postedA);
  });
}

export type GalleryMediaMode = 'images' | 'videos';
export type { GallerySourceFilter };
