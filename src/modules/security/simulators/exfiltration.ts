/** Exfiltration channels for 10,000 monthly injection attempts (5% steer the agent): images, web fetch, email and controls. */
export type DataScope = 'all' | 'self';
const ATTEMPTS = 10000;
const STEER_RATE = 0.05;

export interface ExfiltrationState { readonly scope: DataScope; readonly images: boolean; readonly web: boolean; readonly email: boolean; readonly allowlist: boolean; readonly dlp: boolean; readonly approval: boolean }
export interface ExfiltrationResult { readonly viaImages: number; readonly viaWeb: number; readonly viaEmail: number; readonly leakShare: number; readonly perLeak: number; readonly steered: number; readonly recordsPerMonth: number }

export function simulateExfiltration(s: ExfiltrationState): ExfiltrationResult {
  const viaImages = s.images ? (s.allowlist ? 0 : 1) : 0;
  const viaWeb = s.web ? (s.allowlist ? 0.005 : 0.8) : 0;
  const viaEmail = s.email ? 0.7 * (s.approval ? 0.1 : 1) * (s.dlp ? 0.2 : 1) : 0;
  const leakShare = 1 - (1 - viaImages) * (1 - viaWeb) * (1 - viaEmail);
  const perLeak = s.scope === 'all' ? 500 : 1;
  const steered = ATTEMPTS * STEER_RATE;
  return { viaImages, viaWeb, viaEmail, leakShare, perLeak, steered, recordsPerMonth: steered * leakShare * perLeak };
}
