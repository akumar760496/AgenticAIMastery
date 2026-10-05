/** LLM-as-a-judge: how position bias, verbosity bias and order-swapping change a pairwise verdict. */
export interface LlmJudgeState {
  readonly settings: Readonly<{ showBFirst: boolean; positionBias: boolean; lengthEarnsNothing: boolean; runBothOrders: boolean }>;
}

export type JudgeVerdict = 'A' | 'B' | 'tie';

export interface AnswerScore { readonly a: number; readonly b: number; readonly verbosityBonus: number; readonly positionBonus: number }

export interface LlmJudgeResult {
  readonly firstShown: 'A' | 'B';
  readonly score: AnswerScore;
  readonly verdict: JudgeVerdict;
  /** Winning margin for A; 0 when A does not win. */
  readonly marginForA: number;
}

const QUALITY = { a: 0.8, b: 0.4 } as const;
const VERBOSITY_BONUS = 0.5;
const POSITION_BONUS = 0.3;

const scoreWhenFirst = (first: 'A' | 'B', settings: LlmJudgeState['settings']): AnswerScore => {
  const verbosityBonus = settings.lengthEarnsNothing ? 0 : VERBOSITY_BONUS;
  const positionBonus = settings.positionBias ? POSITION_BONUS : 0;
  return {
    a: QUALITY.a + (first === 'A' ? positionBonus : 0),
    b: QUALITY.b + verbosityBonus + (first === 'B' ? positionBonus : 0),
    verbosityBonus,
    positionBonus,
  };
};

const winnerOf = (score: AnswerScore): 'A' | 'B' => (score.a >= score.b ? 'A' : 'B');

export function simulateLlmJudge({ settings }: LlmJudgeState): LlmJudgeResult {
  const firstShown = settings.showBFirst ? 'B' : 'A';
  const score = scoreWhenFirst(firstShown, settings);
  const winner = winnerOf(score);
  let verdict: JudgeVerdict = winner;
  if (settings.runBothOrders) {
    const swapped = scoreWhenFirst(firstShown === 'A' ? 'B' : 'A', settings);
    if (winnerOf(swapped) !== winner) verdict = 'tie';
  }
  return { firstShown, score, verdict, marginForA: winner === 'A' ? score.a - score.b : 0 };
}
