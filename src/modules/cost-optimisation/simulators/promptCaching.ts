/** Prompt caching for one research session: write and read multipliers, lifetimes and cache breakers. */
export type CacheLifetime = '5m' | '1h';
export const QUESTION_TOKENS = 200;
export const MIN_CACHEABLE_TOKENS = 1024;
export const INPUT_USD_PER_TOKEN = 3e-6;
export const READ_MULTIPLIER = 0.1;
export const WRITE_MULTIPLIER: Readonly<Record<CacheLifetime, number>> = { '5m': 1.25, '1h': 2 };
export const LIFETIME_MINUTES: Readonly<Record<CacheLifetime, number>> = { '5m': 5, '1h': 60 };

export interface PromptCachingState {
  readonly prefixTokens: number;
  readonly calls: number;
  readonly cachingOn: boolean;
  readonly timestampInPrefix: boolean;
  readonly gapMinutes: number;
  readonly lifetime: CacheLifetime;
}

export interface PromptCachingResult {
  readonly writes: number;
  readonly reads: number;
  readonly fullPriceCalls: number;
  readonly cacheable: boolean;
  readonly writeMultiplier: number;
  readonly costUsd: number;
  readonly baselineUsd: number;
  readonly relativeCost: number;
  readonly saving: number;
  readonly hitRate: number;
  readonly expires: boolean;
}

export function simulatePromptCaching(s: PromptCachingState): PromptCachingResult {
  const baselineUnits = s.calls * (s.prefixTokens + QUESTION_TOKENS);
  const cacheable = s.cachingOn && s.prefixTokens >= MIN_CACHEABLE_TOKENS;
  const writeMultiplier = WRITE_MULTIPLIER[s.lifetime];
  const expires = s.gapMinutes >= LIFETIME_MINUTES[s.lifetime];
  let writes = 0;
  let reads = 0;
  if (cacheable) {
    if (s.timestampInPrefix || expires) writes = s.calls;
    else { writes = 1; reads = s.calls - 1; }
  }
  const fullPriceCalls = s.calls - writes - reads;
  const units = writes * s.prefixTokens * writeMultiplier + reads * s.prefixTokens * READ_MULTIPLIER + fullPriceCalls * s.prefixTokens + s.calls * QUESTION_TOKENS;
  return {
    writes, reads, fullPriceCalls, cacheable, writeMultiplier, expires,
    costUsd: units * INPUT_USD_PER_TOKEN,
    baselineUsd: baselineUnits * INPUT_USD_PER_TOKEN,
    relativeCost: units / baselineUnits,
    saving: 1 - units / baselineUnits,
    hitRate: (reads * s.prefixTokens) / baselineUnits,
  };
}
