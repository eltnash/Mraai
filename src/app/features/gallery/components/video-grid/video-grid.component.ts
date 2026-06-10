import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import type { GalleryPortfolio } from '../../gallery.types';
import type { GalleryVideoItem } from '../../gallery-video.types';

@Component({
  selector: 'app-video-grid',
  imports: [DecimalPipe],
  templateUrl: './video-grid.component.html',
  styleUrl: './video-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoGridComponent {
  readonly items = input.required<GalleryVideoItem[]>();
  readonly portfolios = input<GalleryPortfolio[]>([]);

  readonly itemOpen = output<GalleryVideoItem>();
  readonly rankChange = output<{ item: GalleryVideoItem; rank: number }>();

  protected portfolioName(portfolioId: string | null): string | null {
    if (!portfolioId) {
      return null;
    }
    return this.portfolios().find((p) => p.id === portfolioId)?.name ?? null;
  }

  protected displayTitle(item: GalleryVideoItem): string {
    if (item.title) {
      return item.title;
    }
    if (item.journalIdShort) {
      return `Journal ${item.journalIdShort}`;
    }
    return 'YouTube video';
  }

  protected openItem(item: GalleryVideoItem): void {
    this.itemOpen.emit(item);
  }

  protected setRank(item: GalleryVideoItem, rank: number, event: Event): void {
    event.stopPropagation();
    this.rankChange.emit({ item, rank });
  }

  protected stars(): number[] {
    return [1, 2, 3, 4, 5];
  }
}
