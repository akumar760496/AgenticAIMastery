/** DPO on adviser preference pairs: pairs, label noise, beta, SFT start and length bias; win rate vs the current model. */
export interface DpoState { readonly pairs: number; readonly noise: number; readonly beta: number; readonly lengthBias: boolean; readonly fromSft: boolean }
export interface DpoResult { readonly winRate: number; readonly regression: number; readonly lengthChange: number; readonly netPairs: number }

const DATA_FACTOR: Readonly<Record<number, number>> = { 1000: 0.6, 5000: 0.85, 20000: 1 };
const BETA_FACTOR: Readonly<Record<number, number>> = { 0.01: 1.1, 0.1: 1, 0.5: 0.6 };
const BETA_REGRESSION: Readonly<Record<number, number>> = { 0.01: 6, 0.1: 1, 0.5: 0 };

export function simulateDpo(s: DpoState): DpoResult {
  const winRate = 50 + 18 * (DATA_FACTOR[s.pairs] ?? 0) * (1 - 2 * s.noise) * (BETA_FACTOR[s.beta] ?? 1) * (s.fromSft ? 1 : 0.6) - (s.lengthBias ? 3 : 0);
  return {
    winRate,
    regression: (BETA_REGRESSION[s.beta] ?? 0) + (s.fromSft ? 0 : 2),
    lengthChange: s.lengthBias ? 45 : winRate > 55 ? -8 : 0,
    netPairs: s.pairs * (1 - 2 * s.noise),
  };
}
