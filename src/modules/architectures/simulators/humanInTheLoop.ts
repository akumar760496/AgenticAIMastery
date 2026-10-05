/** Human approval checkpoints for 1,000 daily refunds (30 wrong, worth ₹6,00,000): limit, evidence, staffing, durability. */
export const APPROVAL_LIMITS = [0, 2000, 5000, 10000, 25000, -1] as const;
export type ApprovalLimit = (typeof APPROVAL_LIMITS)[number];
export type ReviewView = 'bare' | 'evidence';
export type PauseStore = 'memory' | 'durable';
/** [share of refunds paused, share of wrong refunds paused, share of wrong money paused] */
const PAUSED: Readonly<Record<string, readonly [number, number, number]>> = { '0': [1, 1, 1], '2000': [0.4, 0.75, 0.92], '5000': [0.2, 0.6, 0.85], '10000': [0.09, 0.45, 0.75], '25000': [0.03, 0.2, 0.45], '-1': [0, 0, 0] };
export const WRONG_MONEY_INR = 600000;
export const CAREFUL_LIMIT = 150;
const LOST_ON_DEPLOY = 0.25;

export interface HitlState { readonly limit: ApprovalLimit; readonly view: ReviewView; readonly reviewers: number; readonly store: PauseStore }
export interface HitlResult { readonly paused: number; readonly perReviewer: number; readonly catchRate: number; readonly stoppedShare: number; readonly stoppedInr: number; readonly lost: number; readonly waitMin: number; readonly backlog: number; readonly wrongPaused: number }

export function simulateHitl(s: HitlState): HitlResult {
  const f = PAUSED[String(s.limit)]!;
  const paused = Math.round(1000 * f[0]);
  const perReviewer = paused / s.reviewers;
  const base = s.view === 'evidence' ? 0.95 : 0.6;
  const minutes = s.view === 'evidence' ? 2 : 0.5;
  const capacity = 480 / minutes;
  // Past 150 reviews a day each, approvals drift towards autopilot.
  const catchRate = paused ? base * Math.max(0.4, Math.min(1, CAREFUL_LIMIT / Math.max(perReviewer, 1))) : 0;
  const stoppedShare = f[2] * catchRate;
  const over = perReviewer > capacity;
  return {
    paused, perReviewer, catchRate, stoppedShare, stoppedInr: WRONG_MONEY_INR * stoppedShare,
    lost: s.store === 'memory' ? Math.round(paused * LOST_ON_DEPLOY) : 0,
    waitMin: paused && !over ? 5 + (60 * perReviewer) / capacity : 0,
    backlog: over ? Math.round((perReviewer - capacity) * s.reviewers) : 0,
    wrongPaused: Math.round(30 * f[1]),
  };
}
