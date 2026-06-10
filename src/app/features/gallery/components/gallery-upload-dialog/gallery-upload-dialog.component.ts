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
  selector: 'app-gallery-upload-dialog',
  imports: [FormsModule, ButtonModule, DialogModule, InputTextModule, SelectModule, TextareaModule],
  templateUrl: './gallery-upload-dialog.component.html',
  styleUrl: './gallery-upload-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GalleryUploadDialogComponent {
  readonly visible = input(false);
  readonly file = input<File | null>(null);
  readonly defaultStrategy = input<AuctionStrategy>('Level_Rejection');
  readonly portfolios = input<GalleryPortfolio[]>([]);
  readonly uploading = input(false);

  readonly visibleChange = output<boolean>();
  readonly confirm = output<{
    auctionStrategy: AuctionStrategy;
    title: string | null;
    caption: string | null;
    portfolioId: string | null;
    rankScore: number | null;
  }>();

  protected readonly strategyOptions = AUCTION_STRATEGY_OPTIONS;
  protected readonly auctionStrategy = signal<AuctionStrategy>('Level_Rejection');
  protected readonly title = signal('');
  protected readonly caption = signal('');
  protected readonly portfolioId = signal<string | null>(null);
  protected readonly rankScore = signal<number | null>(null);

  protected readonly portfolioOptions = signal<{ label: string; value: string | null }[]>([]);

  constructor() {
    effect(() => {
      if (!this.visible()) {
        return;
      }
      this.auctionStrategy.set(this.defaultStrategy());
      this.title.set('');
      this.caption.set('');
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
      auctionStrategy: this.auctionStrategy(),
      title: this.title().trim() || null,
      caption: this.caption().trim() || null,
      portfolioId: this.portfolioId(),
      rankScore: this.rankScore(),
    });
  }

  protected stars(): number[] {
    return [1, 2, 3, 4, 5];
  }

  protected setRank(rank: number): void {
    this.rankScore.set(this.rankScore() === rank ? null : rank);
  }
}
