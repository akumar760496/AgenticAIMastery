import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatRupees } from '@/shared/format';
import { OPTION_LABELS, simulateAdaptationChoice, type AdaptationChoiceResult, type AdaptationChoiceState } from '../simulators/adaptationChoice';

const base: AdaptationChoiceState = { task: 'facts', change: 'monthly', examples: 5000, volume: 1000000, baseline: 75 };
const RECOMMENDATION_TEXT = { P: 'Nothing else beats the prompt by more than 2 points; keep it simple.', R: 'The gap is knowledge, and retrieval keeps it current and citable.', F: 'The gap is behaviour, you have the examples, and volume pays for tuning.', RF: 'Tune for behaviour and retrieve the facts.' } as const;
const RECOMMENDATION_NAME = { P: 'the prompt alone', R: 'RAG', F: 'fine-tuning', RF: 'RAG plus a fine-tuned model' } as const;
const accuracyOf = (r: AdaptationChoiceResult, key: string) => r.options.find((o) => o.key === key)?.accuracy ?? null;

export const adaptationChoicePlayground = definePlayground<AdaptationChoiceState, AdaptationChoiceResult>({
  techniqueId: 'decide',
  title: 'Choose how to close the gap',
  intro: 'An assistant falls short of the accuracy bar on a real eval set. Figures are illustrative; tuning carries about ₹60,000 a month in fixed costs.',
  controls: [
    { kind: 'select', key: 'task', label: 'What is missing', options: [{ value: 'facts', label: 'Facts: products, fees, policies' }, { value: 'style', label: 'Style: format and tone' }, { value: 'skill', label: 'A narrow skill: e.g. coding notes' }, { value: 'both', label: 'Both: current facts in a house format' }] },
    { kind: 'select', key: 'change', label: 'Facts change', options: [{ value: 'daily', label: 'Daily' }, { value: 'monthly', label: 'Monthly' }, { value: 'rarely', label: 'Rarely' }] },
    { kind: 'select', key: 'examples', label: 'Good examples', options: [{ value: '0', label: 'None' }, { value: '200', label: '200' }, { value: '5000', label: '5,000' }] },
    { kind: 'select', key: 'volume', label: 'Queries a month', options: [{ value: '10000', label: '10,000' }, { value: '100000', label: '1,00,000' }, { value: '1000000', label: '10,00,000' }] },
    { kind: 'select', key: 'baseline', label: 'Prompted baseline', options: [{ value: '60', label: '60%' }, { value: '75', label: '75%' }, { value: '90', label: '90%' }] },
  ],
  presets: {
    start: { state: { task: 'style', change: 'rarely', examples: 0, volume: 1000000, baseline: 60 }, expected: { recommended: 'P', blocked: false } },
    fees: { state: base, expected: { recommended: 'R' } },
    style: { state: { ...base, task: 'style', change: 'rarely' }, expected: { recommended: 'F' } },
    both: { state: { ...base, task: 'both' }, expected: { recommended: 'RF' } },
  },
  initialPreset: 'start',
  simulate: simulateAdaptationChoice,
  outputs: [
    {
      kind: 'table', columns: ['Option', 'Accuracy', 'Monthly cost'],
      rows: (r) => r.options.map((o) => [
        `${o.key === r.recommended ? '★ ' : ''}${o.label}`,
        o.accuracy === null ? 'needs examples' : `${o.accuracy}%`,
        o.accuracy === null ? '—' : o.viable ? formatRupees(o.monthlyCost) : 'volume too low',
      ]),
    },
    { kind: 'value', label: 'Recommended', value: (r) => OPTION_LABELS[r.recommended] },
  ],
  verdict: (r) => ({
    tone: r.blocked ? 'mid' : 'ok',
    headline: `Recommended: ${OPTION_LABELS[r.recommended]}.`,
    detail: `${RECOMMENDATION_TEXT[r.recommended]}${r.blocked ? ' Tuning would score higher, but not at this volume.' : ''}${r.stale && r.recommended === 'F' ? ' Tuned facts will go stale.' : ''}`,
  }),
  narrate: (r, s) => {
    const rag = accuracyOf(r, 'R'); const ft = accuracyOf(r, 'F'); const both = accuracyOf(r, 'RF');
    const recCost = r.options.find((o) => o.key === r.recommended)?.monthlyCost ?? 0;
    return [
      `With a ${s.baseline}% prompted baseline,`,
      s.task === 'facts' || s.task === 'both' ? `retrieval adds the missing facts and reaches ${rag}%.` : `retrieval adds little for ${s.task === 'style' ? 'a style gap' : 'a skill gap'} (${rag}%).`,
      ft !== null ? `Fine-tuning on ${formatCount(s.examples)} examples reaches ${ft}%${s.task === 'facts' && s.change !== 'rarely' ? ', and the tuned facts go stale as they change' : ''}${s.task === 'both' ? `, and both together reach ${both}%` : ''}.` : 'Without examples there is nothing to fine-tune on.',
      s.volume < 100000 ? 'At this volume the fixed cost of tuning is never recovered.' : `The recommendation is ${RECOMMENDATION_NAME[r.recommended]} at ${formatRupees(recCost)} a month.`,
    ].join(' ');
  },
  missions: {
    rag: ({ state, result }) => result.recommended === 'R' && state.task === 'facts',
    ft: ({ result }) => result.recommended === 'F',
    volume: ({ result }) => result.blocked,
  },
});
