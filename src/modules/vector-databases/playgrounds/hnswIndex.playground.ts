import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent } from '@/shared/format';
import { EF_CONSTRUCTION_OPTIONS, M_OPTIONS, simulateHnsw, type HnswResult, type HnswState } from '../simulators/hnswIndex';

const st = (m: number, efSearch: number, postFilter = false): HnswState => ({ m, efConstruction: 64, efSearch, postFilter });

export const hnswPlayground = definePlayground<HnswState, HnswResult>({
  techniqueId: 'hnsw',
  title: 'A real HNSW graph',
  controls: [
    { kind: 'steps', key: 'm', label: 'M (links per node) · rebuilds the graph', values: M_OPTIONS, format: String },
    { kind: 'steps', key: 'efConstruction', label: 'ef_construction · rebuilds the graph', values: EF_CONSTRUCTION_OPTIONS, format: String },
    { kind: 'steps', key: 'efSearch', label: 'ef_search (candidate list, no rebuild)', values: Array.from({ length: 40 }, (_, i) => (i + 1) * 10), format: String },
    { kind: 'toggle', key: 'postFilter', label: 'Filter to one tenant (10% of vectors), applied after the graph search' },
    { kind: 'note', text: '1,000 clustered 24-dimensional vectors, tested on 40 queries against exact search.' },
  ],
  presets: {
    start: { state: st(16, 10), expected: { recall: 0.94, comparedShare: 0.16315, layerCounts: [1000, 72, 4] } },
    tuned: { state: st(16, 40), expected: { recall: 0.9925, comparedShare: 0.34085 } },
    lowm: { state: st(4, 40), expected: { recall: 0.915, layerCounts: [1000, 255, 72, 18, 4, 2] } },
    filter: { state: st(16, 40, true), expected: { recall: 0.4375, returned: 4.375 } },
  },
  initialPreset: 'start',
  simulate: simulateHnsw,
  outputs: [
    { kind: 'meter', label: 'Recall@10', value: (r) => r.recall, emphasis: (r) => (r.recall < 0.95 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Distance computations', value: (r) => r.comparedShare, detail: () => '= vectors compared per query ÷ 1,000', emphasis: () => 'warn' },
    { kind: 'value', label: 'Results returned', value: (r) => `${r.returned.toFixed(1)} of 10`, emphasis: (r) => (r.returned < 10 - 1e-9 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Nodes per layer', value: (r) => r.layerCounts.map(formatCount).join(' · '), detail: (r) => `layer 0 · 1 · 2…; ${r.layerCounts.length} layers` },
    { kind: 'value', label: 'Link memory at 5M vectors', value: (r) => `${formatCount(r.linkMbAt5M)} MB`, detail: () => 'on top of 7,680 MB of vectors' },
    { kind: 'value', label: 'Build work vs M 16 / ef_c 64', value: (r) => `${r.buildWork.toFixed(2)}×` },
  ],
  verdict: (r) => (r.recall >= 0.95 && r.returned >= 10 - 1e-9
    ? { tone: 'ok', headline: 'Meets the target.', detail: '95% recall or better with a full page of results.' }
    : { tone: 'no', headline: 'Below target.', detail: r.returned < 10 - 1e-9 ? 'The filter throws away most candidates, so fewer than 10 results come back.' : 'Raise ef_search first; it needs no rebuild.' }),
  narrate: (r, s) => [
    `The graph has ${r.layerCounts.length} layers (${r.layerCounts.map(formatCount).join(', ')} nodes). Each query drops greedily through the upper layers, then explores layer 0 with ${s.efSearch} candidates, comparing ${formatWholePercent(r.comparedShare)} of the vectors and finding ${formatWholePercent(r.recall)} of the true top 10.`,
    s.postFilter ? `The tenant filter runs after the search, so only about 1 in 10 candidates survives and ${r.returned.toFixed(1)} results come back. Oversample, or use filter-aware search.` : '',
    s.m <= 4 ? 'With only 4 links per node the graph is poorly connected, so it needs a much larger ef_search for the same recall.' : '',
    'At this size a graph saves only a few-fold; with millions of vectors it compares well under 1%.',
  ].filter(Boolean).join(' '),
  missions: {
    efonly: ({ state: s, result }) => s.m === 16 && s.efConstruction === 64 && result.recall >= 0.99 - 1e-9 && !s.postFilter,
    lowm: ({ state: s, result }) => s.m === 4 && result.recall >= 0.95 - 1e-9 && !s.postFilter,
    filter: ({ state: s, result }) => s.postFilter && result.returned >= 10 - 1e-9 && result.recall >= 0.99 - 1e-9,
  },
});
