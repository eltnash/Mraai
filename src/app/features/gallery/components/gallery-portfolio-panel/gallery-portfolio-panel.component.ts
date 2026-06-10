import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';

import type { AuctionStrategy } from '../../../../core/models/database.types';
import type { GalleryPortfolio } from '../../gallery.types';

@Component({
  selector: 'app-gallery-portfolio-panel',
  imports: [FormsModule, ButtonModule, DialogModule, InputTextModule, TextareaModule],
  templateUrl: './gallery-portfolio-panel.component.html',
  styleUrl: './gallery-portfolio-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GalleryPortfolioPanelComponent {
  readonly portfolios = input<GalleryPortfolio[]>([]);
  readonly activeStrategy = input.required<AuctionStrategy>();
  readonly selectedPortfolioId = input<string | null>(null);
  readonly saving = input(false);

  readonly portfolioSelect = output<string | null>();
  readonly createPortfolio = output<{ name: string; description: string | null }>();
  readonly deletePortfolio = output<string>();

  protected readonly createOpen = signal(false);
  protected readonly newName = signal('');
  protected readonly newDescription = signal('');

  protected strategyPortfolios(): GalleryPortfolio[] {
    return this.portfolios().filter((p) => p.auctionStrategy === this.activeStrategy());
  }

  protected openCreate(): void {
    this.newName.set('');
    this.newDescription.set('');
    this.createOpen.set(true);
  }

  protected submitCreate(): void {
    const name = this.newName().trim();
    if (!name) {
      return;
    }
    this.createPortfolio.emit({
      name,
      description: this.newDescription().trim() || null,
    });
    this.createOpen.set(false);
  }
}
