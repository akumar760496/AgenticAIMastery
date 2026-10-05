/** Online LLM-judge monitoring of 50,000 daily answers: sample rate, alert window and threshold against a real 6-point drop. */
import { normalCdf } from '@/shared/statistics';

const DAILY = 50000;
const BASE_PASS = 0.92;
const DROPPED_PASS = 0.86;
const INR_PER_JUDGEMENT = 0.4;
const HOURS_PER_WEEK = 168;

export interface OnlineEvalState { readonly sampleRate: number; readonly windowHours: number; readonly thresholdPts: number }
export interface OnlineEvalResult { readonly judgedPerWindow: number; readonly noiseSe: number; readonly falseAlertsPerWeek: number; readonly detectProbability: number; readonly delayHours: number; readonly costPerDay: number }

export function simulateOnlineEval(s: OnlineEvalState): OnlineEvalResult {
  const n = (DAILY / 24) * s.windowHours * s.sampleRate;
  const thr = s.thresholdPts / 100;
  const se0 = Math.sqrt((BASE_PASS * (1 - BASE_PASS)) / n);
  const se1 = Math.sqrt((DROPPED_PASS * (1 - DROPPED_PASS)) / n);
  const detectProbability = normalCdf((BASE_PASS - DROPPED_PASS - thr) / se1);
  return {
    judgedPerWindow: n, noiseSe: se0,
    falseAlertsPerWeek: (HOURS_PER_WEEK / s.windowHours) * normalCdf(-thr / se0),
    detectProbability, delayHours: s.windowHours / detectProbability,
    costPerDay: DAILY * s.sampleRate * INR_PER_JUDGEMENT,
  };
}
