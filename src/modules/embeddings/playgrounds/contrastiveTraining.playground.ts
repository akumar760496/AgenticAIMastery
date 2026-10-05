import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatWholePercent } from '@/shared/format';
import { BATCH_SIZES, TEMPERATURES, simulateContrastive, type ContrastiveResult, type ContrastiveState } from '../simulators/contrastiveTraining';

const signed = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;

export const contrastivePlayground = definePlayground<ContrastiveState, ContrastiveResult>({
  techniqueId: 'contrastive',
  title: 'One training example',
  intro: 'anchor: “what is MTF” · positive: “Margin Trading Facility explained” · hard negative: “Mutual fund basics”',
  controls: [
    { kind: 'toggle', key: 'hardNegative', label: 'Include the hard negative in training' },
    { kind: 'steps', key: 'temperature', label: 'Temperature τ', values: TEMPERATURES, format: String },
    { kind: 'steps', key: 'batchSize', label: 'Batch size', values: BATCH_SIZES, format: String },
    { kind: 'steps', key: 'steps', label: 'Training steps', values: Array.from({ length: 41 }, (_, i) => i), format: String },
    { kind: 'note', text: 'Simplified model: easy in-batch negatives sit at similarity 0.10, and each step moves the similarities along the loss gradient.' },
  ],
  presets: {
    start: { state: { hardNegative: true, temperature: 0.05, batchSize: 32, steps: 0 }, expected: { loss: 1.953, ranksCorrectly: false } },
    warm: { state: { hardNegative: true, temperature: 1, batchSize: 32, steps: 0 }, expected: { loss: 3.022 } },
    big: { state: { hardNegative: true, temperature: 0.5, batchSize: 128, steps: 0 }, expected: { loss: 3.852 } },
  },
  initialPreset: 'start',
  simulate: simulateContrastive,
  outputs: [
    { kind: 'value', label: 'Similarity to positive', value: (r) => r.positiveSimilarity.toFixed(2) },
    { kind: 'value', label: 'Similarity to hard negative', value: (r) => r.hardNegativeSimilarity.toFixed(2) },
    { kind: 'meter', label: 'P(positive) in the softmax', value: (r) => r.pPositive, emphasis: (r) => (r.pPositive < 0.5 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Loss = −ln P', value: (r) => (r.loss < 0.001 ? r.loss.toExponential(1) : r.loss.toFixed(3)), detail: (r) => `hard negative takes ${formatWholePercent(r.pHard)}, easy negatives ${formatWholePercent(r.pEasy)}` },
  ],
  verdict: (r) => ({ tone: r.ranksCorrectly ? 'ok' : 'no', headline: r.ranksCorrectly ? 'Search ranks the right article first.' : 'Search still ranks “Mutual fund basics” first.', detail: `Margin ${signed(r.margin)}.` }),
  narrate: (r, s) => [
    `The query is ${r.positiveSimilarity.toFixed(2)} similar to the right article and ${r.hardNegativeSimilarity.toFixed(2)} to the look-alike, so search ranks ${r.ranksCorrectly ? 'the right article' : 'the wrong one'} first.`,
    s.hardNegative ? `The hard negative is in the loss and takes ${formatWholePercent(r.pHard)} of the probability${r.pHard > 0.3 ? ', a strong signal to push it away' : ''}.` : `Without the hard negative, the loss only sees ${s.batchSize - 1} easy negatives that are already far away: the loss is ${r.loss.toFixed(3)} and there is almost nothing to learn${r.ranksCorrectly ? '' : ', even though search is still wrong'}.`,
    r.pEasy > 0.5 ? `The ${s.batchSize - 1} easy in-batch negatives take ${formatWholePercent(r.pEasy)} of the probability, because a flat softmax barely separates them from the positive.` : '',
    s.temperature >= 0.5 ? `At τ = ${s.temperature}, the softmax is flat and the loss stays high even when the ranking is right.` : `At τ = ${s.temperature}, small differences in similarity become large differences in probability.`,
    s.steps ? `After ${s.steps} training steps, the margin is ${signed(r.margin)}.` : 'Add training steps to see the gradient move the vectors.',
  ].filter(Boolean).join(' '),
  missions: {
    rank: ({ result }) => result.ranksCorrectly,
    sharp: ({ state, result }) => state.hardNegative && result.ranksCorrectly && result.loss < 0.1,
    fooled: ({ state, result }) => !state.hardNegative && !result.ranksCorrectly && result.loss < 0.05,
  },
});
