/** Output rail: four checks on ten drafts from a (fictional) insurance claims bot, with a failure policy and optional streaming. */
export type DefectKind = 'schema' | 'grounding' | 'toxicity' | 'leakage';
export type FailureAction = 'block' | 'retry' | 'human';

export interface Draft {
  readonly text: string;
  readonly defect: DefectKind | null;
  readonly reason?: string;
  /** Fails again after a retry. */
  readonly stubborn?: boolean;
}

export const DRAFTS: readonly Draft[] = [
  { text: 'Claim CLM-104471 is approved. Payout in 5–7 working days.', defect: null },
  { text: 'Please upload a photo of the damaged window so we can continue.', defect: null },
  { text: 'Good news: your payout will reach you in 1 day.', defect: 'grounding', reason: 'policy says 5–7 days' },
  { text: '{"claim": "104472", "message": "Approved"}', defect: 'schema', reason: 'claim_id field missing' },
  { text: 'Your policy covers accidental damage to the phone screen.', defect: null },
  { text: 'Anil will survey on Monday. Priya Shah (98200 12345) had the same issue.', defect: 'leakage', reason: 'another customer’s phone number' },
  { text: 'As I already told you twice, read your policy before writing in.', defect: 'toxicity', reason: 'breaks the tone guide' },
  { text: 'Flood damage is covered under your two-wheeler policy.', defect: 'grounding', reason: 'not in the policy', stubborn: true },
  { text: 'Your claim is with the surveyor; expect a call within 48 hours.', defect: null },
  { text: '{"claim_id": "CLM-10447", "message": "Rejected"}', defect: 'schema', reason: 'ID needs six digits' },
];

export const OUTPUT_CHECKS: readonly { readonly kind: DefectKind; readonly label: string; readonly latencyMs: number }[] = [
  { kind: 'schema', label: 'Schema (Pydantic)', latencyMs: 2 },
  { kind: 'grounding', label: 'Grounding against the policy', latencyMs: 180 },
  { kind: 'toxicity', label: 'Toxicity and tone', latencyMs: 45 },
  { kind: 'leakage', label: 'PII and secret leakage', latencyMs: 10 },
];
export const MODEL_CALL_MS = 1100;
export const DEFECTIVE_COUNT = DRAFTS.filter((d) => d.defect).length;

export interface OutputRailState {
  readonly checks: Readonly<Record<DefectKind, boolean>>;
  readonly onFailure: FailureAction;
  readonly stream: boolean;
}

export type DraftOutcome = 'sent' | 'defectSent' | 'fallback' | 'toPerson' | 'fixedOnRetry' | 'retryFailed';
export interface JudgedDraft { readonly draft: Draft; readonly outcome: DraftOutcome; readonly glimpsed: boolean; readonly caught: boolean }

export interface OutputRailResult {
  readonly drafts: readonly JudgedDraft[];
  readonly defectsSeen: number;
  readonly glimpsed: number;
  readonly goodAnswers: number;
  readonly retries: number;
  readonly fallbacks: number;
  readonly toPerson: number;
  readonly checkMs: number;
  readonly addedWaitMs: number;
  readonly modelCalls: number;
  readonly uncheckedDefects: readonly number[];
  readonly stream: boolean;
}

export function simulateOutputRail(state: OutputRailState): OutputRailResult {
  const drafts = DRAFTS.map((draft): JudgedDraft => {
    if (!draft.defect) return { draft, outcome: 'sent', glimpsed: false, caught: false };
    if (!state.checks[draft.defect]) return { draft, outcome: 'defectSent', glimpsed: false, caught: false };
    const outcome: DraftOutcome = state.onFailure === 'block' ? 'fallback' : state.onFailure === 'human' ? 'toPerson' : draft.stubborn ? 'retryFailed' : 'fixedOnRetry';
    return { draft, outcome, glimpsed: state.stream, caught: true };
  });
  const count = (...o: DraftOutcome[]) => drafts.filter((d) => o.includes(d.outcome)).length;
  const glimpsed = drafts.filter((d) => d.glimpsed).length;
  const retries = count('fixedOnRetry', 'retryFailed');
  const checkMs = OUTPUT_CHECKS.reduce((sum, c) => sum + (state.checks[c.kind] ? c.latencyMs : 0), 0);
  return {
    drafts,
    defectsSeen: count('defectSent') + glimpsed,
    glimpsed,
    goodAnswers: count('sent', 'fixedOnRetry'),
    retries,
    fallbacks: count('fallback', 'retryFailed'),
    toPerson: count('toPerson'),
    checkMs,
    addedWaitMs: state.stream ? 0 : Math.round(checkMs + (retries * (MODEL_CALL_MS + checkMs)) / DRAFTS.length),
    modelCalls: DRAFTS.length + retries,
    uncheckedDefects: drafts.flatMap((d, i) => (d.outcome === 'defectSent' ? [i + 1] : [])),
    stream: state.stream,
  };
}
