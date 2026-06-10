import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';

import { AuthService } from '../../../../core/auth/auth.service';
import {
  auctionStrategyLabel,
  auctionStrategyTagSeverity,
} from '../../../gatekeeper/auction-playbook.utils';
import type { GalleryComment, GalleryItem, GalleryPortfolio } from '../../gallery.types';

@Component({
  selector: 'app-gallery-lightbox',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    FormsModule,
    ButtonModule,
    DialogModule,
    SelectModule,
    TagModule,
    TextareaModule,
  ],
  templateUrl: './gallery-lightbox.component.html',
  styleUrl: './gallery-lightbox.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GalleryLightboxComponent {
  private readonly auth = inject(AuthService);

  readonly visible = input(false);
  readonly item = input<GalleryItem | null>(null);
  readonly items = input<GalleryItem[]>([]);
  readonly comments = input<GalleryComment[]>([]);
  readonly portfolios = input<GalleryPortfolio[]>([]);
  readonly currency = input('USD');
  readonly openingJournal = input(false);

  readonly visibleChange = output<boolean>();
  readonly navigate = output<GalleryItem>();
  readonly rankChange = output<{ item: GalleryItem; rank: number }>();
  readonly portfolioChange = output<{ item: GalleryItem; portfolioId: string | null }>();
  readonly addComment = output<string>();
  readonly updateComment = output<{ commentId: string; body: string }>();
  readonly deleteComment = output<string>();
  readonly editItem = output<GalleryItem>();
  readonly deleteItem = output<GalleryItem>();
  readonly openJournal = output<GalleryItem>();

  protected readonly zoom = signal(1);
  protected readonly newComment = signal('');
  protected readonly editingCommentId = signal<string | null>(null);
  protected readonly editingBody = signal('');

  protected readonly strategyName = auctionStrategyLabel;
  protected readonly strategySeverity = auctionStrategyTagSeverity;
  protected readonly currentUserId = computed(() => this.auth.user()?.id ?? null);

  protected readonly itemComments = computed(() => {
    const current = this.item();
    if (!current) {
      return [];
    }
    return this.comments().filter((c) => {
      if (current.galleryAssetId) {
        return c.galleryAssetId === current.galleryAssetId;
      }
      return c.tradeId === current.tradeId && c.screenshotIndex === current.screenshotIndex;
    });
  });

  protected readonly portfolioOptions = computed(() => {
    const current = this.item();
    if (!current) {
      return [];
    }
    return [
      { label: 'No portfolio', value: null as string | null },
      ...this.portfolios()
        .filter((p) => p.auctionStrategy === current.auctionStrategy)
        .map((p) => ({ label: p.name, value: p.id })),
    ];
  });

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (!this.visible()) {
      return;
    }
    if (event.key === 'Escape') {
      this.close();
    } else if (event.key === 'ArrowLeft') {
      this.goPrev();
    } else if (event.key === 'ArrowRight') {
      this.goNext();
    }
  }

  protected close(): void {
    this.zoom.set(1);
    this.visibleChange.emit(false);
  }

  protected zoomIn(): void {
    this.zoom.update((z) => Math.min(3, z + 0.25));
  }

  protected zoomOut(): void {
    this.zoom.update((z) => Math.max(0.5, z - 0.25));
  }

  protected resetZoom(): void {
    this.zoom.set(1);
  }

  protected setRank(rank: number): void {
    const current = this.item();
    if (!current) {
      return;
    }
    this.rankChange.emit({ item: current, rank });
  }

  protected onPortfolioChange(portfolioId: string | null): void {
    const current = this.item();
    if (!current) {
      return;
    }
    this.portfolioChange.emit({ item: current, portfolioId });
  }

  protected submitComment(): void {
    const body = this.newComment().trim();
    if (!body) {
      return;
    }
    this.addComment.emit(body);
    this.newComment.set('');
  }

  protected startEditComment(comment: GalleryComment): void {
    this.editingCommentId.set(comment.id);
    this.editingBody.set(comment.body);
  }

  protected saveEditComment(): void {
    const id = this.editingCommentId();
    const body = this.editingBody().trim();
    if (!id || !body) {
      return;
    }
    this.updateComment.emit({ commentId: id, body });
    this.editingCommentId.set(null);
    this.editingBody.set('');
  }

  protected cancelEditComment(): void {
    this.editingCommentId.set(null);
    this.editingBody.set('');
  }

  protected removeComment(commentId: string): void {
    this.deleteComment.emit(commentId);
  }

  protected goPrev(): void {
    const current = this.item();
    if (!current) {
      return;
    }
    const list = this.items();
    const idx = list.findIndex((i) => i.id === current.id);
    if (idx > 0) {
      this.zoom.set(1);
      this.navigate.emit(list[idx - 1]);
    }
  }

  protected goNext(): void {
    const current = this.item();
    if (!current) {
      return;
    }
    const list = this.items();
    const idx = list.findIndex((i) => i.id === current.id);
    if (idx >= 0 && idx < list.length - 1) {
      this.zoom.set(1);
      this.navigate.emit(list[idx + 1]);
    }
  }

  protected stars(): number[] {
    return [1, 2, 3, 4, 5];
  }
}
