/** Turning user signals into fixes over eight weeks: signals captured, weekly triage and a data flywheel. */
export type Capture = 'thumbs' | 'implicit' | 'both';
const DETECTED: Readonly<Record<Capture, number>> = { thumbs: 0.25, implicit: 0.55, both: 0.7 };
const TRIAGE_HOURS: Readonly<Record<Capture, number>> = { thumbs: 6, implicit: 14, both: 12 };
const SIGNALS: Readonly<Record<Capture, number>> = { thumbs: 3000, implicit: 30000, both: 33000 };
export const BASE_RESOLUTION = 0.72;

export interface FeedbackState { readonly capture: Capture; readonly triage: boolean; readonly flywheel: boolean }
export interface FeedbackResult { readonly detected: number; readonly fixDays: number; readonly gainPts: number; readonly resolution: number; readonly hoursPerWeek: number; readonly signalsPerWeek: number }

export function simulateFeedback(s: FeedbackState): FeedbackResult {
  const detected = DETECTED[s.capture];
  const gainPts = s.triage ? Math.round(detected * (s.flywheel ? 10 : 5) * 10) / 10 : 0;
  return {
    detected, fixDays: s.triage ? 10 : 45, gainPts,
    resolution: Math.round((BASE_RESOLUTION + gainPts / 100) * 1000) / 1000,
    hoursPerWeek: s.triage ? TRIAGE_HOURS[s.capture] + (s.flywheel ? 4 : 0) : 0,
    signalsPerWeek: SIGNALS[s.capture],
  };
}
