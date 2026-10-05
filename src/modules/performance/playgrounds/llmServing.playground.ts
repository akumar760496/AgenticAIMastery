import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount } from '@/shared/format';
import { GPU_OPTIONS, LOAD_OPTIONS, simulateLlmServing, type LlmServingResult, type LlmServingState, type ServingEngine } from '../simulators/llmServing';

const ENGINE_STORY: Readonly<Record<ServingEngine, string>> = {
  hf: 'One request at a time leaves most of the GPU idle',
  static: 'Static batches wait for their longest answer, so slots sit idle',
  vllm: 'Continuous batching refills each slot as soon as a sequence finishes',
};
const good = (r: LlmServingResult, s: LlmServingState) => !r.overloaded && s.requestsPerSecond === 8 && (r.p95S ?? Infinity) <= 10 && r.costPerMillionInr <= 60;

export const llmServingPlayground = definePlayground<LlmServingState, LlmServingResult>({
  techniqueId: 'serving',
  title: 'Serve Bharat Bol’s 8B model (fictional)',
  intro: 'Answers average 300 tokens. Each GPU costs ₹220 an hour (illustrative). Figures are for this workload only.',
  controls: [
    { kind: 'select', key: 'engine', label: 'Serving engine', options: [{ value: 'hf', label: 'Plain generate, one request at a time' }, { value: 'static', label: 'Static batches of 16' }, { value: 'vllm', label: 'Continuous batching + paged KV (vLLM-style)' }] },
    { kind: 'steps', key: 'gpus', label: 'GPUs', values: GPU_OPTIONS, format: String },
    { kind: 'steps', key: 'requestsPerSecond', label: 'Load', values: LOAD_OPTIONS, format: (v) => `${v} requests/s` },
  ],
  presets: {
    start: { state: { engine: 'hf', gpus: 1, requestsPerSecond: 2 }, expected: { capacity: 60, demand: 600, overloaded: true } },
    static: { state: { engine: 'static', gpus: 2, requestsPerSecond: 2 }, expected: { p95S: 12, costPerMillionInr: 203.7 } },
    vllm: { state: { engine: 'vllm', gpus: 1, requestsPerSecond: 8 }, expected: { utilisation: 0.8, p95S: 18, costPerMillionInr: 25.5 } },
    scaled: { state: { engine: 'vllm', gpus: 2, requestsPerSecond: 8 }, expected: { p95S: 8, costPerMillionInr: 50.9 } },
  },
  initialPreset: 'start',
  simulate: simulateLlmServing,
  outputs: [
    { kind: 'meter', label: 'GPU utilisation', value: (r) => r.utilisation, emphasis: (r) => (r.utilisation > 0.8 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Capacity', value: (r) => `${formatCount(r.capacity)} tok/s for ${formatCount(r.demand)} needed` },
    { kind: 'value', label: 'p95 latency', value: (r) => (r.p95S === null ? 'timeouts: queue keeps growing' : `${r.p95S} s`), emphasis: (r) => (r.p95S === null || r.p95S > 12 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Cost per 1M output tokens', value: (r) => `₹${formatCount(r.costPerMillionInr)}` },
  ],
  verdict: (r, s) => {
    if (good(r, s)) return { tone: 'ok', headline: 'Fast enough, cheap per token.', detail: 'Continuous batching keeps the GPUs busy without long queues.' };
    if (r.overloaded) return { tone: 'no', headline: 'Demand exceeds capacity.', detail: s.engine === 'vllm' ? 'Add GPUs.' : 'The engine wastes the GPU; try continuous batching.' };
    if (r.utilisation > 0.8) return { tone: 'mid', headline: 'Running too hot.', detail: 'p95 climbs fast above 80% busy; add a GPU.' };
    return { tone: 'mid', headline: 'Works, but check the cost.', detail: 'Idle capacity raises cost per token.' };
  },
  narrate: (r, s) => `${ENGINE_STORY[s.engine]}. At ${s.requestsPerSecond} requests a second on ${s.gpus} GPU${s.gpus > 1 ? 's' : ''}: ${r.p95S === null ? 'the queue grows and requests time out' : `p95 ${r.p95S} s`}, ₹${r.costPerMillionInr} per million tokens.`,
  missions: {
    best: ({ state, result }) => good(result, state),
    peak: ({ state, result }) => state.requestsPerSecond === 20 && !result.overloaded && (result.p95S ?? Infinity) <= 12,
    static: ({ state, result }) => state.engine === 'static' && state.requestsPerSecond === 2 && !result.overloaded,
  },
});
