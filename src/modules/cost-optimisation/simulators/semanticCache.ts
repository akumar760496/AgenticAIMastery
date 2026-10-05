/** Semantic response cache for a (fictional) telecom operator: 1,00,000 questions a day. */
export type CacheScope = 'global' | 'user';
export type EntryTtl = '1h' | '24h' | '7d';

export const SIMILARITY_THRESHOLDS = [0.8, 0.85, 0.9, 0.95, 0.98] as const;
export type SimilarityThreshold = (typeof SIMILARITY_THRESHOLDS)[number];
export const DAILY_QUESTIONS = { total: 100000, faq: 60000, tariff: 15000, account: 40000 } as const;
export const LLM_COST_INR = 0.4;
export const LOOKUP_COST_INR = 0.01;

const FAQ_RECALL = [0.97, 0.93, 0.85, 0.62, 0.3];
const FAQ_FALSE_RATE = [0.08, 0.035, 0.012, 0.003, 0.0005];
const ACCOUNT_MATCH = [0.99, 0.98, 0.96, 0.92, 0.85];
const REPEAT_RATE: Readonly<Record<CacheScope, Readonly<Record<EntryTtl, number>>>> = { global: { '1h': 0.7, '24h': 0.88, '7d': 0.93 }, user: { '1h': 0.03, '24h': 0.06, '7d': 0.1 } };
const ACCOUNT_REPEAT: Readonly<Record<CacheScope, Readonly<Record<EntryTtl, number>>>> = { global: { '1h': 0.8, '24h': 0.92, '7d': 0.95 }, user: { '1h': 0.04, '24h': 0.08, '7d': 0.12 } };
const TTL_DAYS: Readonly<Record<EntryTtl, number>> = { '1h': 1 / 24, '24h': 1, '7d': 7 };
const USER_SCOPE_FALSE_FACTOR = 0.05;

export interface SemanticCacheState {
  readonly threshold: SimilarityThreshold;
  readonly scope: CacheScope;
  readonly ttl: EntryTtl;
  readonly excludeAccount: boolean;
  readonly purgeOnChange: boolean;
}

export interface SemanticCacheResult {
  readonly hits: number;
  readonly hitRate: number;
  readonly correctFaqHits: number;
  readonly falseHits: number;
  readonly leaks: number;
  readonly stale: number;
  readonly savedInr: number;
  readonly lookups: number;
}

export function simulateSemanticCache(s: SemanticCacheState): SemanticCacheResult {
  const i = SIMILARITY_THRESHOLDS.indexOf(s.threshold);
  const repeat = REPEAT_RATE[s.scope][s.ttl];
  const correctFaqHits = DAILY_QUESTIONS.faq * repeat * (FAQ_RECALL[i] ?? 0);
  const faqFalse = DAILY_QUESTIONS.faq * (FAQ_FALSE_RATE[i] ?? 0) * (s.scope === 'global' ? 1 : USER_SCOPE_FALSE_FACTOR);
  const accountHits = s.excludeAccount ? 0 : DAILY_QUESTIONS.account * ACCOUNT_REPEAT[s.scope][s.ttl] * (ACCOUNT_MATCH[i] ?? 0);
  const hits = correctFaqHits + faqFalse + accountHits;
  const tariffHits = DAILY_QUESTIONS.tariff * repeat * (FAQ_RECALL[i] ?? 0);
  const lookups = s.excludeAccount ? DAILY_QUESTIONS.faq : DAILY_QUESTIONS.total;
  return {
    hits,
    hitRate: hits / DAILY_QUESTIONS.total,
    correctFaqHits,
    falseHits: faqFalse + accountHits,
    leaks: s.scope === 'global' ? accountHits : 0,
    stale: s.purgeOnChange ? 0 : (tariffHits * TTL_DAYS[s.ttl]) / 2,
    savedInr: hits * LLM_COST_INR - lookups * LOOKUP_COST_INR,
    lookups,
  };
}
