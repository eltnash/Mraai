import type {
  AuctionLocation,
  AuctionStrategy,
  ConfirmationTrigger,
  DayType,
  MarketBehavior,
} from '../../core/models/database.types';
import type { SelectOption } from '../../core/supabase/enum-options';
import {
  AUCTION_LOCATION_OPTIONS,
  AUCTION_STRATEGY_OPTIONS,
  CONFIRMATION_TRIGGER_OPTIONS,
  DAY_TYPE_OPTIONS,
  LOCATION_PILLAR_OPTIONS,
  MARKET_BEHAVIOR_OPTIONS,
} from '../../core/supabase/enum-options';

export type AuctionPlaybook = 'fade' | 'trend';

/** Auction Type step — developing vs prior session volume profile guidance. */
export const AUCTION_TYPE_PROFILE_REMINDER =
  'At the open, do not classify the developing day\'s volume profile. With little volume logged, POC, VAH, and VAL chase price instead of defining it. Anchor early reads to the prior session\'s completed profile (POC / VAH / VAL). Treat today\'s profile as decision grade only once structure has built: levels stop shifting with every print, and price reacts to them rather than the reverse. Update your day type read as the session matures.';

const FADE_BEHAVIORS: MarketBehavior[] = [
  'Rejection',
  'Rotation',
  'Exhaustion',
  'Excess',
  'Failed_Auction',
  'Responsive_Buying',
  'Responsive_Selling',
];

const TREND_BEHAVIORS: MarketBehavior[] = [
  'Acceptance',
  'Value_Migration',
  'Responsive_Buying',
  'Responsive_Selling',
  'Exhaustion',
  'Excess',
];

const FADE_CONFIRMATIONS: ConfirmationTrigger[] = [
  'Delta_Divergence',
  'Delta_Shift',
  'Volume_Absorption',
  'Excess_Tail',
  'VWAP_Reclaim',
  'VWAP_Rejection',
  'POC_Rejection',
  'VA_Edge_Rejection',
];

const TREND_CONFIRMATIONS: ConfirmationTrigger[] = [
  'CVD_Alignment',
  'Delta_Shift',
  'Volume_Absorption',
  'VWAP_Reclaim',
  'VWAP_Acceptance',
  'Anchored_VWAP_Hold',
  'Value_Area_Acceptance',
  'Market_Structure_Break',
];

function playbookBehaviors(playbook: AuctionPlaybook): readonly MarketBehavior[] {
  return playbook === 'fade' ? FADE_BEHAVIORS : TREND_BEHAVIORS;
}

function playbookConfirmations(playbook: AuctionPlaybook): readonly ConfirmationTrigger[] {
  return playbook === 'fade' ? FADE_CONFIRMATIONS : TREND_CONFIRMATIONS;
}

export function playbookForAuctionStrategy(strategy: AuctionStrategy): AuctionPlaybook {
  return strategy === 'Level_Rejection' ? 'fade' : 'trend';
}

export function playbookLabel(playbook: AuctionPlaybook): string {
  return playbook === 'fade' ? 'Responsive auction' : 'Initiative auction';
}

export function playbookTagSeverity(playbook: AuctionPlaybook): 'info' | 'success' | 'warn' {
  return playbook === 'fade' ? 'info' : 'success';
}

export function playbookDescriptionForStrategy(strategy: AuctionStrategy): string {
  if (strategy === 'Level_Rejection') {
    return 'Price is rejecting the level — responsive activity. Fade toward prior value with rejection/rotation behaviors and responsive order-flow confirmations.';
  }
  return 'Price is accepting the level — initiative activity. Join migration with acceptance/value-shift behaviors and continuation confirmations.';
}

export function invalidationPlaceholder(playbook: AuctionPlaybook): string {
  if (playbook === 'fade') {
    return 'e.g. Acceptance beyond VAH/VAL with value migration — rejection thesis dead';
  }
  return 'e.g. Acceptance back inside prior value / failed retest of broken structure — continuation thesis dead';
}

export function auctionStrategyLabel(strategy: AuctionStrategy): string {
  const option = AUCTION_STRATEGY_OPTIONS.find((item) => item.value === strategy);
  return option?.label ?? strategy;
}

export function auctionStrategyShortLabel(strategy: AuctionStrategy): string {
  return strategy === 'Level_Rejection' ? 'Rejection' : 'Acceptance';
}

export function auctionStrategyTagSeverity(strategy: AuctionStrategy): 'info' | 'success' {
  return strategy === 'Level_Rejection' ? 'info' : 'success';
}

export function dayTypeLabel(dayType: DayType): string {
  const option = DAY_TYPE_OPTIONS.find((item) => item.value === dayType);
  return option?.label ?? dayType;
}

export function formatLocationLabels(locations: AuctionLocation[]): string {
  if (locations.length === 0) {
    return '';
  }

  return locations
    .map((location) => LOCATION_PILLAR_OPTIONS.find((option) => option.value === location)?.label ?? location)
    .join(' · ');
}

export function filterOptions<T extends string>(
  all: SelectOption<T>[],
  allowed: readonly T[],
): SelectOption<T>[] {
  const allowedSet = new Set<string>(allowed);
  return all.filter((option) => allowedSet.has(option.value));
}

export function getPlaybookBehaviorOptions(playbook: AuctionPlaybook): SelectOption<MarketBehavior>[] {
  return filterOptions(MARKET_BEHAVIOR_OPTIONS, playbookBehaviors(playbook));
}

export function getPlaybookConfirmationOptions(
  playbook: AuctionPlaybook,
): SelectOption<ConfirmationTrigger>[] {
  return filterOptions(CONFIRMATION_TRIGGER_OPTIONS, playbookConfirmations(playbook));
}
