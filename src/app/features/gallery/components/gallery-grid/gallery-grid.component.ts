import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TagModule } from 'primeng/tag';

import {
  auctionStrategyLabel,
  auctionStrategyTagSeverity,
} from '../../../gatekeeper/auction-playbook.utils';
import type { GalleryItem, GalleryPortfolio } from '../../gallery.types';

@Component({
  selector: 'app-gallery-grid',
  imports: [DecimalPipe, TagModule],
  templateUrl: './gallery-grid.component.html',
  styleUrl: './gallery-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GalleryGridComponent {
  readonly items = input.required<GalleryItem[]>();
  readonly portfolios = input<GalleryPortfolio[]>([]);
  readonly currency = input('USD');

  readonly itemOpen = output<GalleryItem>();
  readonly rankChange = output<{ item: GalleryItem; rank: number }>();

  protected readonly strategyName = auctionStrategyLabel;
  protected readonly strategySeverity = auctionStrategyTagSeverity;

  protected portfolioName(portfolioId: string | null): string | null {
    if (!portfolioId) {
      return null;
    }
    return this.portfolios().find((p) => p.id === portfolioId)?.name ?? null;
  }

  protected displayTitle(item: GalleryItem): string {
    if (item.title) {
      return item.title;
    }
    if (item.journalIdShort) {
      return `Journal ${item.journalIdShort}`;
    }
    return item.fileName;
  }

  protected openItem(item: GalleryItem): void {
    this.itemOpen.emit(item);
  }

  protected setRank(item: GalleryItem, rank: number, event: Event): void {
    event.stopPropagation();
    this.rankChange.emit({ item, rank });
  }

  protected stars(): number[] {
    return [1, 2, 3, 4, 5];
  }
}
