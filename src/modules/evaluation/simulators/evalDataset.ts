/**
 * Eval datasets: does a test set of a given size, source and labelling detect a real 4-point regression?
 * Scenario: Suraksha General, a fictional insurer, 12 intents, 20% Hindi or Hinglish traffic.
 */
/** Share of traffic per intent; index 8 is flood claims, new since the monsoon. */
export const INTENT_TRAFFIC_SHARE = [0.22, 0.18, 0.14, 0.1, 0.09, 0.08, 0.06, 0.05, 0.04, 0.02, 0.01, 0.01] as const;
export const TOTAL_INTENTS = INTENT_TRAFFIC_SHARE.length;
const FLOOD_INTENT_INDEX = 8;
const MIN_CASES_PER_INTENT = 3;
const Z_95 = 1.96;

export type CaseSource = 'synthetic' | 'production' | 'stratified';
export type Labelling = 'single' | 'double';

export interface EvalDatasetState {
  readonly caseCount: 50 | 200 | 1000;
  readonly source: CaseSource;
  readonly labelling: Labelling;
  readonly refreshMonthly: boolean;
}

export interface EvalDatasetResult {
  readonly measuredAccuracy: number;
  readonly mainCases: number;
  readonly adversarialCases: number;
  /** 95% margin of a single score, in points. */
  readonly marginPoints: number;
  /** 95% margin of a difference between two scores (√2 × single), in points. */
  readonly differenceMarginPoints: number;
  readonly intentsCovered: number;
  readonly hindiCases: number;
  readonly hindiMarginPoints: number | null;
  readonly labelNoise: number;
  readonly measuredDropPoints: number;
  readonly regressionDetected: boolean;
  readonly labellingHours: number;
}

/** 95% margin of error, in percentage points, for a proportion p measured on n cases. */
export const marginOfErrorPoints = (p: number, n: number): number => Z_95 * Math.sqrt((p * (1 - p)) / n) * 100;

export function simulateEvalDataset({ caseCount, source, labelling, refreshMonthly }: EvalDatasetState): EvalDatasetResult {
  const isSynthetic = source === 'synthetic';
  const isStratified = source === 'stratified';
  const measuredAccuracy = isSynthetic ? 0.94 : 0.85;
  const mainCases = isStratified ? Math.round(caseCount * 0.9) : caseCount;
  const adversarialCases = isStratified ? Math.round(caseCount * 0.1) : 0;
  const marginPoints = marginOfErrorPoints(measuredAccuracy, mainCases);
  const refreshBonus = refreshMonthly ? 1 : 0;

  let intentsCovered: number;
  if (isSynthetic) intentsCovered = 6 + refreshBonus;
  else if (isStratified) intentsCovered = 11 + refreshBonus;
  else intentsCovered = INTENT_TRAFFIC_SHARE.filter((share, i) => (i === FLOOD_INTENT_INDEX ? refreshMonthly : caseCount * share >= MIN_CASES_PER_INTENT)).length;

  const hindiCases = isSynthetic ? 0 : Math.round(caseCount * (isStratified ? 0.25 : 0.2));
  const labelNoise = labelling === 'double' ? 0.03 : 0.12;
  // Hindi drop (3 points overall) is visible only with real traffic; the flood intent (1 point) only after a refresh.
  // Label noise shrinks any real change to (1 − 2 × noise) of its size.
  const measuredDropPoints = (3 * (isSynthetic ? 0 : 1) + refreshBonus) * (1 - 2 * labelNoise);
  const differenceMarginPoints = marginPoints * Math.SQRT2;
  const minutesPerCase = labelling === 'double' ? 6 + 0.12 * 5 : 3;

  return {
    measuredAccuracy,
    mainCases,
    adversarialCases,
    marginPoints,
    differenceMarginPoints,
    intentsCovered,
    hindiCases,
    hindiMarginPoints: hindiCases ? marginOfErrorPoints(0.85, hindiCases) : null,
    labelNoise,
    measuredDropPoints,
    regressionDetected: measuredDropPoints > differenceMarginPoints,
    labellingHours: (caseCount * minutesPerCase) / 60,
  };
}
