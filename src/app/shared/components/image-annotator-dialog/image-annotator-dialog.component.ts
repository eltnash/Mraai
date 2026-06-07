import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';

type AnnotatorTool = 'pan' | 'draw' | 'text';

interface TextStamp {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

interface TextDragState {
  id: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  moved: boolean;
}

@Component({
  selector: 'app-image-annotator-dialog',
  imports: [ButtonModule],
  templateUrl: './image-annotator-dialog.component.html',
  styleUrl: './image-annotator-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageAnnotatorDialogComponent {
  readonly imageUrl = input.required<string>();
  readonly title = input('Chart screenshot');
  readonly saved = output<File>();
  readonly closed = output<void>();

  protected readonly tool = signal<AnnotatorTool>('draw');
  protected readonly strokeColor = signal('#34d399');
  protected readonly scale = signal(1);
  protected readonly translateX = signal(0);
  protected readonly translateY = signal(0);
  protected readonly textStamps = signal<TextStamp[]>([]);
  protected readonly selectedTextId = signal<string | null>(null);

  protected readonly toolOptions = [
    { label: 'Pan', value: 'pan' as const, icon: 'pi pi-arrows-alt' },
    { label: 'Draw', value: 'draw' as const, icon: 'pi pi-pencil' },
    { label: 'Text', value: 'text' as const, icon: 'pi pi-font' },
  ];

  protected readonly colorOptions = ['#34d399', '#f87171', '#fbbf24', '#ffffff', '#60a5fa'];

  private readonly viewportRef = viewChild<ElementRef<HTMLElement>>('viewport');
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly imageRef = viewChild<ElementRef<HTMLImageElement>>('image');
  private readonly textStampRefs = viewChildren<ElementRef<HTMLElement>>('textStamp');

  private drawing = false;
  private panning = false;
  private lastX = 0;
  private lastY = 0;
  private textDrag: TextDragState | null = null;
  private naturalWidth = 0;
  private naturalHeight = 0;

  protected stageTransform(): string {
    return `translate(${this.translateX()}px, ${this.translateY()}px) scale(${this.scale()})`;
  }

  protected onImageLoad(): void {
    const img = this.imageRef()?.nativeElement;
    const canvas = this.canvasRef()?.nativeElement;
    if (!img || !canvas) {
      return;
    }

    this.naturalWidth = img.naturalWidth;
    this.naturalHeight = img.naturalHeight;
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    this.clearCanvas();
  }

  protected setTool(tool: AnnotatorTool): void {
    this.tool.set(tool);
    if (tool !== 'text') {
      this.selectedTextId.set(null);
    }
  }

  protected setColor(color: string): void {
    this.strokeColor.set(color);
    const selectedId = this.selectedTextId();
    if (selectedId) {
      this.textStamps.update((stamps) =>
        stamps.map((stamp) => (stamp.id === selectedId ? { ...stamp, color } : stamp)),
      );
    }
  }

  protected zoomIn(): void {
    this.scale.update((v) => Math.min(v + 0.2, 4));
  }

  protected zoomOut(): void {
    this.scale.update((v) => Math.max(v - 0.2, 0.4));
  }

  protected resetView(): void {
    this.scale.set(1);
    this.translateX.set(0);
    this.translateY.set(0);
  }

  protected undo(): void {
    const stamps = this.textStamps();
    if (stamps.length > 0) {
      this.textStamps.set(stamps.slice(0, -1));
      this.selectedTextId.set(null);
      return;
    }
    this.clearCanvas();
  }

  protected clearAll(): void {
    this.textStamps.set([]);
    this.selectedTextId.set(null);
    this.clearCanvas();
  }

  protected deleteSelectedText(): void {
    const selectedId = this.selectedTextId();
    if (!selectedId) {
      return;
    }
    this.textStamps.update((stamps) => stamps.filter((stamp) => stamp.id !== selectedId));
    this.selectedTextId.set(null);
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    const img = this.imageRef()?.nativeElement;
    const canvas = this.canvasRef()?.nativeElement;
    if (!img || !canvas || !this.naturalWidth || !this.naturalHeight) {
      return;
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = this.naturalWidth;
    exportCanvas.height = this.naturalHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.drawImage(img, 0, 0, this.naturalWidth, this.naturalHeight);
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, this.naturalWidth, this.naturalHeight);

    const scaleX = this.naturalWidth / canvas.width;
    const scaleY = this.naturalHeight / canvas.height;
    const fontSize = Math.max(12, Math.round(16 * scaleY));
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textBaseline = 'top';

    for (const stamp of this.textStamps()) {
      const text = stamp.text.trim();
      if (!text) {
        continue;
      }
      ctx.fillStyle = stamp.color;
      ctx.fillText(text, stamp.x * scaleX, stamp.y * scaleY);
    }

    exportCanvas.toBlob((blob) => {
      if (!blob) {
        return;
      }
      const file = new File([blob], `annotated-${Date.now()}.png`, { type: 'image/png' });
      this.saved.emit(file);
    }, 'image/png');
  }

  protected onPointerDown(event: PointerEvent): void {
    const canvas = this.canvasRef()?.nativeElement;
    const viewport = this.viewportRef()?.nativeElement;
    if (!canvas || !viewport) {
      return;
    }

    if (this.tool() === 'pan') {
      this.panning = true;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      viewport.setPointerCapture(event.pointerId);
      return;
    }

    const point = this.canvasPoint(event, canvas);

    if (this.tool() === 'draw') {
      this.drawing = true;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }
      ctx.strokeStyle = this.strokeColor();
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      viewport.setPointerCapture(event.pointerId);
      return;
    }

    if (this.tool() === 'text') {
      this.addTextStamp(point.x, point.y);
    }
  }

  protected onTextStampPointerDown(event: PointerEvent, stampId: string): void {
    if (this.tool() !== 'text') {
      return;
    }

    event.stopPropagation();
    const stamp = this.textStamps().find((item) => item.id === stampId);
    const viewport = this.viewportRef()?.nativeElement;
    if (!stamp || !viewport) {
      return;
    }

    this.selectedTextId.set(stampId);
    this.textDrag = {
      id: stampId,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: stamp.x,
      originY: stamp.y,
      moved: false,
    };
    viewport.setPointerCapture(event.pointerId);
  }

  protected onTextInput(stampId: string, event: Event): void {
    const target = event.target as HTMLElement;
    this.textStamps.update((stamps) =>
      stamps.map((stamp) =>
        stamp.id === stampId ? { ...stamp, text: target.innerText ?? '' } : stamp,
      ),
    );
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.textDrag) {
      const canvas = this.canvasRef()?.nativeElement;
      if (!canvas) {
        return;
      }

      const dx = event.clientX - this.textDrag.startClientX;
      const dy = event.clientY - this.textDrag.startClientY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        this.textDrag.moved = true;
      }

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const nextX = this.textDrag.originX + dx * scaleX;
      const nextY = this.textDrag.originY + dy * scaleY;

      this.textStamps.update((stamps) =>
        stamps.map((stamp) =>
          stamp.id === this.textDrag?.id ? { ...stamp, x: nextX, y: nextY } : stamp,
        ),
      );
      return;
    }

