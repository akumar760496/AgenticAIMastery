/** Five KYC calls in one turn: sequential or parallel, declared dependencies, a timeout and per-call error handling. */
export const CALLS = [
  { short: 'PAN', name: 'pan_verify' }, { short: 'CKYC', name: 'ckyc_search' }, { short: 'Aadhaar', name: 'aadhaar_otp_status' },
  { short: 'Bureau', name: 'bureau_pull' }, { short: 'Open', name: 'open_account' },
] as const;
const BUREAU = 3;
/** 'none', 'all' (every earlier call) or the index of one earlier call. */
export type Dependency = string;

export interface ParallelState {
  readonly lat0: number; readonly lat1: number; readonly lat2: number; readonly lat3: number; readonly lat4: number;
  readonly dep1: Dependency; readonly dep2: Dependency; readonly dep3: Dependency; readonly dep4: Dependency;
  readonly parallel: boolean; readonly bureauTimesOut: boolean; readonly catchErrors: boolean;
}
export interface CallTiming { readonly start: number; readonly end: number; readonly skipped: boolean; readonly failed: boolean }
export interface ParallelResult { readonly timings: readonly CallTiming[]; readonly wallMs: number; readonly sumMs: number; readonly criticalPath: number; readonly returned: number; readonly skipped: number }

export function simulateParallel(s: ParallelState): ParallelResult {
  const lat = [s.lat0, s.lat1, s.lat2, s.lat3, s.lat4];
  const dep = ['none', s.dep1, s.dep2, s.dep3, s.dep4];
  const deps = (i: number) => (dep[i] === 'none' ? [] : dep[i] === 'all' ? [...Array(i).keys()] : [Number(dep[i])]);
  const start: number[] = []; const end: number[] = []; const skip: boolean[] = []; const pred: number[] = [];
  let prev = 0;
  for (let i = 0; i < 5; i++) {
    const ds = deps(i);
    skip[i] = s.bureauTimesOut && ds.some((j) => j === BUREAU || skip[j]);
    if (s.parallel) { let st0 = 0; let pj = -1; ds.forEach((j) => { if (end[j]! > st0) { st0 = end[j]!; pj = j; } }); start[i] = st0; pred[i] = pj; }
    else { start[i] = prev; pred[i] = i - 1; }
    end[i] = start[i]! + (skip[i] ? 0 : lat[i]!);
    prev = end[i]!;
  }
  const wallMs = Math.max(...end);
  let criticalPath = 0;
  for (let at = end.indexOf(wallMs); at >= 0; at = pred[at]!) if (!skip[at]) criticalPath++;
  return {
    timings: lat.map((_, i) => ({ start: start[i]!, end: end[i]!, skipped: skip[i]!, failed: s.bureauTimesOut && i === BUREAU })),
    wallMs, sumMs: lat.reduce((a, b) => a + b, 0), criticalPath,
    returned: s.bureauTimesOut && !s.catchErrors ? 0 : 5,
    skipped: skip.filter(Boolean).length,
  };
}
