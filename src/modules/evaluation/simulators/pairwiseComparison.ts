/** Pairwise comparison with a 95% interval. B is truly better (wins 56%); the judge favours the first slot by ~10 points. */
export const TRUE_WIN_RATE = 0.56;
const BIASED_WIN_RATE = 0.46;
const JUDGE_CALL_COST_RUPEES = 0.6;
const Z_95 = 1.96;

export interface PairwiseState {
  readonly questions: 50 | 200 | 800;
  readonly judgeBothOrders: boolean;
  readonly shipRule: 'naive' | 'interval';
}

export interface PairwiseResult {
  readonly measuredWinRate: number;
  readonly halfWidth: number;
  readonly lower: number;
  readonly upper: number;
  readonly shipsB: boolean;
  readonly decisionCorrect: boolean;
  readonly judgeCostRupees: number;
}

const round4 = (value: number) => Math.round(value * 10_000) / 10_000;

export function simulatePairwise({ questions, judgeBothOrders, shipRule }: PairwiseState): PairwiseResult {
  const measuredWinRate = judgeBothOrders ? TRUE_WIN_RATE : BIASED_WIN_RATE;
  const halfWidth = round4(Z_95 * Math.sqrt((measuredWinRate * (1 - measuredWinRate)) / questions));
  const lower = round4(measuredWinRate - halfWidth);
  const upper = round4(measuredWinRate + halfWidth);
  const shipsB = shipRule === 'interval' ? lower > 0.5 : measuredWinRate > 0.5;
  return {
    measuredWinRate,
    halfWidth,
    lower,
    upper,
    shipsB,
    decisionCorrect: shipsB, // B is truly better, so shipping is the right call
    judgeCostRupees: Math.round(questions * (judgeBothOrders ? 2 : 1) * JUDGE_CALL_COST_RUPEES),
  };
}
