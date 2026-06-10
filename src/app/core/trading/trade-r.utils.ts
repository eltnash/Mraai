import {
  computeRiskRewardMetrics,
  computeStopDistancePts,
} from '../../features/gatekeeper/execution-risk.utils';
import type { AssetSymbol, TradeDirection } from '../models/database.types';

export interface TradeRInputs {
  r_multiple?: number | null;
  entry_price: number | null;
  stop_price: number | null;
  exit_price: number | null;
  direction: TradeDirection;
  net_profit?: number | null;
  symbol: AssetSymbol;
  size?: number | null;
}

/** Resolve R-multiple from stored value or entry/stop/exit (and dollar risk fallback). */
export function computeTradeRMultiple(trade: TradeRInputs): number | null {
  if (trade.r_multiple != null && Number.isFinite(trade.r_multiple)) {
    return trade.r_multiple;
  }

  const { entry_price, stop_price, exit_price, direction } = trade;
  if (entry_price != null && stop_price != null && exit_price != null) {
    const riskPts = computeStopDistancePts(entry_price, stop_price, direction);
    if (riskPts > 0) {
      const rewardPts =
        direction === 'LONG' ? exit_price - entry_price : entry_price - exit_price;
      return roundR(rewardPts / riskPts);
    }
  }

  if (
    trade.net_profit != null &&
    entry_price != null &&
    stop_price != null &&
    trade.size != null &&
    trade.size > 0
  ) {
    const risk = computeRiskRewardMetrics({
      symbol: trade.symbol,
      direction,
      entry_price,
      stop_price,
      target_price: null,
      volume: trade.size,
    });
    if (risk && risk.total_risk > 0) {
      return roundR(trade.net_profit / risk.total_risk);
    }
  }

  return null;
}

export function roundR(value: number): number {
  return Math.round(value * 100) / 100;
}
