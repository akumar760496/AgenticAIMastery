import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount } from '@/shared/format';
import { SCALE_LABELS, simulateStoreSelection, type StoreFamily, type StoreSelectionResult, type StoreSelectionState } from '../simulators/storeSelection';

const STORE_STORY: Readonly<Record<StoreFamily, string>> = {
  pg: 'pgvector keeps vectors next to the loan tables, with no new system to run',
  engine: 'A self-hosted engine is built for vector search and scales out, but your team runs it',
  managed: 'A managed serverless store needs almost no operations work',
  search: 'The existing OpenSearch cluster adds vectors to keyword search',
};

export const storeSelectionPlayground = definePlayground<StoreSelectionState, StoreSelectionResult>({
  techniqueId: 'choosevs',
  title: 'Pick Suvidha Finance’s vector store (fictional NBFC)',
  intro: 'Loan documents, policies and support notes, searched with branch and product filters. Illustrative costs and latencies for one team’s workload.',
  controls: [
    { kind: 'select', key: 'store', label: 'Store', options: [{ value: 'pg', label: 'Postgres + pgvector (already running)' }, { value: 'engine', label: 'Open-source engine, self-hosted (e.g. Qdrant)' }, { value: 'managed', label: 'Managed serverless, vendor’s account' }, { value: 'search', label: 'Existing OpenSearch cluster' }] },
    { kind: 'steps', key: 'scale', label: 'Vectors', values: [0, 1, 2], format: (v) => SCALE_LABELS[v] ?? String(v) },
    { kind: 'toggle', key: 'ownAccount', label: 'Vectors must stay in our own cloud account' },
  ],
  presets: {
    start: { state: { store: 'pg', scale: 1, ownAccount: true }, expected: { latencyMs: 60, costInr: 45000, opsHours: 10 } },
    small: { state: { store: 'pg', scale: 0, ownAccount: true }, expected: { latencyMs: 15, costInr: 8000, opsHours: 4 } },
    engine: { state: { store: 'engine', scale: 1, ownAccount: true }, expected: { latencyMs: 20, costInr: 40000, opsHours: 16 } },
    big: { state: { store: 'managed', scale: 2, ownAccount: false }, expected: { latencyMs: 60, costInr: 350000, opsHours: 3 } },
  },
  initialPreset: 'start',
  simulate: simulateStoreSelection,
  outputs: [
    { kind: 'value', label: 'p95 latency', value: (r) => `${r.latencyMs} ms`, emphasis: (r) => (r.latencyMs > 50 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Monthly cost', value: (r) => `₹${formatCount(r.costInr)}` },
    { kind: 'value', label: 'Operations', value: (r) => `${r.opsHours} h a month`, emphasis: (r) => (r.opsHours > 20 ? 'warn' : 'normal') },
    { kind: 'check', label: 'Residency rule met', value: (r) => r.residencyMet },
  ],
  verdict: (r) => {
    if (r.residencyMet && r.latencyMs <= 50 && r.opsHours <= 20) return { tone: 'ok', headline: 'Meets every constraint.', detail: 'Benchmark it against one other finalist on real queries.' };
    if (!r.residencyMet) return { tone: 'no', headline: 'Ruled out before any benchmark.', detail: 'The vectors would live in the vendor’s account.' };
    if (r.latencyMs > 50) return { tone: 'mid', headline: 'Too slow at this scale.', detail: 'Try a dedicated engine or a managed store.' };
    return { tone: 'mid', headline: 'Too much operations work.', detail: 'Consider a managed option if residency allows.' };
  },
  narrate: (r, s) => `${STORE_STORY[s.store]}. At ${SCALE_LABELS[s.scale]} vectors: p95 ${r.latencyMs} ms, ₹${formatCount(r.costInr)} a month, ${r.opsHours} operations hours${r.residencyMet ? '' : '; the residency rule is not met'}.`,
  missions: {
    best: ({ state, result }) => state.scale === 1 && state.ownAccount && result.residencyMet && result.latencyMs <= 50 && result.costInr <= 50000 && result.opsHours <= 20,
    small: ({ state, result }) => state.scale === 0 && state.ownAccount && result.residencyMet && result.costInr <= 10000 && result.opsHours <= 5,
    big: ({ state, result }) => state.scale === 2 && result.latencyMs <= 60 && result.opsHours <= 5,
  },
});
