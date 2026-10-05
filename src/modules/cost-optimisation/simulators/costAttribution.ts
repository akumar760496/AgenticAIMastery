/** Cost attribution and guards for a (fictional) SME platform's monthly LLM bill, in INR. */
export type TagLevel = 'none' | 'feature' | 'full';
export type GuardMode = 'none' | 'alert' | 'hard';

export const USEFUL_SPEND_INR = 600000;
const ATTRIBUTED: Readonly<Record<TagLevel, number>> = { none: 0, feature: 0.7, full: 0.98 };
const HARD_STOP_RUNAWAY: Readonly<Record<TagLevel, number>> = { full: 6000, feature: 30000, none: 20000 };
const HARD_STOP_FALSE_STOPS: Readonly<Record<TagLevel, number>> = { full: 40, feature: 900, none: 5000 };

export interface CostAttributionState {
  readonly tags: TagLevel;
  readonly guard: GuardMode;
  readonly anomalyAlerts: boolean;
}

export interface CostAttributionResult {
  readonly attributed: number;
  readonly runawayInr: number;
  readonly abuseInr: number;
  readonly wasteInr: number;
  readonly billInr: number;
  readonly legitimateStops: number;
}

export function simulateCostAttribution({ tags, guard, anomalyAlerts }: CostAttributionState): CostAttributionResult {
  let runawayInr: number;
  let legitimateStops = 0;
  if (guard === 'none') runawayInr = 120000;
  else if (guard === 'alert') runawayInr = tags === 'none' ? 90000 : 45000;
  else { runawayInr = HARD_STOP_RUNAWAY[tags]; legitimateStops = HARD_STOP_FALSE_STOPS[tags]; }
  let abuseInr = 80000;
  if (tags === 'full' && guard === 'hard') abuseInr = 8000;
  else if (anomalyAlerts && tags !== 'none') abuseInr = tags === 'full' ? 12000 : 40000;
  const wasteInr = runawayInr + abuseInr;
  return { attributed: ATTRIBUTED[tags], runawayInr, abuseInr, wasteInr, billInr: USEFUL_SPEND_INR + wasteInr, legitimateStops };
}
