import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatPercent } from '@/shared/format';
import { DIMENSIONS, PRECISION_BITS, RAM_GB, simulateVectorCompression, type VectorCompressionResult, type VectorCompressionState } from '../simulators/vectorCompression';

const st = (precision: VectorCompressionState['precision'], rescore = false, oversampling = 4): VectorCompressionState => ({ dimensions: 1536, precision, rescore, oversampling, millions: 50 });

export const vectorCompressionPlayground = definePlayground<VectorCompressionState, VectorCompressionResult>({
  techniqueId: 'dimred',
  title: 'Index settings',
  controls: [
    { kind: 'steps', key: 'dimensions', label: 'Dimensions kept', values: [...DIMENSIONS].reverse(), format: formatCount },
    { kind: 'select', key: 'precision', label: 'Precision', options: Object.keys(PRECISION_BITS).map((p) => ({ value: p, label: p })) },
    { kind: 'toggle', key: 'rescore', label: 'Rescore candidates with full float32 vectors kept on disk' },
    { kind: 'steps', key: 'oversampling', label: 'Oversampling for rescoring', values: Array.from({ length: 10 }, (_, i) => i + 1), format: (v) => `${v}×` },
    { kind: 'steps', key: 'millions', label: 'Vectors in the index', values: Array.from({ length: 100 }, (_, i) => i + 1), format: (v) => `${v} million` },
    { kind: 'note', text: 'Model trained Matryoshka-style, 1,536 dimensions. Recall@10 is relative to the full-size baseline, from illustrative measurements. Memory counts raw vectors only.' },
  ],
  presets: {
    start: { state: st('float32'), expected: { bytesPerVector: 6144, indexGb: 307.2, recall: 1, fits: false } },
    int8: { state: st('int8'), expected: { bytesPerVector: 1536, indexGb: 76.8, recall: 0.99 } },
    binary: { state: st('binary'), expected: { bytesPerVector: 192, indexGb: 9.6, recall: 0.82 } },
    rescored: { state: st('binary', true, 2), expected: { indexGb: 9.6, recall: 0.91 } },
  },
  initialPreset: 'start',
  simulate: simulateVectorCompression,
  outputs: [
    { kind: 'value', label: 'Bytes per vector', value: (r) => `${formatCount(r.bytesPerVector)} B`, detail: (r) => `${r.compressionRatio.toFixed(r.compressionRatio < 10 ? 1 : 0)}× smaller than float32 at 1,536` },
    { kind: 'meter', label: `Index memory (of ${RAM_GB} GB)`, value: (r) => Math.min(1, r.indexGb / RAM_GB), detail: (r) => `= ${r.indexGb.toFixed(1)} GB`, emphasis: (r) => (r.fits ? 'normal' : 'warn') },
    { kind: 'meter', label: 'Recall@10 vs baseline', value: (r) => r.recall, detail: (r) => `= ${formatPercent(r.recall, 1)}${r.candidates ? '' : ''}`, emphasis: (r) => (r.recall < 0.95 ? 'warn' : 'normal') },
    { kind: 'check', label: `Fits in ${RAM_GB} GB`, value: (r) => r.fits },
    { kind: 'check', label: 'Recall ≥ 95%', value: (r) => r.recall >= 0.95 },
  ],
  verdict: (r, s) => ({
    tone: r.fits && r.recall >= 0.95 ? 'ok' : r.fits || r.recall >= 0.95 ? 'mid' : 'no',
    headline: r.fits && r.recall >= 0.95 ? 'Fits the budget and keeps recall.' : !r.fits ? 'Too big for the memory budget.' : 'Fits, but recall is too low.',
    detail: s.rescore ? `Rescoring reads ${r.candidates} full vectors from disk per query.` : 'Compact vectors are searched directly.',
  }),
  narrate: (r, s) => [
    `Each vector keeps ${formatCount(s.dimensions)} dimensions at ${PRECISION_BITS[s.precision]} bit${PRECISION_BITS[s.precision] > 1 ? 's' : ''}, so it takes ${formatCount(r.bytesPerVector)} bytes. ${s.millions} million need ${r.indexGb.toFixed(1)} GB, which ${r.fits ? 'fits' : 'does not fit'} in ${RAM_GB} GB of RAM.`,
    s.precision === 'binary' && !s.rescore ? `Binary vectors keep only the sign of each value, so recall drops to ${formatPercent(r.recall, 1)}. Oversampling and rescoring bring most of it back.` : '',
    s.rescore ? `Rescoring fetches ${r.candidates} candidates and re-sorts them with full-precision vectors from disk, lifting recall to ${formatPercent(r.recall, 1)}.` : '',
    s.dimensions < 1536 && s.precision !== 'binary' ? `Truncating to ${s.dimensions} dimensions works because the model was trained Matryoshka-style.` : '',
  ].filter(Boolean).join(' '),
  missions: {
    fit: ({ state, result }) => state.millions >= 50 && result.fits && result.recall >= 0.95,
    precise: ({ result }) => result.bytesPerVector < 1000 && result.recall >= 0.98,
    trap: ({ state, result }) => result.indexGb < 5 && state.millions >= 50 && result.recall < 0.7,
  },
});
