/** Memory poisoning: write policy, memories shown as quoted data, and audits with expiry. */
export type WritePolicy = 'any' | 'classifier' | 'provenance';
const ATTACK_SUCCESS: Readonly<Record<WritePolicy, number>> = { any: 0.38, classifier: 0.14, provenance: 0.04 };
const USEFUL_KEPT: Readonly<Record<WritePolicy, number>> = { any: 0.97, classifier: 0.93, provenance: 0.88 };
const ATTEMPTS_PER_MONTH = 50;

export interface MemoryPoisoningState { readonly policy: WritePolicy; readonly quotedData: boolean; readonly audit: boolean }
export interface MemoryPoisoningResult { readonly attackSuccess: number; readonly usefulKept: number; readonly persistDays: number; readonly harmfulPerMonth: number }

export function simulateMemoryPoisoning(s: MemoryPoisoningState): MemoryPoisoningResult {
  let asr = ATTACK_SUCCESS[s.policy];
  if (s.quotedData) asr /= 2;
  asr = Math.round(asr * 1000) / 1000;
  return { attackSuccess: asr, usefulKept: USEFUL_KEPT[s.policy], persistDays: s.audit ? 4 : 60, harmfulPerMonth: Math.round(ATTEMPTS_PER_MONTH * asr * (s.audit ? 1 : 6)) };
}
