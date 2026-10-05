/** Is the canary big enough? Power of a one-sided test at 5% significance for the true difference. */
import { normalCdf } from '@/shared/statistics';

export type TrueVersion = 'worse' | 'same' | 'better';
const PER_HOUR = 2000;
export const CONTROL_SUCCESS = 0.94;
const CANARY_SUCCESS: Readonly<Record<TrueVersion, number>> = { worse: 0.9, same: 0.94, better: 0.95 };

export interface CanaryState { readonly truth: TrueVersion; readonly share: number; readonly hours: number }
export interface CanaryResult { readonly canaryN: number; readonly controlN: number; readonly standardError: number; readonly power: number | null; readonly extraFailures: number; readonly canarySuccess: number; readonly fullRolloutExtra: number }

export function simulateCanary(s: CanaryState): CanaryResult {
  const pc = CANARY_SUCCESS[s.truth];
  const canaryN = PER_HOUR * s.share * s.hours;
  const controlN = PER_HOUR * (1 - s.share) * s.hours;
  const standardError = Math.sqrt((pc * (1 - pc)) / canaryN + (CONTROL_SUCCESS * (1 - CONTROL_SUCCESS)) / controlN);
  return {
    canaryN, controlN, standardError, canarySuccess: pc,
    power: s.truth === 'same' ? null : normalCdf(Math.abs(pc - CONTROL_SUCCESS) / standardError - 1.645),
    extraFailures: s.truth === 'worse' ? canaryN * (CONTROL_SUCCESS - pc) : 0,
    fullRolloutExtra: PER_HOUR * s.hours * 0.04,
  };
}
