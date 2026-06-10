import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';

import {
  auctionStrategyLabel,
  auctionStrategyTagSeverity,
} from '../../../gatekeeper/auction-playbook.utils';
import type { OutcomeGalleryItem } from '../../dashboard.types';

@Component({
  selector: 'app-outcome-gallery',
  imports: [CurrencyPipe, DatePipe, DialogModule, TagModule],
  templateUrl: './outcome-gallery.component.html',
  styleUrl: './outcome-gallery.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OutcomeGalleryComponent {
  readonly items = input.required<OutcomeGalleryItem[]>();
  readonly currency = input('USD');
  readonly strategyLabel = input<string | null>(null);

  protected readonly preview = signal<OutcomeGalleryItem | null>(null);
  protected readonly strategyName = auctionStrategyLabel;
  protected readonly strategySeverity = auctionStrategyTagSeverity;

  protected openPreview(item: OutcomeGalleryItem): void {
    this.preview.set(item);
  }

  protected closePreview(): void {
    this.preview.set(null);
  }
}
