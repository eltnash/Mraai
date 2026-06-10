import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';

import type { JournalVideoEmbed } from '../../../core/models/database.types';
import { YoutubeEmbedPlayerComponent } from '../../../shared/components/youtube-embed-player/youtube-embed-player.component';
import { parseYoutubeUrl } from '../../../shared/utils/youtube-embed.utils';
import {
  GalleryJournalPostService,
  type GalleryJournalPostRow,
} from '../../gallery/gallery-journal-post.service';
import type { JournalScreenshotScope } from '../gatekeeper-screenshot-draft.service';
import { GatekeeperVideoDraftService } from '../gatekeeper-video-draft.service';
import { GatekeeperDraftService } from '../gatekeeper-draft.service';

@Component({
  selector: 'app-journal-videos-panel',
  imports: [
    FormsModule,
    ButtonModule,
    InputTextModule,
    MessageModule,
    YoutubeEmbedPlayerComponent,
  ],
  templateUrl: './journal-videos-panel.component.html',
  styleUrl: './journal-videos-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JournalVideosPanelComponent implements OnInit {
  private readonly videoDrafts = inject(GatekeeperVideoDraftService);
  private readonly draftService = inject(GatekeeperDraftService);
  private readonly galleryPosts = inject(GalleryJournalPostService);
  private readonly messageService = inject(MessageService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly scope = input.required<JournalScreenshotScope>();
  readonly title = input('Video links');
  readonly showGalleryActions = input(false);
  readonly tradeId = input<string | null>(null);
  readonly accountId = input<string | null>(null);

  protected readonly urlInput = signal('');
  protected readonly titleInput = signal('');
  protected readonly publishedInput = signal('');
  protected readonly addError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly playerOpen = signal(false);
  protected readonly playingEmbed = signal<JournalVideoEmbed | null>(null);
  protected readonly postedRows = signal<GalleryJournalPostRow[]>([]);
  protected readonly galleryBusyId = signal<string | null>(null);

  protected readonly videoItems = computed(() => {
    this.videoDrafts.revisionSnapshot();
    return this.videoDrafts.getItems(this.scope());
  });

  ngOnInit(): void {
    if (this.showGalleryActions() && this.tradeId()) {
      void this.refreshPosted();
    }
  }

  protected async addVideo(): Promise<void> {
    const parsed = parseYoutubeUrl(this.urlInput());
    if (!parsed) {
      this.addError.set('Paste a valid YouTube link, embed URL, or iframe embed code.');
      return;
    }

    const embed: JournalVideoEmbed = {
      id: crypto.randomUUID(),
      source_url: parsed.sourceUrl,
      embed_url: parsed.embedUrl,
      provider: 'youtube',
      title: this.titleInput().trim() || null,
      published_at: this.publishedInput().trim() || null,
    };

    this.saving.set(true);
    this.addError.set(null);
    try {
      await this.videoDrafts.addEmbed(this.scope(), embed);
      this.urlInput.set('');
      this.titleInput.set('');
      this.publishedInput.set('');
    } catch (err) {
      this.addError.set(err instanceof Error ? err.message : 'Could not save video link');
    } finally {
      this.saving.set(false);
      this.cdr.markForCheck();
    }
  }

  protected async removeVideo(embedId: string): Promise<void> {
    const tradeId = this.tradeId();
    const accountId = this.accountId();
    if (this.isVideoPosted(embedId) && tradeId && accountId) {
      try {
        await this.galleryPosts.unpost({ tradeId, mediaType: 'video', videoEmbedId: embedId });
      } catch {
        // continue removing from journal
      }
    }
    await this.videoDrafts.removeEmbed(this.scope(), embedId);
    await this.refreshPosted();
    this.cdr.markForCheck();
  }

  protected openPlayer(embed: JournalVideoEmbed): void {
    this.playingEmbed.set(embed);
    this.playerOpen.set(true);
  }

  protected closePlayer(): void {
    this.playerOpen.set(false);
    this.playingEmbed.set(null);
  }

  protected displayTitle(embed: JournalVideoEmbed): string {
    return embed.title ?? 'YouTube video';
  }

  protected thumbnail(embed: JournalVideoEmbed): string {
    const match = embed.embed_url.match(/embed\/([^?]+)/);
    const videoId = match?.[1];
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
  }

  protected isVideoPosted(embedId: string): boolean {
    return this.galleryPosts.isVideoPosted(this.postedRows(), embedId);
  }

  protected async toggleGalleryPost(embed: JournalVideoEmbed): Promise<void> {
    const tradeId = this.tradeId();
    const accountId = this.accountId();
    if (!tradeId || !accountId) {
      return;
    }

    this.galleryBusyId.set(embed.id);
    try {
      if (this.isVideoPosted(embed.id)) {
        await this.galleryPosts.unpost({ tradeId, mediaType: 'video', videoEmbedId: embed.id });
        this.messageService.add({ severity: 'info', summary: 'Gallery', detail: 'Removed from gallery.' });
      } else {
        await this.galleryPosts.post(accountId, {
          tradeId,
          mediaType: 'video',
          videoEmbedId: embed.id,
        });
        this.messageService.add({ severity: 'success', summary: 'Gallery', detail: 'Posted to gallery.' });
      }
      await this.refreshPosted();
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Gallery',
        detail: err instanceof Error ? err.message : 'Could not update gallery',
      });
    } finally {
      this.galleryBusyId.set(null);
      this.cdr.markForCheck();
    }
  }

  private async refreshPosted(): Promise<void> {
    const tradeId = this.tradeId();
    if (!tradeId) {
      return;
    }
    this.postedRows.set(await this.galleryPosts.loadPostedForTrade(tradeId));
  }
}
