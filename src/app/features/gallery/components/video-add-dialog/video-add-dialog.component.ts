import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';

import type { AuctionStrategy } from '../../../../core/models/database.types';
import { AUCTION_STRATEGY_OPTIONS } from '../../../../core/supabase/enum-options';
import type { GalleryPortfolio } from '../../gallery.types';

@Component({
  selector: 'app-video-add-dialog',
  imports: [FormsModule, ButtonModule, DialogModule, InputTextModule, SelectModule, TextareaModule],
  templateUrl: './video-add-dialog.component.html',
  styleUrl: './video-add-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoAddDialogComponent {
  readonly visible = input(false);
  readonly defaultStrategy = input<AuctionStrategy>('Level_Rejection');
  readonly portfolios = input<GalleryPortfolio[]>([]);
  readonly saving = input(false);

  readonly visibleChange = output<boolean>();
  readonly confirm = output<{
    sourceUrl: string;
    auctionStrategy: AuctionStrategy;
    title: string | null;
    caption: string | null;
    publishedAt: string | null;
    portfolioId: string | null;
    rankScore: number | null;
  }>();

  protected readonly strategyOptions = AUCTION_STRATEGY_OPTIONS;
  protected readonly sourceUrl = signal('');
  protected readonly auctionStrategy = signal<AuctionStrategy>('Level_Rejection');
  protected readonly title = signal('');
  protected readonly caption = signal('');
  protected readonly publishedAt = signal('');
  protected readonly portfolioId = signal<string | null>(null);
  protected readonly rankScore = signal<number | null>(null);
  protected readonly portfolioOptions = signal<{ label: string; value: string | null }[]>([]);

  constructor() {
    effect(() => {
      if (!this.visible()) {
        return;
      }
      this.auctionStrategy.set(this.defaultStrategy());
      this.sourceUrl.set('');
      this.title.set('');
      this.caption.set('');
      this.publishedAt.set('');
      this.portfolioId.set(null);
      this.rankScore.set(null);
      this.refreshPortfolioOptions();
    });
  }

  protected onVisibleChange(open: boolean): void {
    if (!open) {
      this.visibleChange.emit(false);
    }
  }

  protected onStrategyChange(strategy: AuctionStrategy): void {
    this.auctionStrategy.set(strategy);
    this.portfolioId.set(null);
    this.refreshPortfolioOptions();
  }

  protected refreshPortfolioOptions(): void {
    this.portfolioOptions.set([
      { label: 'No portfolio', value: null },
      ...this.portfolios()
        .filter((p) => p.auctionStrategy === this.auctionStrategy())
        .map((p) => ({ label: p.name, value: p.id })),
    ]);
  }

  protected submit(): void {
    this.confirm.emit({
      sourceUrl: this.sourceUrl().trim(),
      auctionStrategy: this.auctionStrategy(),
      title: this.title().trim() || null,
      caption: this.caption().trim() || null,
      publishedAt: this.publishedAt().trim() || null,
      portfolioId: this.portfolioId(),
      rankScore: this.rankScore(),
    });
  }
}
