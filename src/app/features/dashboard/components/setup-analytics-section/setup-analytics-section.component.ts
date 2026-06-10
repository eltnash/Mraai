import { DecimalPipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';

import type { SetupAnalyticsRow, SetupDimension } from '../../dashboard.types';
import { confidenceLabel, edgeStatusLabel } from '../../trading-metrics.utils';

type DimFilter = 'all' | SetupDimension;

@Component({
  selector: 'app-setup-analytics-section',
  imports: [DecimalPipe, PercentPipe, SelectButtonModule, TagModule, FormsModule],
  templateUrl: './setup-analytics-section.component.html',
  styleUrl: './setup-analytics-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupAnalyticsSectionComponent {
  readonly rows = input.required<SetupAnalyticsRow[]>();

  protected readonly filter = signal<DimFilter>('all');
  protected readonly filterOptions = [
    { label: 'All', value: 'all' as DimFilter },
    { label: 'Location', value: 'location' as DimFilter },
    { label: 'Behavior', value: 'behavior' as DimFilter },
    { label: 'Confirmation', value: 'confirmation' as DimFilter },
    { label: 'Day type', value: 'day_type' as DimFilter },
    { label: 'Note tags', value: 'note_tag' as DimFilter },
    { label: 'Tag pairs', value: 'tag_pair' as DimFilter },
  ];

  protected readonly filtered = computed(() => {
    const f = this.filter();
    const list = this.rows();
    return f === 'all' ? list : list.filter((r) => r.dimension === f);
  });

  protected readonly statusLabel = edgeStatusLabel;
  protected readonly confidenceLabel = confidenceLabel;

  protected dimensionLabel(row: SetupAnalyticsRow): string {
    if (row.dimension === 'note_tag' || row.dimension === 'tag_pair') {
      return row.pillarSource ?? row.dimension;
    }
    return row.dimension.replace('_', ' ');
  }
}
