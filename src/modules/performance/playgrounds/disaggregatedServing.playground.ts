import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatWholePercent } from '@/shared/format';
import { CHATS, GPUS, KV_LINK, TPOT_TARGET_MS, TTFT_TARGET_S, simulateDisagg, type DisaggResult, type DisaggState, type KvLink } from '../simulators/disaggregatedServing';

const base: DisaggState = { split: false, uploadsPerMinute: 20, prefillGpus: 2, link: 'rdma' };
const transfer = (s: number) => (s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(2)} s`);

export const disaggregatedServingPlayground = definePlayground<DisaggState, DisaggResult>({
  techniqueId: 'disagg',
  title: '8 GPUs · 200 live chats · 30,000-token uploads',
  intro: 'Targets: p95 time to first token (TTFT) ≤ 2.5 s and p95 time per output token (TPOT) ≤ 50 ms. One upload takes 1.5 s of prefill on a dedicated GPU.',
  controls: [
    { kind: 'steps', key: 'uploadsPerMinute', label: 'Long prompts per minute', values: Array.from({ length: 16 }, (_, i) => i * 2), format: String },
    { kind: 'toggle', key: 'split', label: 'Separate prefill and decode pools' },
    { kind: 'steps', key: 'prefillGpus', label: 'GPUs in the prefill pool', values: [1, 2, 3, 4, 5, 6, 7], format: (v) => `${v} prefill · ${GPUS - v} decode` },
    { kind: 'select', key: 'link', label: 'KV cache link', options: (Object.keys(KV_LINK) as KvLink[]).map((k) => ({ value: k, label: KV_LINK[k].label })) },
  ],
  presets: {
    start: { state: base, expected: { ttftS: 2.2087, tpotMs: 60.6583, stolenShare: 0.0625, ttftOk: true, tpotOk: false } },
    split: { state: { ...base, split: true }, expected: { ttftS: 2.3286, tpotMs: 34.6667, transferS: 0.0786, ttftOk: true, tpotOk: true } },
    eth: { state: { ...base, split: true, link: 'eth' }, expected: { transferS: 1.258, ttftOk: false } },
    light: { state: { ...base, uploadsPerMinute: 4 }, expected: { ttftOk: true, tpotOk: true } },
  },
  initialPreset: 'start',
  simulate: simulateDisagg,
  outputs: [
    { kind: 'value', label: 'p95 TTFT', value: (r) => (Number.isFinite(r.ttftS) ? `${r.ttftS.toFixed(2)} s` : 'overloaded'), detail: (r) => (r.transferS ? `prefill pool ${formatWholePercent(Math.min(1, r.prefillBusy))} busy + ${transfer(r.transferS)} KV transfer` : 'prefill shares GPUs with decoding'), emphasis: (r) => (r.ttftOk ? 'normal' : 'warn') },
    { kind: 'value', label: 'p95 TPOT', value: (r) => `${Math.round(r.tpotMs)} ms`, emphasis: (r) => (r.tpotOk ? 'normal' : 'warn') },
    { kind: 'check', label: `TTFT ≤ ${TTFT_TARGET_S} s`, value: (r) => r.ttftOk },
    { kind: 'check', label: `TPOT ≤ ${TPOT_TARGET_MS} ms`, value: (r) => r.tpotOk },
  ],
  verdict: (r, s) => (r.ttftOk && r.tpotOk
    ? { tone: 'ok', headline: 'Both targets met.', detail: s.split ? 'Uploads no longer disturb live chats.' : 'At this load, shared GPUs are enough.' }
    : { tone: 'no', headline: 'Target missed.', detail: !r.tpotOk && !s.split ? 'Prefills interrupt decoding, so streams stutter.' : !r.ttftOk ? 'Uploads wait too long before their first token.' : 'Too few decode GPUs for 200 streams.' }),
  narrate: (r, s) => [
    s.split
      ? `Uploads go to ${s.prefillGpus} prefill GPUs, which ${r.prefillBusy >= 1 ? 'cannot keep up, so the queue grows without limit' : `are ${formatWholePercent(r.prefillBusy)} busy`}, and their KV caches reach ${GPUS - s.prefillGpus} decode GPUs in ${transfer(r.transferS)}. Each decode GPU serves ${Math.round(CHATS / (GPUS - s.prefillGpus))} chats and never runs a prefill, so p95 TPOT is ${Math.round(r.tpotMs)} ms.`
      : `${s.uploadsPerMinute} uploads a minute land on the same GPUs as the 200 chats; prefills steal ${formatWholePercent(r.stolenShare)} of GPU time, pushing p95 TPOT to ${Math.round(r.tpotMs)} ms.`,
    Number.isFinite(r.ttftS) ? `p95 TTFT is ${r.ttftS.toFixed(2)} s.` : '',
    r.ttftOk && r.tpotOk ? 'Both targets are met.' : 'At least one target is missed.',
  ].filter(Boolean).join(' '),
  missions: {
    both: ({ state, result }) => state.uploadsPerMinute >= 20 && result.ttftOk && result.tpotOk,
    starve: ({ state, result }) => state.split && !result.ttftOk && result.tpotOk,
    notneeded: ({ state, result }) => !state.split && result.ttftOk && result.tpotOk && state.uploadsPerMinute >= 8,
  },
});
