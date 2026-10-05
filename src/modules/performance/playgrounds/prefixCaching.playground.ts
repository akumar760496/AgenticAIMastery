import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent } from '@/shared/format';
import { simulatePrefixCaching, type PrefixCachingResult, type PrefixCachingState } from '../simulators/prefixCaching';

const base: PrefixCachingState = { prefixTokens: 6000, newTokens: 300, cachingOn: true, timestampFirst: false, replicas: 4, cacheAwareRouting: false };
const n = (v: number) => (v % 1 ? v.toFixed(1) : String(v));

export const prefixCachingPlayground = definePlayground<PrefixCachingState, PrefixCachingResult>({
  techniqueId: 'prefix',
  title: 'Prompt and serving setup',
  intro: 'Eight tenants each have their own system prompt. A replica’s GPU memory holds the cached prefixes of 4 tenants. Prefill runs at 10,000 tokens per second.',
  controls: [
    { kind: 'steps', key: 'prefixTokens', label: 'Shared system prompt + tools', values: Array.from({ length: 39 }, (_, i) => 1000 + i * 500), format: (v) => `${formatCount(v)} tokens` },
    { kind: 'steps', key: 'newTokens', label: 'New tokens per request', values: Array.from({ length: 20 }, (_, i) => (i + 1) * 100), format: (v) => `${formatCount(v)} tokens` },
    { kind: 'toggle', key: 'cachingOn', label: 'Prefix caching on' },
    { kind: 'toggle', key: 'timestampFirst', label: 'Put the current time in the first line of the system prompt' },
    { kind: 'steps', key: 'replicas', label: 'Replicas', values: [1, 2, 3, 4, 5, 6, 7, 8], format: String },
    { kind: 'toggle', key: 'cacheAwareRouting', label: 'Cache-aware routing (same tenant → same replica)' },
  ],
  presets: {
    start: { state: base, expected: { hitRate: 0.5, prefilledTokens: 3300, ttftS: 0.33 } },
    sticky: { state: { ...base, cacheAwareRouting: true }, expected: { hitRate: 1, prefilledTokens: 300, ttftS: 0.03 } },
    ts: { state: { ...base, cacheAwareRouting: true, timestampFirst: true }, expected: { hitRate: 0, ttftS: 0.63 } },
    off: { state: { ...base, cachingOn: false }, expected: { prefilledTokens: 6300, ttftS: 0.63 } },
  },
  initialPreset: 'start',
  simulate: simulatePrefixCaching,
  outputs: [
    { kind: 'meter', label: 'Prefix cache hit rate', value: (r) => r.hitRate },
    { kind: 'meter', label: 'Prompt tokens reused', value: (r) => r.reused, detail: (r) => `= ${formatCount(r.totalTokens - r.prefilledTokens)} of ${formatCount(r.totalTokens)} tokens skip prefill` },
    { kind: 'value', label: 'Time to first token (prefill)', value: (r) => `${r.ttftS.toFixed(2)} s`, detail: (r) => `no cache: ${r.uncachedTtftS.toFixed(2)} s` },
    { kind: 'value', label: 'Tenants per replica', value: (r) => n(r.tenantsPerReplica) },
  ],
  verdict: (r, s) => ({
    tone: r.hitRate >= 1 ? 'ok' : r.hitRate > 0 ? 'mid' : 'no',
    headline: r.hitRate >= 1 ? 'Every request reuses its prefix.' : r.hitRate > 0 ? 'Some prefixes are evicted before reuse.' : 'No reuse at all.',
    detail: s.timestampFirst && s.cachingOn ? 'Move changing text to the end of the prompt.' : !s.cachingOn ? 'Turn caching on.' : r.hitRate < 1 ? 'Route each tenant to the same replica.' : 'Only the new tokens are prefilled.',
  }),
  narrate: (r, s) => [
    !s.cachingOn ? 'Prefix caching is off, so every request recomputes the whole prompt.'
      : s.timestampFirst ? 'The timestamp makes the very first block different on every request, and because each block hash includes its parent, nothing after it can match either.'
        : `Each replica sees ${n(r.tenantsPerReplica)} tenants but keeps only 4 prefixes warm, so the hit rate is ${formatWholePercent(r.hitRate)}. ${s.cacheAwareRouting ? 'Cache-aware routing sends each tenant to the replica that already holds its prefix.' : 'Random routing sends every tenant to every replica, so adding replicas does not help.'}`,
    `Prefill work is ${formatCount(r.prefilledTokens)} of ${formatCount(r.totalTokens)} tokens: time to first token ${r.ttftS.toFixed(2)} s against ${r.uncachedTtftS.toFixed(2)} s without reuse.`,
  ].join(' '),
  missions: {
    sticky: ({ state, result }) => state.replicas >= 4 && state.cachingOn && result.ttftS <= 0.03 + 1e-9,
    zero: ({ state, result }) => state.cachingOn && result.hitRate === 0,
    fewest: ({ state, result }) => state.cacheAwareRouting && result.hitRate === 1 && state.replicas === 2,
  },
});
