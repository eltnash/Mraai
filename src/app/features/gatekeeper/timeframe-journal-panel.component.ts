import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';

import type { AnalyzedTimeframe } from '../../core/models/database.types';
import { ImageAnnotatorDialogComponent } from '../../shared/components/image-annotator-dialog/image-annotator-dialog.component';
import { HtfScreenshotDraftService } from './htf-screenshot-draft.service';
import { timeframeLabel } from './htf-context.utils';
import {
  normalizeScreenshotFile,
  readClipboardImageFile,
  readImageFromClipboardEvent,
  validateScreenshotFile,
} from './screenshot-upload.utils';

@Component({
  selector: 'app-timeframe-journal-panel',
  imports: [
    ReactiveFormsModule,
    TextareaModule,
    ButtonModule,
    MessageModule,
    ImageAnnotatorDialogComponent,
  ],
  templateUrl: './timeframe-journal-panel.component.html',
  styleUrl: './timeframe-journal-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeframeJournalPanelComponent {
  private readonly screenshotDrafts = inject(HtfScreenshotDraftService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly timeframe = input.required<AnalyzedTimeframe>();
  readonly journalGroup = input.required<FormGroup>();

  protected readonly annotatorOpen = signal(false);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly pasting = signal(false);
  protected readonly dragging = signal(false);

  protected readonly title = computed(() => `${timeframeLabel(this.timeframe())} chart journal`);
  protected readonly fileInputId = computed(() => `screenshot-file-${this.timeframe()}`);

  protected readonly screenshotDraft = computed(() => {
    this.screenshotDrafts.revisionSnapshot();
    return this.screenshotDrafts.getDraft(this.timeframe());
  });

  /** Paste screenshots with ⌘V anywhere on the page while this panel is open (not in notes). */
  @HostListener('document:paste', ['$event'])
  protected onDocumentPaste(event: ClipboardEvent): void {
    if (this.screenshotDraft()) {
      return;
    }

    const target = event.target;
    if (target instanceof HTMLElement && target.closest('textarea, input:not([type=file]), [contenteditable="true"]')) {
      return;
    }

    const file = readImageFromClipboardEvent(event);
    if (!file) {
      return;
    }

    event.preventDefault();
    this.applyScreenshotFile(file);
  }

  protected openFilePicker(): void {
    const input = this.fileInputRef()?.nativeElement;
    if (!input) {
      this.setUploadError('File picker is not ready — refresh the page and try again.');
      return;
    }

    input.value = '';
    input.click();
  }

  protected onScreenshotSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (file) {
      this.applyScreenshotFile(file);
    }
  }

  protected onDragEnter(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.dragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    const related = event.relatedTarget as Node | null;
    const zone = event.currentTarget as HTMLElement;
    if (related && zone.contains(related)) {
      return;
    }
    this.dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);

    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.applyScreenshotFile(file);
      return;
    }

    this.setUploadError('Drop a PNG, JPEG, or WebP image file.');
  }

  protected async pasteFromClipboard(): Promise<void> {
    if (this.pasting()) {
      return;
    }

    this.pasting.set(true);
    this.setUploadError(null);

    try {
      const file = await readClipboardImageFile();
      if (file) {
        this.applyScreenshotFile(file);
        return;
      }

      this.setUploadError(
        'No image on clipboard. Take a screenshot (⌘⇧4), or copy an image in Preview, then click Paste screenshot again.',
      );
    } finally {
      this.pasting.set(false);
      this.cdr.markForCheck();
    }
  }

  protected removeScreenshot(): void {
    this.screenshotDrafts.removeDraft(this.timeframe());
    this.setUploadError(null);
  }

  protected openAnnotator(): void {
    if (this.screenshotDraft()) {
      this.annotatorOpen.set(true);
    }
  }

  protected closeAnnotator(): void {
    this.annotatorOpen.set(false);
  }

  protected onAnnotatedSaved(file: File): void {
    this.screenshotDrafts.setDraft(this.timeframe(), file, true);
    this.annotatorOpen.set(false);
    this.cdr.markForCheck();
  }

  private applyScreenshotFile(file: File): void {
    const normalized = normalizeScreenshotFile(file, `${this.timeframe()}-chart`);
    const error = validateScreenshotFile(normalized);
    if (error) {
      this.setUploadError(error);
      return;
    }

    this.setUploadError(null);
    this.screenshotDrafts.setDraft(this.timeframe(), normalized);
    this.cdr.markForCheck();
  }

  private setUploadError(message: string | null): void {
    this.uploadError.set(message);
    this.cdr.markForCheck();
  }
}
