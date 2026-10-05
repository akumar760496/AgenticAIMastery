import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent } from '@/shared/format';
import { PQ_SIZES, simulateDiskAnn, type DiskAnnResult, type DiskAnnState } from '../simulators/diskAnn';

const bytes = (b: number) => (b >= 1e12 ? `${(b / 1e12).toFixed(2)} TB` : b >= 1e9 ? `${(b / 1e9).toFixed(b >= 1e11 ? 0 : 1)} GB` : `${(b / 1e6).toFixed(0)} MB`);
const base: DiskAnnState = { millions: 1000, dims: 768, pqBytes: 32, listSize: 50, beamWidth: 4, disk: 'nvme' };

export const diskAnnPlayground = definePlayground<DiskAnnState, DiskAnnResult>({
  techniqueId: 'diskann',
  title: 'A billion-scale index on one server',
  controls: [
    { kind: 'steps', key: 'millions', label: 'Vectors', values: Array.from({ length: 20 }, (_, i) => (i + 1) * 100), format: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)} billion` : `${v} million`) },
    { kind: 'steps', key: 'dims', label: 'Dimensions', values: [384, 768, 1536], format: String },
    { kind: 'steps', key: 'pqBytes', label: 'PQ code size', values: PQ_SIZES, format: (v) => `${v} B` },
    { kind: 'steps', key: 'listSize', label: 'Candidate list L (complexity)', values: Array.from({ length: 19 }, (_, i) => 20 + i * 10), format: String },
    { kind: 'steps', key: 'beamWidth', label: 'Beam width', values: [1, 2, 4, 8], format: String },
    { kind: 'select', key: 'disk', label: 'Disk', options: [{ value: 'nvme', label: 'local NVMe (~0.1 ms read)' }, { value: 'net', label: 'network block storage (~1 ms read)' }] },
    { kind: 'note', text: '256 GB of RAM. Graph degree R = 64. Sizes are computed; recall and latency come from a simple model of how DiskANN behaves.' },
  ],
  presets: {
    start: { state: base, expected: { ramBytes: 48e9, latencyMs: 1.7, fits: true } },
    tuned: { state: { ...base, listSize: 100 }, expected: { roundTrips: 25, latencyMs: 2.9 } },
    two: { state: { ...base, millions: 2000, pqBytes: 128, listSize: 100 }, expected: { ramBytes: 272e9, fits: false } },
    net: { state: { ...base, pqBytes: 64, listSize: 80, disk: 'net' }, expected: { latencyMs: 20.4 } },
  },
  initialPreset: 'start',
  simulate: simulateDiskAnn,
  outputs: [
    { kind: 'value', label: 'Full vectors', value: (r) => bytes(r.fullBytes) },
    { kind: 'value', label: 'In-memory HNSW needs', value: (r) => `${bytes(r.hnswRamBytes)} ${r.hnswFits ? '✓' : '✗'}`, emphasis: (r) => (r.hnswFits ? 'normal' : 'warn') },
    { kind: 'value', label: 'DiskANN RAM', value: (r) => `${bytes(r.ramBytes)} ${r.fits ? '✓' : '✗'}`, detail: () => 'PQ codes + 16 GB cache and working memory', emphasis: (r) => (r.fits ? 'normal' : 'warn') },
    { kind: 'value', label: 'SSD footprint', value: (r) => bytes(r.ssdBytes) },
    { kind: 'value', label: 'SSD round trips / reads per query', value: (r) => `${r.roundTrips} / ${r.reads}` },
    { kind: 'meter', label: 'Recall@10 (modelled)', value: (r) => r.recall, emphasis: (r) => (r.recall < 0.95 ? 'warn' : 'normal') },
    { kind: 'value', label: 'p50 latency (modelled)', value: (r) => `${r.latencyMs.toFixed(1)} ms` },
  ],
  verdict: (r) => {
    if (r.fits && r.recall >= 0.95 && r.latencyMs <= 5) return { tone: 'ok', headline: 'Deployable.', detail: 'Fits in 256 GB of RAM with at least 95% recall under 5 ms.' };
    if (!r.fits) return { tone: 'no', headline: 'Does not fit.', detail: 'The PQ codes alone exceed the RAM budget: use smaller codes or shard.' };
    if (r.recall < 0.95) return { tone: 'no', headline: 'Recall too low.', detail: 'Raise L or use larger codes.' };
    return { tone: 'no', headline: 'Too slow.', detail: 'Use local NVMe and a wider beam, or lower L.' };
  },
  narrate: (r, s) => [
    `${formatCount(s.millions)} million vectors of ${s.dims} dimensions take ${bytes(r.fullBytes)}, so an in-memory index would need ${bytes(r.hnswRamBytes)}${r.hnswFits ? '' : ', far over the 256 GB budget'}.`,
    `DiskANN keeps only ${s.pqBytes}-byte codes in RAM (${bytes(r.ramBytes)} with cache) and ${bytes(r.ssdBytes)} on SSD.`,
    `Each query walks the graph in ${r.roundTrips} round trips of up to ${s.beamWidth} reads, about ${r.latencyMs.toFixed(1)} ms on ${s.disk === 'nvme' ? 'local NVMe' : 'network storage'}, with about ${formatWholePercent(r.recall)} recall.`,
    s.beamWidth === 1 ? 'A beam width of 1 minimises total reads but makes every read a separate round trip.' : '',
  ].filter(Boolean).join(' '),
  missions: {
    two: ({ state, result }) => state.millions === 2000 && result.fits && result.recall >= 0.95,
    fast: ({ state, result }) => state.disk === 'nvme' && result.recall >= 0.95 && result.latencyMs <= 5,
    beam: ({ state, result }) => state.disk === 'nvme' && state.beamWidth === 1 && result.recall >= 0.95 && result.latencyMs > 5,
  },
});
