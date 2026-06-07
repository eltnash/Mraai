import { Injectable, signal } from '@angular/core';

import type { AnalyzedTimeframe } from '../../core/models/database.types';

export interface HtfScreenshotItem {
  id: string;
  file: File;
  previewUrl: string;
  fileName: string;
  mimeType: string;
  isAnnotated: boolean;
}

@Injectable({ providedIn: 'root' })
export class HtfScreenshotDraftService {
  private readonly drafts = signal<Partial<Record<AnalyzedTimeframe, HtfScreenshotItem[]>>>({});
  private readonly revision = signal(0);

  readonly revisionSnapshot = this.revision.asReadonly();

  addItem(timeframe: AnalyzedTimeframe, file: File, isAnnotated = false): string {
    const id = crypto.randomUUID();
    const item: HtfScreenshotItem = {
      id,
      file,
      previewUrl: URL.createObjectURL(file),
      fileName: file.name,
      mimeType: file.type || 'image/png',
      isAnnotated,
    };

    this.drafts.update((current) => ({
      ...current,
      [timeframe]: [...(current[timeframe] ?? []), item],
    }));
    this.revision.update((n) => n + 1);
    return id;
  }

  updateItem(timeframe: AnalyzedTimeframe, itemId: string, file: File, isAnnotated = true): void {
    this.drafts.update((current) => {
      const items = current[timeframe] ?? [];
      const nextItems = items.map((item) => {
        if (item.id !== itemId) {
          return item;
        }
        URL.revokeObjectURL(item.previewUrl);
        return {
          ...item,
          file,
          previewUrl: URL.createObjectURL(file),
          fileName: file.name,
          mimeType: file.type || 'image/png',
          isAnnotated,
        };
      });
      return { ...current, [timeframe]: nextItems };
    });
    this.revision.update((n) => n + 1);
  }

  removeItem(timeframe: AnalyzedTimeframe, itemId: string): void {
    this.drafts.update((current) => {
      const items = current[timeframe] ?? [];
      const target = items.find((item) => item.id === itemId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      const nextItems = items.filter((item) => item.id !== itemId);
      const next = { ...current };
      if (nextItems.length === 0) {
        delete next[timeframe];
      } else {
        next[timeframe] = nextItems;
      }
      return next;
    });
    this.revision.update((n) => n + 1);
  }

  /** @deprecated use addItem — kept for minimal call-site churn */
  setDraft(timeframe: AnalyzedTimeframe, file: File, isAnnotated = false): void {
    this.addItem(timeframe, file, isAnnotated);
  }

  getItems(timeframe: AnalyzedTimeframe): HtfScreenshotItem[] {
    return this.drafts()[timeframe] ?? [];
  }

  getItem(timeframe: AnalyzedTimeframe, itemId: string): HtfScreenshotItem | null {
    return this.getItems(timeframe).find((item) => item.id === itemId) ?? null;
  }

  removeDraft(timeframe: AnalyzedTimeframe): void {
    const items = this.drafts()[timeframe] ?? [];
    items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    this.drafts.update((current) => {
      const next = { ...current };
      delete next[timeframe];
      return next;
    });
    this.revision.update((n) => n + 1);
  }

  hasDraft(timeframe: AnalyzedTimeframe): boolean {
    return (this.drafts()[timeframe]?.length ?? 0) > 0;
  }

  hasDraftsFor(timeframes: AnalyzedTimeframe[]): boolean {
    return timeframes.every((tf) => this.hasDraft(tf));
  }

  getAllDrafts(): Partial<Record<AnalyzedTimeframe, HtfScreenshotItem[]>> {
    return this.drafts();
  }

  clearAll(): void {
    Object.values(this.drafts()).forEach((items) => {
      items?.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    });
    this.drafts.set({});
    this.revision.update((n) => n + 1);
  }
}
