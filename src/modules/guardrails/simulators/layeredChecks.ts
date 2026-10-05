/** Rules vs classifier: which check suits exact rules and which suits harmful meaning, for 1,000 daily requests to a payments agent. */
export type ExactChecker = 'rules' | 'classifier' | 'off';
export type MeaningChecker = 'keywords' | 'classifier' | 'off';

export const DAILY_TRAFFIC = { exactBreaks: 70, harmfulParaphrases: 25, fine: 905 } as const;
export const CLASSIFIER_THRESHOLDS = [0.5, 0.6, 0.7, 0.8, 0.9] as const;
export type ClassifierThreshold = (typeof CLASSIFIER_THRESHOLDS)[number];

/** Classifier recall on paraphrases and innocent requests blocked per day, by threshold. */
const CLASSIFIER_CURVE: Readonly<Record<ClassifierThreshold, { readonly recall: number; readonly falsePositives: number }>> = {
  0.5: { recall: 0.96, falsePositives: 36 },
  0.6: { recall: 0.92, falsePositives: 18 },
  0.7: { recall: 0.84, falsePositives: 8 },
  0.8: { recall: 0.68, falsePositives: 4 },
  0.9: { recall: 0.44, falsePositives: 1 },
};
const CLASSIFIER_EXACT_CATCHES = 30;
const KEYWORD_CATCHES = 6;
const KEYWORD_FALSE_POSITIVES = 12;
export const CLASSIFIER_MS = 30;
export const RULES_MS = 0.1;

export interface LayeredChecksState {
  readonly exact: ExactChecker;
  readonly meaning: MeaningChecker;
  readonly threshold: ClassifierThreshold;
}

export interface LayeredChecksResult {
  readonly exactCaught: number;
  readonly meaningCaught: number;
  readonly innocentBlocked: number;
  readonly harmfulLetThrough: number;
  readonly latencyMs: number;
}

export function simulateLayeredChecks({ exact, meaning, threshold }: LayeredChecksState): LayeredChecksResult {
  const curve = CLASSIFIER_CURVE[threshold];
  const exactCaught = exact === 'rules' ? DAILY_TRAFFIC.exactBreaks : exact === 'classifier' ? CLASSIFIER_EXACT_CATCHES : 0;
  const meaningCaught = meaning === 'classifier' ? Math.round(DAILY_TRAFFIC.harmfulParaphrases * curve.recall) : meaning === 'keywords' ? KEYWORD_CATCHES : 0;
  return {
    exactCaught,
    meaningCaught,
    innocentBlocked: meaning === 'classifier' ? curve.falsePositives : meaning === 'keywords' ? KEYWORD_FALSE_POSITIVES : 0,
    harmfulLetThrough: DAILY_TRAFFIC.exactBreaks - exactCaught + (DAILY_TRAFFIC.harmfulParaphrases - meaningCaught),
    latencyMs: exact === 'classifier' || meaning === 'classifier' ? CLASSIFIER_MS : RULES_MS,
  };
}
