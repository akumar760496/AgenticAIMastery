import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent, pluralise } from '@/shared/format';
import { simulatePromptCaching, type PromptCachingResult, type PromptCachingState } from '../simulators/promptCaching';

const base: PromptCachingState = { prefixTokens: 12000, calls: 20, cachingOn: false, timestampInPrefix: false, gapMinutes: 2, lifetime: '5m' };
const usd3 = (v: number) => `$${v.toFixed(3)}`;

export const promptCachingPlayground = definePlayground<PromptCachingState, PromptCachingResult>({
  techniqueId: 'caching',
  title: 'One research session',
  controls: [
    { kind: 'steps', key: 'prefixTokens', label: 'Stable prefix (tools, instructions, report)', values: Array.from({ length: 80 }, (_, i) => (i + 1) * 500), format: (v) => `${formatCount(v)} tokens` },
    { kind: 'steps', key: 'calls', label: 'Calls in the session', values: Array.from({ length: 40 }, (_, i) => i + 1), format: String },
    { kind: 'select', key: 'gapMinutes', label: 'Time between calls', options: [{ value: '2', label: '2 minutes' }, { value: '20', label: '20 minutes' }] },
    { kind: 'select', key: 'lifetime', label: 'Cache lifetime', options: [{ value: '5m', label: '5 minutes (write 1.25×)' }, { value: '1h', label: '1 hour (write 2×)' }] },
    { kind: 'toggle', key: 'cachingOn', label: 'Mark the prefix for caching' },
    { kind: 'toggle', key: 'timestampInPrefix', label: 'Put the current time at the top of the system prompt' },
    { kind: 'note', text: '$3 per million input tokens · cache reads 0.1× · each call adds a 200-token question · minimum cacheable prefix 1,024 tokens.' },
  ],
  presets: {
    start: { state: base, expected: { costUsd: 0.732, hitRate: 0 } },
    cached: { state: { ...base, cachingOn: true }, expected: { writes: 1, reads: 19 } },
    stamp: { state: { ...base, cachingOn: true, timestampInPrefix: true }, expected: { writes: 20, reads: 0 } },
    slow: { state: { ...base, cachingOn: true, gapMinutes: 20 }, expected: { writes: 20, reads: 0 } },
  },
  initialPreset: 'start',
  simulate: simulatePromptCaching,
  outputs: [
    { kind: 'meter', label: 'Input cost vs no caching', value: (r) => Math.min(1, r.relativeCost), detail: (r) => `= ${usd3(r.costUsd)} vs ${usd3(r.baselineUsd)} per session`, emphasis: (r) => (r.relativeCost > 0.5 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Cache hit rate', value: (r) => r.hitRate, detail: () => '= tokens read from cache ÷ all input tokens' },
    { kind: 'value', label: 'Cache writes · reads', value: (r) => `${r.writes} · ${r.reads}`, detail: (r) => `writes bill at ${r.writeMultiplier}× · reads at 0.1× · ${r.fullPriceCalls} ${pluralise(r.fullPriceCalls, 'call')} at full price` },
    { kind: 'value', label: 'Saving on input', value: (r) => (r.saving < 0 ? `−${formatWholePercent(-r.saving)} (costs more)` : formatWholePercent(r.saving)), emphasis: (r) => (r.saving < 0 ? 'warn' : 'normal') },
  ],
  verdict: (r, s) => {
    if (r.saving >= 0.7) return { tone: 'ok', headline: 'The cache is doing its job.', detail: 'Only the first call pays to write the prefix.' };
    if (r.saving < 0) return { tone: 'no', headline: 'Caching is costing you money.', detail: 'Every call writes a new entry and none are read.' };
    if (r.saving === 0) return { tone: 'mid', headline: 'Nothing is being cached.', detail: s.cachingOn ? 'The prefix is below the minimum size.' : 'Turn caching on for the stable prefix.' };
    return { tone: 'mid', headline: 'Some saving, but more is available.', detail: 'More calls within the cache lifetime would raise the hit rate.' };
  },
  narrate: (r, s) => {
    if (!s.cachingOn) return `Caching is off, so all ${s.calls} calls pay full price for the ${formatCount(s.prefixTokens)}-token prefix: ${usd3(r.costUsd)} per session.`;
    if (!r.cacheable) return `The prefix is only ${formatCount(s.prefixTokens)} tokens, below the 1,024-token minimum, so nothing is cached even though caching is switched on.`;
    if (s.timestampInPrefix) return `The timestamp sits above the breakpoint, so the prefix differs on every call. Each call writes a fresh entry at ${r.writeMultiplier}× and nothing is read, so the session costs ${formatWholePercent(-r.saving)} more than not caching.`;
    if (r.expires) return `Calls arrive every ${s.gapMinutes} minutes but entries live ${s.lifetime === '1h' ? '1 hour' : '5 minutes'}, so every call finds the cache expired and writes it again at ${r.writeMultiplier}×.`;
    return `Call 1 writes the prefix at ${r.writeMultiplier}×; the next ${r.reads} ${pluralise(r.reads, 'call')} read it at 0.1×, so the hit rate is ${formatWholePercent(r.hitRate)} and input cost falls by ${formatWholePercent(r.saving)}.`;
  },
  missions: {
    save85: ({ result }) => result.saving >= 0.85,
    expire: ({ state, result }) => state.gapMinutes === 20 && result.saving > 0.75,
    mincache: ({ state, result }) => state.cachingOn && !result.cacheable,
  },
});
