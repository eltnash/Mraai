import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';

import type { GatekeeperStepProgress } from '../gatekeeper/gatekeeper-step-progress.utils';

@Component({
  selector: 'app-journal-step-progress',
  imports: [ProgressBarModule, TooltipModule],
  templateUrl: './journal-step-progress.component.html',
  styleUrl: './journal-step-progress.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JournalStepProgressComponent {
  readonly progress = input.required<GatekeeperStepProgress>();
}
