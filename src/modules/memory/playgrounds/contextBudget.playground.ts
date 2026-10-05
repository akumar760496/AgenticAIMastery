import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatWholePercent } from '@/shared/format';
import { CONTEXT_SIZES_K, CONTEXT_START, simulateContextBudget, type ContextBudgetResult, type ContextBudgetState } from '../simulators/contextBudget';

export const contextBudgetPlayground = definePlayground<ContextBudgetState, ContextBudgetResult>({
  techniqueId: 'ctxbudget',
  title: 'Contract question: “Can the buyer terminate for delay?”',
  intro: '40 clauses of 3k tokens, ranked by relevance. The answer needs the clauses ranked 1, 2 and 4. Accuracy uses a fixed, illustrative decay curve.',
  controls: [
    { kind: 'steps', key: 'sizeIndex', label: 'Context size', values: CONTEXT_SIZES_K.map((_, i) => i), format: (i) => `${CONTEXT_SIZES_K[i]}k tokens` },
    { kind: 'steps', key: 'distractors', label: 'Near-duplicate distractors', values: [0, 1, 2, 3, 4, 5, 6, 7, 8], format: String },
    { kind: 'select', key: 'position', label: 'Key fact position', options: [{ value: 'start', label: 'start' }, { value: 'middle', label: 'middle' }, { value: 'end', label: 'end' }] },
    { kind: 'toggle', key: 'questionLast', label: 'Documents first, question last' },
  ],
  presets: {
    start: { state: CONTEXT_START, expected: { facts: 3, tokensK: 128, costUsd: 0.384 } },
    huge: { state: { sizeIndex: 6, distractors: 6, position: 'middle', questionLast: false }, expected: { tokensK: 140 } },
    curated: { state: { sizeIndex: 2, distractors: 0, position: 'middle', questionLast: false }, expected: { tokensK: 14, relevant: 4 } },
    mid32: { state: { sizeIndex: 3, distractors: 0, position: 'middle', questionLast: true }, expected: { tokensK: 32 } },
  },
  initialPreset: 'start',
  simulate: simulateContextBudget,
  outputs: [
    { kind: 'meter', label: 'Answer accuracy', value: (r) => r.accuracy, emphasis: (r) => (r.accuracy < 0.85 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Required facts included', value: (r) => `${r.facts} of 3`, emphasis: (r) => (r.facts < 3 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Tokens sent', value: (r) => `${r.tokensK}k`, detail: (r) => `${r.relevant} relevant chunks + ${r.distractors} distractors · ${formatWholePercent(1 - r.tokensK / r.startTokensK)} fewer than the start` },
    { kind: 'value', label: 'Cost per call', value: (r) => `$${r.costUsd.toFixed(3)}` },
    { kind: 'value', label: 'Gain from moving the key fact to an edge', value: (r) => `${Math.round(r.edgeGain * 100)} points` },
  ],
  verdict: (r) => {
    if (r.facts < 3) return { tone: 'no', headline: 'A required fact is missing.', detail: 'The budget is too small or distractors took the space.' };
    return r.accuracy >= 0.85 ? { tone: 'ok', headline: 'Curated and accurate.', detail: 'Small, clean and well ordered.' } : { tone: 'mid', headline: 'Every fact is there, but accuracy is low.', detail: 'Too much input, distractors or a buried key fact.' };
  },
  narrate: (r, s) => [
    `The prompt holds ${r.tokensK}k tokens: ${r.relevant} relevant chunks and ${r.distractors} distractors, with ${r.facts} of the 3 required facts.`,
    r.facts < 3 ? 'Without every required fact the model cannot answer fully.' : `At this length the decay curve keeps ${Math.round(r.decay * 100)}% of peak accuracy${r.distractors ? ', and each distractor costs more as the prompt grows' : ''}.`,
    s.position === 'middle' && r.middlePenalty > 0.001 ? `The key fact sits in the middle, which costs ${Math.round(r.middlePenalty * 100)} points here.` : 'The key fact sits at an edge of the prompt, where models use information best.',
    s.questionLast ? 'The question comes last, after the documents.' : 'The question comes before the documents, which costs a little more at length.',
  ].join(' '),
  missions: {
    acc85: ({ result }) => result.accuracy >= 0.85 && result.facts === 3,
    cut70: ({ result }) => result.tokensK <= 0.3 * result.startTokensK && result.accuracy >= result.startAccuracy - 1e-9,
    edge: ({ result }) => result.edgeGain >= 0.1 - 1e-9,
  },
});
