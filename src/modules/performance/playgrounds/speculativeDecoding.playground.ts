import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { BATCH_SIZES, PLAIN_TOKENS_PER_SECOND, simulateSpeculative, type SpeculativeResult, type SpeculativeState } from '../simulators/speculativeDecoding';

const f2 = (v: number) => v.toFixed(2);

export const speculativeDecodingPlayground = definePlayground<SpeculativeState, SpeculativeResult>({
  techniqueId: 'specdec',
  title: 'Draft and verify settings',
  controls: [
    { kind: 'steps', key: 'acceptancePct', label: 'Acceptance rate α (per drafted token)', values: Array.from({ length: 14 }, (_, i) => 30 + i * 5), format: (v) => (v / 100).toFixed(2) },
    { kind: 'steps', key: 'lookahead', label: 'Lookahead k (tokens drafted per step)', values: Array.from({ length: 10 }, (_, i) => i + 1), format: String },
    { kind: 'steps', key: 'draftCost', label: 'Draft cost per token (× a target pass)', values: [0.02, 0.05, 0.1, 0.2], format: f2 },
    { kind: 'steps', key: 'batchSize', label: 'Batch size on the GPU', values: BATCH_SIZES, format: (v) => (v === 1 ? '1 (GPU mostly idle)' : v === 64 ? '64 (GPU busy)' : String(v)) },
    { kind: 'note', text: 'Plain decoding runs at 40 tokens per second: one token per target pass.' },
  ],
  presets: {
    start: { state: { acceptancePct: 60, lookahead: 4, draftCost: 0.05, batchSize: 1 }, expected: { tokensPerPass: 2.3056, stepCost: 1.2, speedUp: 1.9213 } },
    matched: { state: { acceptancePct: 80, lookahead: 5, draftCost: 0.05, batchSize: 1 }, expected: { stepCost: 1.25, speedUp: 2.9514 } },
    mismatch: { state: { acceptancePct: 30, lookahead: 8, draftCost: 0.1, batchSize: 1 }, expected: { stepCost: 1.8, speedUp: 0.7937 } },
    busy: { state: { acceptancePct: 70, lookahead: 4, draftCost: 0.05, batchSize: 64 }, expected: { stepCost: 1.8, bestLookahead: 3 } },
  },
  initialPreset: 'start',
  simulate: simulateSpeculative,
  outputs: [
    { kind: 'value', label: 'Tokens per target pass', value: (r) => f2(r.tokensPerPass) },
    { kind: 'value', label: 'Cost of one step vs a plain pass', value: (r) => f2(r.stepCost) },
    { kind: 'value', label: 'Speed-up', value: (r) => `${f2(r.speedUp)}×`, detail: (r) => `about ${Math.round(PLAIN_TOKENS_PER_SECOND * r.speedUp)} tokens per second`, emphasis: (r) => (r.speedUp < 1 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Drafted tokens thrown away per step', value: (r) => f2(r.wastedPerStep) },
    { kind: 'value', label: 'Best k for these settings', value: (r) => `${r.bestLookahead} (${f2(r.bestSpeedUp)}×)` },
  ],
  verdict: (r) => ({ tone: r.speedUp < 1 ? 'no' : r.speedUp < 1.5 ? 'mid' : 'ok', headline: r.speedUp < 1 ? 'Slower than plain decoding.' : r.speedUp < 1.5 ? 'A modest gain.' : 'A clear speed-up.', detail: 'Output is identical either way; only speed changes.' }),
  narrate: (r, s) => [
    `Each step the draft proposes ${s.lookahead} tokens and the target checks them in one pass. With α = ${(s.acceptancePct / 100).toFixed(2)}, a pass yields ${f2(r.tokensPerPass)} tokens instead of 1.`,
    `The step costs ${f2(r.stepCost)} target passes${s.batchSize > 1 ? `, because at batch size ${s.batchSize} verifying extra tokens is no longer free` : ''}, so the net speed-up is ${f2(r.speedUp)}×.`,
    r.speedUp < 1 ? 'The draft is rejected so often that its cost outweighs the saving.' : '',
    r.bestLookahead !== s.lookahead ? `k = ${r.bestLookahead} would do better here (${f2(r.bestSpeedUp)}×).` : `k = ${s.lookahead} is the best lookahead for these settings.`,
  ].filter(Boolean).join(' '),
  missions: {
    fast: ({ result }) => result.speedUp >= 2.5,
    slower: ({ result }) => result.speedUp < 1,
    busyk: ({ state, result }) => state.batchSize === 64 && state.lookahead === result.bestLookahead,
  },
});