    if (this.panning) {
      const dx = event.clientX - this.lastX;
      const dy = event.clientY - this.lastY;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.translateX.update((x) => x + dx);
      this.translateY.update((y) => y + dy);
      return;
    }

    if (!this.drawing) {
      return;
    }

    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) {
      return;
    }

    const point = this.canvasPoint(event, canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  protected onPointerUp(event: PointerEvent): void {
    if (this.textDrag) {
      const drag = this.textDrag;
      this.textDrag = null;
      this.viewportRef()?.nativeElement.releasePointerCapture(event.pointerId);

      if (!drag.moved) {
        this.focusTextStamp(drag.id);
      }
      return;
    }

    this.drawing = false;
    this.panning = false;
    this.viewportRef()?.nativeElement.releasePointerCapture(event.pointerId);
  }

  protected onWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.12 : -0.12;
    this.scale.update((v) => Math.min(Math.max(v + delta, 0.4), 4));
  }

  @HostListener('document:keydown', ['$event'])
  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.selectedTextId()) {
        this.selectedTextId.set(null);
        return;
      }
      this.close();
      return;
    }

    if (event.key !== 'Backspace' && event.key !== 'Delete') {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target?.isContentEditable) {
      return;
    }
    if (this.selectedTextId()) {
      event.preventDefault();
      this.deleteSelectedText();
    }
  }

  private addTextStamp(x: number, y: number): void {
    const id = crypto.randomUUID();
    this.textStamps.update((stamps) => [
      ...stamps,
      { id, x, y, text: '', color: this.strokeColor() },
    ]);
    this.selectedTextId.set(id);
    queueMicrotask(() => this.focusTextStamp(id));
  }

  private focusTextStamp(id: string): void {
    const ref = this.textStampRefs().find((item) => item.nativeElement.dataset['stampId'] === id);
    const element = ref?.nativeElement;
    if (!element) {
      return;
    }
    element.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  private canvasPoint(event: PointerEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  private clearCanvas(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }
}
