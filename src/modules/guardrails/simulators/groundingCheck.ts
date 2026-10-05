/** Grounding checks for 10,000 daily RAG answers at a (fictional) health insurer; about 600 hold an unsupported claim. */
export type GroundingDetector = 'none' | 'llm' | 'claims' | 'cascade';
export const SUPPORT_THRESHOLDS = [0.3, 0.5, 0.7] as const;
export type SupportThreshold = (typeof SUPPORT_THRESHOLDS)[number];

export const DAILY_ANSWERS = { total: 10000, unsupported: 600 } as const;
const REGENERATION_MS = 1500;
const REGENERATION_COST_INR = 0.5;
/** Share of false flags that survive a regeneration and are refused. */
const REFUSED_AFTER_REGEN = 0.3;

type Rates = readonly [recall: number, falsePositiveRate: number];
const CLAIM_CHECKER: Readonly<Record<SupportThreshold, Rates>> = { 0.3: [0.95, 0.15], 0.5: [0.88, 0.06], 0.7: [0.72, 0.02] };
const CASCADE: Readonly<Record<SupportThreshold, Rates>> = { 0.3: [0.96, 0.05], 0.5: [0.93, 0.03], 0.7: [0.85, 0.015] };

/** Recall and false-positive rate; only the claim-level detectors depend on the threshold. */
function ratesFor(detector: GroundingDetector, threshold: SupportThreshold): Rates {
  switch (detector) {
    case 'none': return [0, 0];
    case 'llm': return [0.7, 0.05];
    case 'claims': return CLAIM_CHECKER[threshold];
    case 'cascade': return CASCADE[threshold];
  }
}
/** Base latency (ms) and cost per answer (INR). */
const BASE: Readonly<Record<GroundingDetector, readonly [number, number]>> = { none: [0, 0], llm: [1200, 0.4], claims: [150, 0.03], cascade: [390, 0.11] };

export const usesThreshold = (d: GroundingDetector) => d === 'claims' || d === 'cascade';

export interface GroundingState {
  readonly detector: GroundingDetector;
  readonly threshold: SupportThreshold;
  readonly regenerate: boolean;
}

export interface GroundingResult {
  readonly recall: number;
  readonly falsePositiveRate: number;
  readonly reachingUsers: number;
  readonly goodRefused: number;
  readonly latencyMs: number;
  readonly costInr: number;
}

export function simulateGrounding({ detector, threshold, regenerate }: GroundingState): GroundingResult {
  const [recall, fpr] = ratesFor(detector, threshold);
  const [baseMs, costPerAnswer] = BASE[detector];
  const caught = DAILY_ANSWERS.unsupported * recall;
  const falseFlags = (DAILY_ANSWERS.total - DAILY_ANSWERS.unsupported) * fpr;
  const flagged = caught + falseFlags;
  const regen = regenerate && detector !== 'none';
  return {
    recall,
    falsePositiveRate: fpr,
    reachingUsers: Math.round(DAILY_ANSWERS.unsupported - caught),
    goodRefused: Math.round(regen ? falseFlags * REFUSED_AFTER_REGEN : falseFlags),
    latencyMs: Math.round(baseMs + (regen ? (flagged / DAILY_ANSWERS.total) * REGENERATION_MS : 0)),
    costInr: Math.round(DAILY_ANSWERS.total * costPerAnswer + (regen ? flagged * REGENERATION_COST_INR : 0)),
  };
}
