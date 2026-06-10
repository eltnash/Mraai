import type { AuctionStrategy } from '../../core/models/database.types';
import type { GalleryVideoComment, GalleryVideoItem } from './gallery-video.types';

export type GalleryItemSource = 'upload' | 'journal';
export type GallerySourceFilter = 'all' | 'upload' | 'journal';

export interface GalleryPortfolio {
  id: string;
  accountId: string;
  auctionStrategy: AuctionStrategy;
  name: string;
  description: string | null;
  sortOrder: number;
}

export interface GalleryComment {
  id: string;
  body: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  galleryAssetId: string | null;
  tradeId: string | null;
  screenshotIndex: number | null;
}

export interface GalleryItem {
  id: string;
  source: GalleryItemSource;
  auctionStrategy: AuctionStrategy;
  imageUrl: string;
  storagePath: string;
  fileName: string;
  title: string | null;
  caption: string | null;
  rankScore: number | null;
  portfolioId: string | null;
  editable: boolean;
  sortDate: string;
  commentCount: number;
  tradeId: string | null;
  screenshotIndex: number | null;
  journalIdShort: string | null;
  symbol: string | null;
  netProfit: number | null;
  tradingDate: string | null;
  galleryAssetId: string | null;
  postedAt: string | null;
}

export interface GalleryPageData {
  portfolios: GalleryPortfolio[];
  items: GalleryItem[];
  comments: GalleryComment[];
  videos: GalleryVideoItem[];
  videoComments: GalleryVideoComment[];
}

export interface GalleryUploadInput {
  file: File;
  auctionStrategy: AuctionStrategy;
  title?: string | null;
  caption?: string | null;
  portfolioId?: string | null;
  rankScore?: number | null;
}

export interface GalleryAssetUpdate {
  title?: string | null;
  caption?: string | null;
  auctionStrategy?: AuctionStrategy;
  portfolioId?: string | null;
  rankScore?: number | null;
}

export interface GalleryJournalPostUpdate {
  tradeId: string;
  screenshotIndex: number;
  portfolioId?: string | null;
  rankScore?: number | null;
}

export function journalGalleryItemId(tradeId: string, screenshotIndex: number): string {
  return `journal:${tradeId}:${screenshotIndex}`;
}

export function sortGalleryItems(items: GalleryItem[]): GalleryItem[] {
  return [...items].sort((a, b) => {
    const postedA = a.postedAt ?? a.sortDate;
    const postedB = b.postedAt ?? b.sortDate;
    if (postedA !== postedB) {
      return postedB.localeCompare(postedA);
    }
    const rankA = a.rankScore ?? 0;
    const rankB = b.rankScore ?? 0;
    if (rankA !== rankB) {
      return rankB - rankA;
    }
    return b.sortDate.localeCompare(a.sortDate);
  });
}
