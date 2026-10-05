import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent } from '@/shared/format';
import { LATENCY_BUDGET_MS, simulateLayeredSearch, type LayeredSearchResult, type LayeredSearchState } from '../simulators/layeredSearch';

const st = (candidates: number, int8Layer: boolean, crossEncoder: boolean): LayeredSearchState => ({ candidates, int8Layer, int8Keep: 100, crossEncoder, depth: 10 });
const LAYERS = ['L1 binary', 'L2 int8', 'L3 float32 from SSD', 'L4 cross-encoder'];

export const layeredSearchPlayground = definePlayground<LayeredSearchState, LayeredSearchResult>({
  techniqueId: 'las',
  title: 'A four-layer search pipeline',
  controls: [
    { kind: 'steps', key: 'candidates', label: 'Layer 1 · binary codes over 10 million chunks: candidates kept', values: Array.from({ length: 50 }, (_, i) => (i + 1) * 100), format: formatCount },
    { kind: 'toggle', key: 'int8Layer', label: 'Layer 2 · int8 rescore in RAM' },
    { kind: 'steps', key: 'int8Keep', label: 'Layer 2 keeps', values: [50, 100, 200, 400], format: String },
    { kind: 'toggle', key: 'crossEncoder', label: 'Layer 4 · cross-encoder re-rank' },
    { kind: 'steps', key: 'depth', label: 'Passages the cross-encoder reads', values: [10, 20, 50], format: String },
    { kind: 'note', text: 'Layer 3, exact float32 rescoring from SSD, is always on. Per-item costs are illustrative: 0.004 ms per binary candidate, 0.003 ms per int8 rescore, 0.05 ms per SSD fetch, 1.2 ms per cross-encoder pair.' },
  ],
  presets: {
    start: { state: st(200, false, false), expected: { latencyMs: 13.8, recall: 0.8913 } },
    balanced: { state: st(2000, true, true), expected: { latencyMs: 34, recall: 0.9707 } },
    noint8: { state: st(1000, false, false), expected: { latencyMs: 57, recall: 0.97 } },
    starved: { state: st(100, true, true), expected: { recall: 0.8107 } },
  },
  initialPreset: 'start',
  simulate: simulateLayeredSearch,
  outputs: [
    { kind: 'meter', label: 'Vector recall@10', value: (r) => r.recall, detail: (r) => `= ${r.layer1Recall.toFixed(3)} kept by layer 1 × ${r.layer2Recall.toFixed(3)} kept by layer 2`, emphasis: (r) => (r.recall < 0.97 - 1e-9 ? 'warn' : 'normal') },
    { kind: 'table', columns: ['Layer', 'Latency'], rows: (r) => r.layerMs.flatMap((ms, i) => (ms ? [[LAYERS[i] ?? '', `${ms.toFixed(1)} ms`]] : [])) },
    { kind: 'value', label: 'Total latency', value: (r) => `${r.latencyMs.toFixed(1)} ms of ${LATENCY_BUDGET_MS}`, emphasis: (r) => (r.withinBudget ? 'normal' : 'warn') },
    { kind: 'meter', label: 'Ranking quality, nDCG@10 (modelled)', value: (r) => r.ndcg },
  ],
  verdict: (r) => (r.recall >= 0.97 - 1e-9 && r.withinBudget
    ? { tone: 'ok', headline: 'Fast and accurate.', detail: 'At least 97% recall within 50 ms.' }
    : !r.withinBudget
      ? { tone: 'no', headline: 'Over budget.', detail: 'Find the slowest layer and shrink what it sees.' }
      : { tone: 'no', headline: 'Recall below 97%.', detail: 'Keep more candidates in layer 1; later layers cannot recover its misses.' }),
  narrate: (r, s) => [
    `Layer 1 scans binary codes and keeps ${formatCount(s.candidates)} candidates, which contain ${formatWholePercent(r.layer1Recall)} of the true top 10.`,
    s.int8Layer ? `The int8 layer narrows them to ${r.fetchedFromSsd} in RAM, so only ${r.fetchedFromSsd} full vectors are fetched from SSD.` : `With no int8 layer, all ${formatCount(s.candidates)} candidates are fetched from SSD, costing ${r.layerMs[2].toFixed(0)} ms.`,
    s.crossEncoder ? `A cross-encoder then re-reads ${s.depth} passages, adding ${r.layerMs[3].toFixed(0)} ms.` : '',
    `End-to-end vector recall is ${formatWholePercent(r.recall)} in ${r.latencyMs.toFixed(1)} ms.`,
    r.layer1Recall < 0.9 ? 'Layer 1 is starving the pipeline: no later layer can bring back what it dropped.' : '',
  ].filter(Boolean).join(' '),
  missions: {
    budget: ({ state, result }) => state.crossEncoder && result.recall >= 0.97 - 1e-9 && result.latencyMs <= LATENCY_BUDGET_MS,
    perm: ({ state, result }) => state.int8Layer && state.crossEncoder && result.recall < 0.85,
    noint8: ({ state, result }) => !state.int8Layer && result.recall >= 0.97 - 1e-9 && result.latencyMs > LATENCY_BUDGET_MS,
  },
});
