/** Yatra Setu (fictional) booking agent: base 8B 48%, teacher 78%; each trajectory ₹15 to generate and ₹6 to train on. */
export type TrajectorySource = 'raw' | 'filtered';
export interface AgentTuningState { readonly data: TrajectorySource; readonly mask: boolean; readonly trajectories: number }
export interface AgentTuningResult { readonly success: number; readonly invented: number; readonly cost: number; readonly gapToTeacher: number }

export const TEACHER_SUCCESS = 0.78;
const SIZE_EFFECT: Readonly<Record<number, number>> = { 500: -0.06, 2000: 0, 8000: 0.03 };

export function simulateAgentTuning(s: AgentTuningState): AgentTuningResult {
  const success = Math.round(({ raw: 0.55, filtered: 0.68 }[s.data] + (s.mask ? 0.05 : 0) + (SIZE_EFFECT[s.trajectories] ?? 0)) * 1000) / 1000;
  return {
    success,
    invented: s.mask ? 0.02 : { raw: 0.12, filtered: 0.09 }[s.data],
    cost: s.trajectories * 21,
    gapToTeacher: Math.round((TEACHER_SUCCESS - success) * 1000) / 1000,
  };
}
