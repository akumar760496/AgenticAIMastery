import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatWholePercent, pluralise } from '@/shared/format';
import { LIST_OPTIONS, simulateIvf, type IvfResult, type IvfState } from '../simulators/ivfIndex';

export const ivfPlayground = definePlayground<IvfState, IvfResult>({
  techniqueId: 'ivf',
  title: 'Build and query an IVF index',
  controls: [
    { kind: 'steps', key: 'lists', label: 'lists (k-means clusters)', values: LIST_OPTIONS, format: String },
    { kind: 'toggle', key: 'earlyTraining', label: 'Build on the first 10% of rows only (loaded before the rest)' },
    { kind: 'steps', key: 'probes', label: 'probes (lists scanned per query)', values: Array.from({ length: 16 }, (_, i) => i + 1), format: String },
    { kind: 'note', text: '800 vectors, 40 test queries, exact search as ground truth. Probes above the number of lists are capped.' },
  ],
  presets: {
    start: { state: { lists: 16, probes: 1, earlyTraining: false }, expected: { recall: 0.825, scanned: 0.0633 } },
    tuned: { state: { lists: 32, probes: 3, earlyTraining: false }, expected: { recall: 0.995, scanned: 0.0916 } },
    tiny: { state: { lists: 16, probes: 2, earlyTraining: true }, expected: { recall: 0.9825, largestListShare: 0.46125 } },
    many: { state: { lists: 64, probes: 2, earlyTraining: false }, expected: { recall: 0.8625, scanned: 0.0321 } },
  },
  initialPreset: 'start',
  simulate: simulateIvf,
  outputs: [
    { kind: 'meter', label: 'Recall@10', value: (r) => r.recall, detail: () => '= true top-10 neighbours found ÷ 10, averaged over 40 queries', emphasis: (r) => (r.recall < 0.95 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Vectors scanned', value: (r) => r.scanned, detail: (r) => `= vectors in ${r.probes} probed ${pluralise(r.probes, 'list')} ÷ 800`, emphasis: () => 'warn' },
    { kind: 'value', label: 'Work saved vs exact search', value: (r) => `${(1 / Math.max(r.scanned, 1e-6)).toFixed(1)}× fewer distances` },
    { kind: 'value', label: 'Largest list', value: (r) => `${formatWholePercent(r.largestListShare)} of vectors` },
  ],
  verdict: (r) => {
    const good = r.recall >= 0.95 && r.scanned <= 0.25;
    if (good) return { tone: 'ok', headline: 'On target.', detail: 'At least 95% recall while scanning a quarter of the data or less.' };
    return r.recall >= 0.95
      ? { tone: 'mid', headline: 'Accurate but slow.', detail: 'Recall is fine, but you are scanning more than a quarter of the vectors.' }
      : { tone: 'no', headline: 'Recall below 95%.', detail: 'Raise probes, or use fewer, larger lists.' };
  },
  narrate: (r, s) => [
    `The index has ${s.lists} lists${s.earlyTraining ? ', trained on the first 80 rows only' : ''}. Each query compares itself with all ${s.lists} centroids, then scans the ${r.probes} closest: ${formatWholePercent(r.scanned)} of the vectors on average, finding ${formatWholePercent(r.recall)} of the true top 10.`,
    r.recall < 0.95 ? 'The misses are neighbours in lists the query never opened, usually just across a cluster border.' : '',
    s.earlyTraining ? `Because the first rows all came from one region, most centroids sit there and the largest list holds ${formatWholePercent(r.largestListShare)} of the data. Rebuild once representative data is loaded.` : s.lists >= 32 && r.probes <= 2 ? 'With many small lists, two probes cover little ground; more lists need more probes for the same recall.' : '',
  ].filter(Boolean).join(' '),
  missions: {
    target: ({ result }) => result.recall >= 0.97 - 1e-9 && result.scanned <= 0.1 + 1e-9,
    more: ({ result }) => result.probes === 2 && result.recall < 0.9,
    skew: ({ state, result }) => state.earlyTraining && result.largestListShare >= 0.4,
  },
});
