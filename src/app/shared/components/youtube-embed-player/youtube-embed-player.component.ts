import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'app-youtube-embed-player',
  imports: [DialogModule],
  templateUrl: './youtube-embed-player.component.html',
  styleUrl: './youtube-embed-player.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class YoutubeEmbedPlayerComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly visible = input(false);
  readonly embedUrl = input.required<string>();
  readonly title = input('Video');
  readonly visibleChange = output<boolean>();

  protected readonly safeEmbedUrl = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.embedUrl()),
  );
}
