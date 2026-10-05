import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatPercent } from '@/shared/format';
import { simulateQuantisation, type QuantisationResult, type QuantisationState, type WeightFormat } from '../simulators/quantisation';

const FORMAT_STORY: Readonly<Record<WeightFormat, string>> = {
  bf16: 'Full 16-bit weights keep every bit of quality but need the most memory',
  fp8: 'FP8 halves weight memory with a very small quality change',
  int4: '4-bit weights fit in a quarter of the memory, with a larger quality drop',
};
const good = (r: QuantisationResult, s: QuantisationState) => s.model === '70b' && r.quality >= 0.85 && r.gpus <= 2 && r.costPerMillionInr <= 100;

export const quantisationPlayground = definePlayground<QuantisationState, QuantisationResult>({
  techniqueId: 'quant',
  title: 'Quantise Nyaya Sahayak’s model (fictional legal assistant)',
  intro: '80 GB GPUs at ₹300 an hour (illustrative). Quality is the score on its own Hindi and English legal Q&A set.',
  controls: [
    { kind: 'select', key: 'model', label: 'Model', options: [{ value: '70b', label: '70B' }, { value: '8b', label: '8B' }] },
    { kind: 'select', key: 'weights', label: 'Weights', options: [{ value: 'bf16', label: 'BF16 (16-bit)' }, { value: 'fp8', label: 'FP8 (8-bit)' }, { value: 'int4', label: 'INT4 weight-only (AWQ/GPTQ)' }] },
    { kind: 'toggle', key: 'fp8KvCache', label: 'FP8 KV cache' },
  ],
  presets: {
    start: { state: { model: '70b', weights: 'bf16', fp8KvCache: false }, expected: { gpus: 4, quality: 0.86, costPerMillionInr: 208.3 } },
    fp8: { state: { model: '70b', weights: 'fp8', fp8KvCache: false }, expected: { gpus: 2, quality: 0.857, costPerMillionInr: 119 } },
    int4: { state: { model: '70b', weights: 'int4', fp8KvCache: false }, expected: { gpus: 1, quality: 0.845, costPerMillionInr: 104.2 } },
    fp8kv: { state: { model: '70b', weights: 'fp8', fp8KvCache: true }, expected: { gpus: 2, quality: 0.855, costPerMillionInr: 95.2 } },
  },
  initialPreset: 'start',
  simulate: simulateQuantisation,
  outputs: [
    { kind: 'meter', label: 'Quality on own evals', value: (r) => r.quality, detail: (r) => `= ${formatPercent(r.quality, 1)}`, emphasis: (r) => (r.quality < 0.8 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Weights', value: (r) => `${r.weightsGb} GB` },
    { kind: 'value', label: '80 GB GPUs needed', value: (r) => String(r.gpus), emphasis: (r) => (r.gpus > 2 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Throughput', value: (r) => `${formatCount(Math.round(r.throughput))} tok/s` },
    { kind: 'value', label: 'Cost per 1M tokens', value: (r) => `₹${r.costPerMillionInr}` },
  ],
  verdict: (r, s) => {
    if (good(r, s)) return { tone: 'ok', headline: 'Half the GPUs, same answers.', detail: 'FP8 weights and KV cache cost half a point.' };
    if (r.gpus > 2) return { tone: 'no', headline: 'Four GPUs for one model.', detail: 'BF16 weights and cache do not fit on two GPUs.' };
    return { tone: 'mid', headline: 'A trade-off to check.', detail: s.weights === 'int4' ? 'One GPU is cheap, but check the quality loss on your tasks.' : 'Try FP8 and an FP8 KV cache.' };
  },
  narrate: (r, s) => `${FORMAT_STORY[s.weights]}. The ${s.model.toUpperCase()} model needs ${r.gpus} GPU${r.gpus > 1 ? 's' : ''}, scores ${formatPercent(r.quality, 1)} and costs ₹${r.costPerMillionInr} per million tokens.`,
  missions: {
    best: ({ state, result }) => good(result, state),
    onegpu: ({ state, result }) => state.model === '70b' && result.gpus === 1,
    loss: ({ state, result }) => state.model === '8b' && result.quality <= 0.72,
  },
});
