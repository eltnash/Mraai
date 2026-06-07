import type {
  AnalyzedTimeframe,
  CompositeValuePosition,
  HtfAnalysisTool,
  HtfAuctionRegime,
  HtfContextSnapshot,
  MarketStructureBias,
  TradingTimeframe,
} from '../../core/models/database.types';
import type { ContextStepValue, GatekeeperFormValue } from './gatekeeper-form.types';

export function serializeCheckboxGroup<T extends string>(
  group: Record<string, boolean>,
  keys: readonly T[],
): T[] {
  return keys.filter((key) => group[key] === true);
}

export function mapContextStepToSnapshot(context: ContextStepValue): HtfContextSnapshot {
  const composite = context.composite_value_position;
  const regime = context.auction_regime;
  const structure = context.structure_bias;

  if (!composite || !regime || !structure) {
    throw new Error('Incomplete HTF context');
  }

  const analyzed_timeframes = serializeCheckboxGroup(
    context.analyzed_timeframes,
    ['M', 'W', 'D', 'H4', 'H1'] as const,
  );

  const tools_used = serializeCheckboxGroup(context.tools_used, [
    'Composite_VP',
    'Multi_Day_VAH_VAL_POC',
    'Major_HVN_LVN',
    'Multi_Day_TPO',
    'Value_Area_Migration',
    'Day_Type_Series',
    'Unfinished_Business',
  ] as const);

  if (analyzed_timeframes.length === 0 || tools_used.length === 0) {
    throw new Error('Select at least one timeframe and one analysis tool');
  }

  return {
    analyzed_timeframes,
    trading_timeframe: context.trading_timeframe,
    composite_value_position: composite,
    auction_regime: regime,
    structure_bias: structure,
    tools_used,
    htf_thesis: context.htf_thesis.trim(),
    session_posture: context.session_posture.trim(),
  };
}

export function mapFormToHtfContext(form: GatekeeperFormValue): HtfContextSnapshot {
  return mapContextStepToSnapshot(form.context);
}

export function formatHtfContextSummary(snapshot: HtfContextSnapshot): string {
  return `${snapshot.structure_bias.replace(/_/g, ' ')} · ${snapshot.composite_value_position.replace(/_/g, ' ')}`;
}

export const EXECUTION_TIMEFRAME: TradingTimeframe = 'M15';
