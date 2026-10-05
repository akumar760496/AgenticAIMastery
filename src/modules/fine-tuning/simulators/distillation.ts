/** Distil a travel assistant: 2 million queries a month; teacher 92% at ₹0.90, student ₹0.08 plus ₹30,000 a month. */
export interface DistillationState { readonly student: number; readonly examples: number; readonly filter: boolean; readonly rationales: boolean; readonly share: number }
export interface DistillationResult { readonly studentAccuracy: number; readonly blended: number; readonly monthlyCost: number; readonly billShare: number }

export const TEACHER_ACCURACY = 0.92;
export const ALL_TEACHER_BILL = 1.8e6;
const QUERIES = 2e6;
const DATA_GAIN: Readonly<Record<number, number>> = { 1000: 0.03, 10000: 0.07, 50000: 0.09 };

export function simulateDistillation(s: DistillationState): DistillationResult {
  const big = s.student === 8;
  const raw = (big ? 0.8 : 0.7) + (DATA_GAIN[s.examples] ?? 0) + (s.filter ? 0.02 : 0) + (s.rationales ? (big ? 0.02 : 0.03) : 0);
  const studentAccuracy = Math.min(big ? 0.91 : 0.86, raw);
  const share = s.share / 100;
  const monthlyCost = QUERIES * (share * 0.08 + (1 - share) * 0.9) + (share > 0 ? 30000 : 0);
  return { studentAccuracy, blended: share * studentAccuracy + (1 - share) * TEACHER_ACCURACY, monthlyCost, billShare: monthlyCost / ALL_TEACHER_BILL };
}
