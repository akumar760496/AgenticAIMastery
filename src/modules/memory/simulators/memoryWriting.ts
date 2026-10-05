/** What to write to long-term memory: stability threshold, sensitive-data filter, conflicts, TTL and erasure scope. */
export type ConflictPolicy = 'both' | 'newer';
export type ErasureScope = 'rows' | 'rowsvec' | 'all';
type Kind = 'pref' | 'otp' | 'pan' | 'health' | 'old' | 'new' | 'oneoff';
export const CANDIDATES: readonly { readonly text: string; readonly kind: Kind; readonly stability: number; readonly sensitive: boolean }[] = [
  { text: 'Prefers Hindi', kind: 'pref', stability: 0.9, sensitive: false }, { text: 'Statements by email', kind: 'pref', stability: 0.85, sensitive: false },
  { text: 'No SMS alerts', kind: 'pref', stability: 0.8, sensitive: false }, { text: 'OTP from an SMS', kind: 'otp', stability: 0.6, sensitive: true },
  { text: 'PAN number', kind: 'pan', stability: 0.88, sensitive: true }, { text: 'Hospital visit in May', kind: 'health', stability: 0.7, sensitive: true },
  { text: 'Old address: Pune', kind: 'old', stability: 0.8, sensitive: false }, { text: 'New address: Bengaluru', kind: 'new', stability: 0.85, sensitive: false },
  { text: 'App crashed on login', kind: 'oneoff', stability: 0.4, sensitive: false }, { text: 'Asked the gold rate', kind: 'oneoff', stability: 0.25, sensitive: false },
];

export interface MemoryWritingState { readonly threshold: number; readonly blockSensitive: boolean; readonly conflict: ConflictPolicy; readonly ttl: boolean; readonly erasureRequested: boolean; readonly erasureScope: ErasureScope }
export interface MemoryWritingResult { readonly stored: readonly string[]; readonly storedCount: number; readonly sensitive: number; readonly preferences: number; readonly stale: number; readonly oldAddressValid: boolean; readonly oldAddressInvalidated: boolean; readonly expired: number; readonly copies: number; readonly survivingCopies: number | null }

export function simulateMemoryWriting(s: MemoryWritingState): MemoryWritingResult {
  const stored = CANDIDATES.filter((c) => c.stability >= s.threshold - 1e-9 && !(s.blockSensitive && c.sensitive));
  const has = (k: Kind) => stored.some((c) => c.kind === k);
  const oldAddressValid = has('old') && !(s.conflict === 'newer' && has('new'));
  const oneOffs = stored.filter((c) => c.kind === 'oneoff').length;
  const n = stored.length;
  // Each saved item has a row and a vector; the rolling summary and profile cache add one copy each.
  const survivingCopies = !s.erasureRequested ? null : n === 0 ? 0 : s.erasureScope === 'rows' ? n + 2 : s.erasureScope === 'rowsvec' ? 2 : 0;
  return {
    stored: stored.map((c) => c.text), storedCount: n,
    sensitive: stored.filter((c) => c.sensitive).length, preferences: stored.filter((c) => c.kind === 'pref').length,
    stale: (oldAddressValid ? 1 : 0) + (s.ttl ? 0 : oneOffs), oldAddressValid, oldAddressInvalidated: has('old') && !oldAddressValid,
    expired: s.ttl ? oneOffs : 0, copies: n ? 2 * n + 2 : 0, survivingCopies,
  };
}
