import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent } from '@/shared/format';
import { SIMILARITY_THRESHOLDS, simulateSemanticCache, type SemanticCacheResult, type SemanticCacheState } from '../simulators/semanticCache';

const n = (v: number) => formatCount(Math.round(v));
const meetsTarget = (r: SemanticCacheResult) => r.hitRate >= 0.4 && r.falseHits <= 1000 && r.leaks === 0 && r.stale <= 1000;

export const semanticCachePlayground = definePlayground<SemanticCacheState, SemanticCacheResult>({
  techniqueId: 'semcache',
  title: 'Tarang Mobile’s support cache (fictional operator)',
  controls: [
    { kind: 'steps', key: 'threshold', label: 'Similarity threshold', values: SIMILARITY_THRESHOLDS, format: (v) => `≥ ${v.toFixed(2)}` },
    { kind: 'select', key: 'scope', label: 'Cache scope', options: [{ value: 'global', label: 'Global: shared by all users' }, { value: 'user', label: 'Per user' }] },
    { kind: 'select', key: 'ttl', label: 'Entry lifetime (TTL)', options: [{ value: '1h', label: '1 hour' }, { value: '24h', label: '24 hours' }, { value: '7d', label: '7 days' }] },
    { kind: 'toggle', key: 'excludeAccount', label: 'Account-specific intents skip the cache' },
    { kind: 'toggle', key: 'purgeOnChange', label: 'Purge tariff answers when the tariff page changes' },
    { kind: 'note', text: 'An LLM answer costs ₹0.40; a cache lookup ₹0.01. Mid-week the tariffs change. Account answers depend on live data, so any cached copy is wrong, and in a global cache it is someone else’s.' },
  ],
  presets: {
    start: { state: { threshold: 0.8, scope: 'global', ttl: '7d', excludeAccount: false, purgeOnChange: false }, expected: { hitRate: 0.965, savedInr: 37618.4, falseHits: 42420, leaks: 37620, stale: 47360.25 } },
    safe: { state: { threshold: 0.9, scope: 'global', ttl: '24h', excludeAccount: true, purgeOnChange: false }, expected: { falseHits: 720, leaks: 0, savedInr: 17640, stale: 5610 } },
    peruser: { state: { threshold: 0.9, scope: 'user', ttl: '24h', excludeAccount: false, purgeOnChange: false }, expected: { leaks: 0 } },
    tuned: { state: { threshold: 0.9, scope: 'global', ttl: '24h', excludeAccount: true, purgeOnChange: true }, expected: { falseHits: 720, leaks: 0, stale: 0, savedInr: 17640 } },
  },
  initialPreset: 'start',
  simulate: simulateSemanticCache,
  outputs: [
    { kind: 'meter', label: 'Hit rate', value: (r) => r.hitRate, detail: (r) => `= ${n(r.hits)} of 1,00,000 questions answered from the cache`, emphasis: (r) => (r.hitRate < 0.2 ? 'warn' : 'normal') },
    { kind: 'value', label: 'False hits a day', value: (r) => n(r.falseHits), detail: () => 'a stored answer served to a question it does not fit', emphasis: (r) => (r.falseHits > 1000 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Stale tariff answers after the change', value: (r) => n(r.stale), emphasis: (r) => (r.stale > 1000 ? 'warn' : 'normal') },
    { kind: 'value', label: '₹ saved a day', value: (r) => `₹${n(r.savedInr)}`, detail: (r) => `${n(r.hits)} × ₹0.40 − ${n(r.lookups)} lookups × ₹0.01` },
    { kind: 'value', label: 'Privacy leaks a day', value: (r) => n(r.leaks), detail: (r) => (r.leaks ? 'one customer’s account answer shown to another' : 'no personal answer is shared'), emphasis: (r) => (r.leaks ? 'warn' : 'normal') },
  ],
  verdict: (r) => {
    if (meetsTarget(r)) return { tone: 'ok', headline: 'Cheap, correct and private.', detail: 'Shared FAQ answers are reused, personal ones never are, and price changes are purged.' };
    if (r.leaks) return { tone: 'no', headline: 'Customers are seeing each other’s data.', detail: 'Account answers sit in a global cache. Exclude those intents, whatever the threshold.' };
    if (r.falseHits > 5000) return { tone: 'no', headline: 'Too many wrong answers.', detail: 'Raise the threshold and keep account intents out.' };
    if (r.hitRate < 0.2) return { tone: 'mid', headline: 'The cache barely hits.', detail: 'Per-user scope rarely sees a repeat. Share FAQ answers globally instead.' };
    if (r.stale > 1000) return { tone: 'mid', headline: 'Close, but not there yet.', detail: 'Old prices are still being served: purge on change or shorten the TTL.' };
    return { tone: 'mid', headline: 'Close, but not there yet.', detail: 'Raise the threshold to cut false hits.' };
  },
  narrate: (r, s) => [
    `At a ${s.threshold.toFixed(2)} threshold with a ${s.scope === 'global' ? 'global' : 'per-user'} cache, ${n(r.hits)} questions a day (${formatWholePercent(r.hitRate)}) skip the model, saving ₹${n(r.savedInr)} a day.`,
    s.scope === 'user' ? 'Each user rarely repeats their own question, so a per-user cache finds few matches.' : `FAQ paraphrases repeat across customers, so ${n(r.correctFaqHits)} are correct reuses.`,
    s.excludeAccount ? 'Account questions skip the cache.' : s.scope === 'global' ? `Account questions such as “what is my bill?” look alike for every customer, so ${n(r.leaks)} get another customer’s answer.` : 'Account answers are cached per user, but bills change, so cached copies go out of date.',
    `In all, ${n(r.falseHits)} answers a day are false hits.`,
    s.purgeOnChange ? 'When the tariffs change, old price answers are purged at once.' : `When the tariffs change, ${n(r.stale)} stale price answers go out before entries expire.`,
  ].join(' '),
  missions: {
    safe: ({ result }) => meetsTarget(result),
    leak: ({ state, result }) => state.threshold >= 0.98 && result.leaks > 0,
    ttlonly: ({ state, result }) => !state.purgeOnChange && result.stale < 500 && result.hitRate >= 0.3 && result.leaks === 0,
  },
});
