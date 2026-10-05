/** A bad prompt paying duplicate refunds at ₹1,000 a minute: detection, response, trace capture and a regression case. */
export type Detection = 'complaints' | 'anomaly';
export type Response = 'hotfix' | 'kill';
export type TraceCapture = 'logs' | 'full';
const INR_PER_MIN = 1000;
const DAY_MIN = 1440;

export interface IncidentState { readonly detection: Detection; readonly response: Response; readonly traces: TraceCapture; readonly addEvalCase: boolean }
export interface IncidentResult { readonly detectMin: number; readonly containMin: number | null; readonly lostInr: number; readonly rootCause: boolean; readonly recurrencePct: number }

export function simulateIncident(s: IncidentState): IncidentResult {
  const detectMin = s.detection === 'anomaly' ? 12 : 240;
  const rootCause = s.traces === 'full';
  let containMin: number | null = null;
  let lostInr: number;
  if (s.response === 'kill') { containMin = 5; lostInr = INR_PER_MIN * (detectMin + 5); }
  else {
    // A live hotfix after 40 minutes stops only 75% of duplicates; a replay-tested fix stops the rest at 60 minutes.
    const partial = detectMin + 40;
    const end = rootCause ? detectMin + 60 : DAY_MIN;
    if (rootCause) containMin = 60;
    lostInr = INR_PER_MIN * partial + (INR_PER_MIN / 4) * (end - partial);
  }
  return { detectMin, containMin, lostInr, rootCause, recurrencePct: rootCause ? (s.addEvalCase ? 5 : 35) : s.addEvalCase ? 50 : 60 };
}
