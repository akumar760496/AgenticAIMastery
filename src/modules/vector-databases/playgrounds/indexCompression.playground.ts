import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent } from '@/shared/format';
import { OVERSAMPLE_OPTIONS, simulateIndexCompression, type IndexCompressionResult, type IndexCompressionState } from '../simulators/indexCompression';

const good = (r: IndexCompressionResult) => r.recall >= 0.95 && r.ramGb <= 5 && r.latencyMs <= 20;

export const indexCompressionPlayground = definePlayground<IndexCompressionState, IndexCompressionResult>({
  techniqueId: 'compress',
  title: 'Shrink Bazaar Kart’s product index (fictional retailer)',
  intro: '2 crore vectors of 1,024 dims. RAM costs ₹600 per GB-month; original vectors on SSD cost about ₹820 a month.',
  controls: [
    { kind: 'select', key: 'encoding', label: 'Encoding in RAM', options: [{ value: 'fp32', label: 'float32 (4,096 B)' }, { value: 'int8', label: 'int8 scalar (1,024 B)' }, { value: 'pq', label: 'Product quantisation, 64 codes (64 B)' }, { value: 'binary', label: 'Binary, 1 bit per dim (128 B)' }] },
    { kind: 'toggle', key: 'rescore', label: 'Rescore candidates with float32 from SSD', isEnabled: (s) => s.encoding !== 'fp32' },
    { kind: 'steps', key: 'oversample', label: 'Oversampling', values: OVERSAMPLE_OPTIONS, format: (v) => `×${v}` },
  ],
  presets: {
    start: { state: { encoding: 'fp32', rescore: false, oversample: 1 }, expected: { recall: 0.98, ramGb: 81.9, latencyMs: 40, costInr: 49140 } },
    int8: { state: { encoding: 'int8', rescore: false, oversample: 1 }, expected: { recall: 0.96, ramGb: 20.5, latencyMs: 15, costInr: 13120 } },
    binary: { state: { encoding: 'binary', rescore: false, oversample: 1 }, expected: { recall: 0.74, ramGb: 2.6, latencyMs: 5, costInr: 2380 } },
    rescored: { state: { encoding: 'binary', rescore: true, oversample: 4 }, expected: { recall: 0.956, latencyMs: 13, costInr: 2380 } },
  },
  initialPreset: 'start',
  simulate: simulateIndexCompression,
  outputs: [
    { kind: 'meter', label: 'Recall at 10 vs exact', value: (r) => r.recall, emphasis: (r) => (r.recall < 0.9 ? 'warn' : 'normal') },
    { kind: 'value', label: 'RAM', value: (r) => `${r.ramGb} GB`, emphasis: (r) => (r.ramGb > 50 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Query latency', value: (r) => `${r.latencyMs} ms` },
    { kind: 'value', label: 'Monthly cost', value: (r) => `₹${formatCount(r.costInr)}` },
  ],
  verdict: (r) => {
    if (good(r)) return { tone: 'ok', headline: 'Small, fast and accurate.', detail: 'Compressed codes in RAM, full vectors only for the final order.' };
    if (r.ramGb > 50) return { tone: 'mid', headline: 'Accurate, but RAM is the bill.', detail: 'Quantise the vectors.' };
    if (r.recall < 0.85) return { tone: 'no', headline: 'Cheap, but results are missing.', detail: 'Turn on rescoring and oversample.' };
    return { tone: 'mid', headline: 'Close, but not there yet.', detail: 'Try a smaller encoding or more oversampling.' };
  },
  narrate: (r, s) => {
    const enc = { fp32: 'Float32 keeps every bit, so recall is high, but 82 GB of RAM drives the bill.', int8: 'int8 keeps 256 levels per dimension: a quarter of the RAM for a small recall loss.', pq: 'Product quantisation stores 64 codebook ids per vector, so the index is tiny but distances are approximate.', binary: 'Binary keeps only the sign of each dimension, so Hamming distance is fast but coarse.' }[s.encoding];
    const rescore = s.encoding === 'fp32' ? '' : r.rescoring ? `Rescoring ${10 * s.oversample} candidates with float32 from SSD recovers most of the lost order.` : 'Without rescoring, the compressed order is final.';
    return [enc, rescore, `Recall at 10 is ${formatWholePercent(r.recall)} with ${r.ramGb} GB of RAM.`].filter(Boolean).join(' ');
  },
  missions: {
    best: ({ result }) => good(result),
    int8: ({ state, result }) => state.encoding === 'int8' && result.recall >= 0.97,
    drop: ({ result }) => result.recall < 0.8,
  },
});
