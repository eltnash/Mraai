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
import { DomSanitizer } from '@angular/platform-browser';

import { AuthService } from '../../../../core/auth/auth.service';
import {
  auctionStrategyLabel,
  auctionStrategyTagSeverity,
} from '../../../gatekeeper/auction-playbook.utils';
import type { GalleryPortfolio } from '../../gallery.types';
import type { GalleryVideoComment, GalleryVideoItem } from '../../gallery-video.types';

@Component({
  selector: 'app-video-player-dialog',
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    SelectModule,
    TagModule,
    TextareaModule,
  ],
  templateUrl: './video-player-dialog.component.html',
  styleUrl: './video-player-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoPlayerDialogComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly auth = inject(AuthService);

  readonly visible = input(false);
  readonly item = input<GalleryVideoItem | null>(null);
  readonly items = input<GalleryVideoItem[]>([]);
  readonly comments = input<GalleryVideoComment[]>([]);
  readonly portfolios = input<GalleryPortfolio[]>([]);
  readonly currency = input('USD');
  readonly openingJournal = input(false);

  readonly visibleChange = output<boolean>();
  readonly navigate = output<GalleryVideoItem>();
  readonly rankChange = output<{ item: GalleryVideoItem; rank: number }>();
  readonly portfolioChange = output<{ item: GalleryVideoItem; portfolioId: string | null }>();
  readonly addComment = output<string>();
  readonly updateComment = output<{ commentId: string; body: string }>();
  readonly deleteComment = output<string>();
  readonly deleteItem = output<GalleryVideoItem>();
  readonly openJournal = output<GalleryVideoItem>();

  protected readonly newComment = signal('');
  protected readonly editingCommentId = signal<string | null>(null);
  protected readonly editingBody = signal('');

  protected readonly strategyName = auctionStrategyLabel;
  protected readonly strategySeverity = auctionStrategyTagSeverity;
  protected readonly currentUserId = computed(() => this.auth.user()?.id ?? null);

  protected readonly safeEmbedUrl = computed(() => {
    const url = this.item()?.embedUrl;
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  protected readonly itemComments = computed(() => {
    const current = this.item();
    if (!current) {
      return [];
    }
    return this.comments().filter((c) => {
      if (current.galleryVideoId) {
        return c.galleryVideoId === current.galleryVideoId;
      }
      return c.tradeId === current.tradeId && c.videoEmbedId === current.videoEmbedId;
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
    }
  }

  protected close(): void {
    this.visibleChange.emit(false);
  }

  protected setRank(rank: number): void {
    const current = this.item();
    if (current) {
      this.rankChange.emit({ item: current, rank });
    }
  }

  protected onPortfolioChange(portfolioId: string | null): void {
    const current = this.item();
    if (current) {
      this.portfolioChange.emit({ item: current, portfolioId });
    }
  }

  protected submitComment(): void {
    const body = this.newComment().trim();
    if (body) {
      this.addComment.emit(body);
      this.newComment.set('');
    }
  }

  protected stars(): number[] {
    return [1, 2, 3, 4, 5];
  }
}
