/** GRPO maths tutor: reward design, verifier strength, group size and steps; 0.02 GPU-hours a sample at ₹250 an hour. */
export type RewardKind = 'fmt' | 'ans' | 'work';
export type VerifierStrength = 'weak' | 'strong';
export interface RlvrState { readonly reward: RewardKind; readonly verifier: VerifierStrength; readonly group: number; readonly steps: number }
export interface RlvrResult { readonly trueAccuracy: number; readonly observedReward: number; readonly gap: number; readonly cost: number }

const GROUP_FACTOR: Readonly<Record<number, number>> = { 2: 0.6, 4: 0.85, 8: 1, 16: 1.05 };

export function simulateRlvr(s: RlvrState): RlvrResult {
  const progress = 1 - Math.exp(-s.steps / 400);
  const g = GROUP_FACTOR[s.group] ?? 1;
  let trueAccuracy: number; let observedReward: number;
  if (s.reward === 'fmt') { trueAccuracy = 42; observedReward = 60 + 37 * progress; }
  else if (s.reward === 'ans') { trueAccuracy = 40 + 25 * progress * g; observedReward = trueAccuracy + (s.verifier === 'weak' ? 6 : 1); }
  else { trueAccuracy = 40 + 32 * progress * g * (s.verifier === 'strong' ? 1 : 0.8); observedReward = trueAccuracy + (s.verifier === 'weak' ? (12 * s.steps) / 1000 : 1); }
  return { trueAccuracy, observedReward, gap: observedReward - trueAccuracy, cost: s.steps * s.group * 0.02 * 250 };
}
