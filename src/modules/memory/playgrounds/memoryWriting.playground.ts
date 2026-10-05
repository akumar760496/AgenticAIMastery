import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { simulateMemoryWriting, type MemoryWritingResult, type MemoryWritingState } from '../simulators/memoryWriting';

const base: MemoryWritingState = { threshold: 0.3, blockSensitive: false, conflict: 'both', ttl: false, erasureRequested: false, erasureScope: 'rows' };

export const memoryWritingPlayground = definePlayground<MemoryWritingState, MemoryWritingResult>({
  techniqueId: 'memwrite',
  title: '10 candidate memories from a bank chat (stability score)',
  intro: 'The store is shown 90 days later. Each saved item has a row and a vector; the rolling summary and profile cache add one copy each.',
  controls: [
    { kind: 'steps', key: 'threshold', label: 'Save threshold', values: Array.from({ length: 21 }, (_, i) => Math.round(i * 5) / 100), format: (v) => v.toFixed(2) },
    { kind: 'toggle', key: 'blockSensitive', label: 'Block sensitive data (OTP, PAN, health)' },
    { kind: 'toggle', key: 'ttl', label: '30-day TTL on one-off items' },
    { kind: 'select', key: 'conflict', label: 'When facts conflict', options: [{ value: 'both', label: 'keep both' }, { value: 'newer', label: 'newer wins, older invalidated' }] },
    { kind: 'toggle', key: 'erasureRequested', label: 'The customer requests erasure' },
    { kind: 'select', key: 'erasureScope', label: 'Erasure deletes', options: [{ value: 'rows', label: 'table rows' }, { value: 'rowsvec', label: 'rows and vectors' }, { value: 'all', label: 'rows, vectors, summary and cache' }] },
  ],
  presets: {
    start: { state: base, expected: { storedCount: 9, sensitive: 3, stale: 2 } },
    thresh: { state: { ...base, threshold: 0.7 }, expected: { storedCount: 7, preferences: 3, sensitive: 2 } },
    filter: { state: { ...base, threshold: 0.85, blockSensitive: true }, expected: { sensitive: 0, stale: 0, preferences: 2 } },
    erase: { state: { ...base, erasureRequested: true }, expected: { storedCount: 9, survivingCopies: 11 } },
  },
  initialPreset: 'start',
  simulate: simulateMemoryWriting,
  outputs: [
    { kind: 'badges', items: (r) => r.stored.map((t) => ({ text: t, emphasis: 'normal' as const })) },
    { kind: 'value', label: 'Stored', value: (r) => `${r.storedCount} of 10` },
    { kind: 'value', label: 'Sensitive items stored', value: (r) => String(r.sensitive), emphasis: (r) => (r.sensitive ? 'warn' : 'normal') },
    { kind: 'value', label: 'Preferences kept', value: (r) => `${r.preferences} of 3` },
    { kind: 'value', label: 'Stale items', value: (r) => String(r.stale), emphasis: (r) => (r.stale ? 'warn' : 'normal') },
    { kind: 'value', label: 'Copies surviving erasure', value: (r) => (r.survivingCopies === null ? 'no erasure requested' : String(r.survivingCopies)), emphasis: (r) => (r.survivingCopies ? 'warn' : 'normal') },
  ],
  verdict: (r) => {
    if (r.sensitive) return { tone: 'no', headline: 'Sensitive data is in memory.', detail: 'Filter before writing, not at read time.' };
    if (r.stale) return { tone: 'no', headline: 'Stale items remain.', detail: 'Invalidate superseded facts and expire one-offs.' };
    if (r.survivingCopies) return { tone: 'no', headline: 'Deleted data is still retrievable.', detail: 'Vectors or summaries still hold it.' };
    return { tone: 'ok', headline: 'A clean memory.', detail: 'Only stable, permitted and current facts are kept.' };
  },
  narrate: (r, s) => [
    `At a threshold of ${s.threshold.toFixed(2)}, ${r.storedCount} of 10 candidates were saved, including ${r.sensitive} sensitive items and ${r.preferences} of the 3 preferences.`,
    r.sensitive && !s.blockSensitive ? 'The OTP, PAN and hospital visit score high on stability, so a threshold alone does not keep them out; a sensitive-data filter does.' : '',
    r.oldAddressValid ? 'The old address is still marked valid next to the new one.' : r.oldAddressInvalidated ? 'The old address is invalidated with a date and kept only as history.' : '',
    r.survivingCopies === null ? 'No erasure has been requested yet.' : r.survivingCopies ? `After the erasure ${r.survivingCopies} copies survive in vectors, the summary or the cache.` : 'The erasure reached every copy; only an audit line remains.',
  ].filter(Boolean).join(' '),
  missions: {
    sens: ({ result }) => result.sensitive === 0 && result.preferences === 3,
    erase: ({ state, result }) => state.erasureRequested && result.storedCount > 0 && result.survivingCopies === 0,
    stale: ({ result }) => result.stale === 0 && result.preferences === 3,
  },
});
