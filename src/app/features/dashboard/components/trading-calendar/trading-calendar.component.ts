import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import type { DayTradeSummary } from '../../dashboard.types';
import { calendarMonthGrid } from '../../trading-metrics.utils';

@Component({
  selector: 'app-trading-calendar',
  imports: [ButtonModule, TooltipModule],
  templateUrl: './trading-calendar.component.html',
  styleUrl: './trading-calendar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TradingCalendarComponent {
  readonly daySummaries = input.required<Map<string, DayTradeSummary>>();
  readonly currency = input('USD');
  readonly strategyLabel = input<string | null>(null);

  protected readonly viewYear = signal(new Date().getFullYear());
  protected readonly viewMonth = signal(new Date().getMonth());

  protected readonly monthLabel = computed(() =>
    new Date(this.viewYear(), this.viewMonth(), 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    }),
  );

  protected readonly cells = computed(() =>
    calendarMonthGrid(this.viewYear(), this.viewMonth()),
  );

  protected readonly weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  protected prevMonth(): void {
    if (this.viewMonth() === 0) {
      this.viewMonth.set(11);
      this.viewYear.update((y) => y - 1);
    } else {
      this.viewMonth.update((m) => m - 1);
    }
  }

  protected nextMonth(): void {
    if (this.viewMonth() === 11) {
      this.viewMonth.set(0);
      this.viewYear.update((y) => y + 1);
    } else {
      this.viewMonth.update((m) => m + 1);
    }
  }

  protected goToday(): void {
    const now = new Date();
    this.viewYear.set(now.getFullYear());
    this.viewMonth.set(now.getMonth());
  }

  protected summaryFor(date: string | null): DayTradeSummary | null {
    if (!date) return null;
    return this.daySummaries().get(date) ?? null;
  }

  protected dayClass(date: string | null): string {
    if (!date) return 'cal-day cal-day--empty';
    const summary = this.summaryFor(date);
    if (!summary) return 'cal-day';
    if (summary.netPnl > 0) return 'cal-day cal-day--win';
    if (summary.netPnl < 0) return 'cal-day cal-day--loss';
    return 'cal-day cal-day--flat';
  }

  protected tooltipFor(date: string | null): string {
    const summary = this.summaryFor(date);
    if (!summary) return 'No trades';
    const sign = summary.netPnl >= 0 ? '+' : '';
    return `${summary.tradeCount} trade(s) · ${sign}${summary.netPnl.toFixed(2)} ${this.currency()}`;
  }

  protected isToday(date: string | null): boolean {
    if (!date) return false;
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return date === iso;
  }
}
