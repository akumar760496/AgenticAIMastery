import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent } from '@/shared/format';
import { OVERSAMPLING, SELECTIVITIES, TOTAL_CHUNKS, simulateMetadataFiltering, type MetadataFilteringResult, type MetadataFilteringState } from '../simulators/metadataFiltering';

const SELECTIVITY_LABEL: Readonly<Record<string, string>> = { '0.5': '50%: all motor documents', '0.05': '5%: motor · Maharashtra', '0.005': '0.5%: motor · MH · circulars since Apr 2025' };
const good = (r: MetadataFilteringResult) => r.returned === 10 && r.recall >= 0.95 && r.latencyMs <= 10;

export const metadataFilteringPlayground = definePlayground<MetadataFilteringState, MetadataFilteringResult>({
  techniqueId: 'metafilter',
  title: 'Filter Suraksha General’s index (fictional insurer)',
  controls: [
    { kind: 'select', key: 'strategy', label: 'Filter strategy', options: [{ value: 'post', label: 'Post-filter: ANN top-k, then drop non-matching' }, { value: 'pre', label: 'Pre-filter: match first, then exact scan' }, { value: 'filtered', label: 'Filtered ANN with payload index' }] },
    { kind: 'steps', key: 'selectivity', label: 'Filter selectivity', values: SELECTIVITIES, format: (v) => SELECTIVITY_LABEL[String(v)] ?? String(v) },
    { kind: 'steps', key: 'oversampling', label: 'Oversampling (candidates = 10 × this)', values: OVERSAMPLING, format: (v) => `${v}× · ${10 * v} candidates` },
    { kind: 'note', text: '20,00,000 chunks. Illustrative model: filter values are spread evenly. An exact scan costs about 0.1 ms per 1,000 vectors; an HNSW query about 3 ms plus 0.01 ms per candidate.' },
  ],
  presets: {
    start: { state: { strategy: 'post', selectivity: 0.5, oversampling: 1 }, expected: { returned: 5, recall: 0.47, latencyMs: 3.1 } },
    oversample: { state: { strategy: 'post', selectivity: 0.05, oversampling: 20 }, expected: { returned: 10, recall: 0.99, latencyMs: 5 } },
    brute: { state: { strategy: 'pre', selectivity: 0.5, oversampling: 1 }, expected: { returned: 10, recall: 1, latencyMs: 102 } },
    filtered: { state: { strategy: 'filtered', selectivity: 0.05, oversampling: 4 }, expected: { returned: 10, recall: 0.97, latencyMs: 5.4 } },
  },
  initialPreset: 'start',
  simulate: simulateMetadataFiltering,
  outputs: [
    { kind: 'value', label: 'Chunks matching the filter', value: (r) => `${formatCount(r.matching)} of ${formatCount(TOTAL_CHUNKS)}` },
    { kind: 'meter', label: 'Recall@10', value: (r) => r.recall, emphasis: (r) => (r.recall < 0.95 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Results returned', value: (r) => `${r.returned} of 10`, emphasis: (r) => (r.returned < 10 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Latency', value: (r) => `${r.latencyMs.toFixed(1)} ms`, detail: (r) => (r.plan === 'exact' || r.plan === 'planner-exact' ? `${formatCount(r.scored)} exact distances` : `HNSW with ${r.candidates} candidates`) },
  ],
  verdict: (r) => {
    if (good(r)) return { tone: 'ok', headline: 'Full, accurate and fast.', detail: 'Ten matching chunks, the right ones, within 10 ms.' };
    if (r.returned < 10) return { tone: 'no', headline: 'The filter emptied the list.', detail: 'Post-filtering a small top-k throws most candidates away. Oversample much more, or filter inside the search.' };
    if (r.latencyMs > 10) return { tone: 'mid', headline: 'Accurate but slow.', detail: 'An exact scan over a broad filter touches too many vectors. Use filtered ANN for broad filters.' };
    return { tone: r.recall < 0.8 ? 'no' : 'mid', headline: 'Close, but recall is short.', detail: 'Raise the candidate count a little.' };
  },
  narrate: (r, s) => {
    const head = `The filter matches ${formatCount(r.matching)} chunks.`;
    if (s.strategy === 'post') return `${head} Post-filtering takes the ${r.candidates} nearest chunks from the whole index, then drops those that do not match: on average ${+(r.candidates * s.selectivity).toFixed(2)} match, so ${r.returned} of 10 slots are filled and recall@10 is ${formatWholePercent(r.recall)}. A rarer filter needs far more oversampling.`;
    if (s.strategy === 'pre') return `${head} Pre-filtering scores every matching chunk exactly: ${formatCount(r.scored)} distances, ${r.latencyMs.toFixed(1)} ms, perfect recall. ${r.latencyMs > 10 ? 'Cheap for a rare filter, slow for a broad one.' : 'For a selective filter that is exact and fast.'}`;
    return r.plan === 'planner-exact'
      ? `${head} The payload index estimates only ${formatCount(r.matching)} matches, so the planner skips the graph and scores them exactly: 100% recall in ${r.latencyMs.toFixed(1)} ms.`
      : `${head} The filter is checked while the HNSW graph is walked, so every chunk in the top 10 matches. With ${r.candidates} candidates, recall@10 is ${formatWholePercent(r.recall)} in ${r.latencyMs.toFixed(1)} ms.`;
  },
  missions: {
    tiny: ({ state, result }) => state.selectivity === 0.005 && result.returned === 10 && result.recall >= 0.99 && result.latencyMs <= 10,
    collapse: ({ state, result }) => state.strategy === 'post' && state.oversampling >= 4 && result.returned < 3,
    broad: ({ state, result }) => state.selectivity === 0.5 && result.returned === 10 && result.recall >= 0.95 && result.latencyMs <= 10,
  },
});
