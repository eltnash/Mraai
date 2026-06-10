import { Injectable, inject, signal } from '@angular/core';

import type { JournalVideoEmbed } from '../../core/models/database.types';
import type { JournalScreenshotScope } from './gatekeeper-screenshot-draft.service';
import { GatekeeperDraftService } from './gatekeeper-draft.service';

function scopeKey(scope: JournalScreenshotScope): string {
  return `${scope.kind}:${scope.id}`;
}

@Injectable({ providedIn: 'root' })
export class GatekeeperVideoDraftService {
  private readonly draftService = inject(GatekeeperDraftService);
  private readonly drafts = signal<Record<string, JournalVideoEmbed[]>>({});
  private readonly revision = signal(0);

  readonly revisionSnapshot = this.revision.asReadonly();

  getItems(scope: JournalScreenshotScope): JournalVideoEmbed[] {
    this.revisionSnapshot();
    const key = scopeKey(scope);
    const cached = this.drafts()[key];
    if (cached) {
      return cached;
    }
    return this.draftService.getVideoEmbeds(scope);
  }

  hydrateScope(scope: JournalScreenshotScope, embeds: JournalVideoEmbed[]): void {
    const key = scopeKey(scope);
    this.drafts.update((current) => ({ ...current, [key]: [...embeds] }));
    this.revision.update((n) => n + 1);
  }

  clearAll(): void {
    this.drafts.set({});
    this.revision.update((n) => n + 1);
  }

  async addEmbed(
    scope: JournalScreenshotScope,
    embed: JournalVideoEmbed,
  ): Promise<void> {
    const key = scopeKey(scope);
    const next = [...this.getItems(scope), embed];
    this.drafts.update((current) => ({ ...current, [key]: next }));
    await this.draftService.setVideoEmbeds(scope, next);
    this.revision.update((n) => n + 1);
  }

  async removeEmbed(scope: JournalScreenshotScope, embedId: string): Promise<void> {
    const key = scopeKey(scope);
    const next = this.getItems(scope).filter((item) => item.id !== embedId);
    this.drafts.update((current) => ({ ...current, [key]: next }));
    await this.draftService.setVideoEmbeds(scope, next);
    this.revision.update((n) => n + 1);
  }
}
