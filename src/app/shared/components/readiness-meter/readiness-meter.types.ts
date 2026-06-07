export interface PillarStepState {
  key: 'context' | 'location' | 'behavior' | 'confirmation' | 'invalidation';
  label: string;
  valid: boolean;
  value?: string | null;
}

export interface ReadinessChangeEvent {
  readinessPct: number;
  pillarsQualified: boolean;
  completedSteps: number;
}

export const READINESS_WEIGHT_PER_STEP = 20;
