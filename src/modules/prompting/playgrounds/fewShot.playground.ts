import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatPercent, pluralise } from '@/shared/format';
import { simulateFewShot, type FewShotResult, type FewShotState } from '../simulators/fewShot';

const base: FewShotState = { k: 4, skew: false, order: 'random', selection: 'fixed', diverse: true };

export const fewShotPlayground = definePlayground<FewShotState, FewShotResult>({
  techniqueId: 'fewshot',
  title: 'Classify complaints with examples',
  intro: 'Four labels: refund (30% of complaints), delivery (30%), damage (20%), billing (20%). Each example adds about 180 tokens.',
  controls: [
    { kind: 'steps', key: 'k', label: 'Examples in the prompt', values: [0, 1, 2, 3, 4, 5, 6, 7, 8], format: (v) => String(v) },
    { kind: 'select', key: 'selection', label: 'Examples', options: [{ value: 'fixed', label: 'The same fixed set for every complaint' }, { value: 'retrieved', label: 'Retrieved: most similar per label' }] },
    { kind: 'select', key: 'order', label: 'Order', options: [{ value: 'random', label: 'Shuffled' }, { value: 'last', label: 'A refund example always last' }] },
    { kind: 'toggle', key: 'skew', label: 'Skewed: most examples are refunds' },
    { kind: 'toggle', key: 'diverse', label: 'Diverse: includes edge cases' },
  ],
  presets: {
    start: { state: { k: 0, skew: false, order: 'random', selection: 'fixed', diverse: false }, expected: { accuracy: 0.78, refundShare: 0.3, tokens: 400 } },
    skewed: { state: { k: 5, skew: true, order: 'last', selection: 'fixed', diverse: false }, expected: { accuracy: 0.7764664716763388, refundShare: 0.6, tokens: 1300 } },
    fixed: { state: base, expected: { accuracy: 0.8798103482005345, tokens: 1120 } },
    retrieved: { state: { ...base, selection: 'retrieved' }, expected: { accuracy: 0.9117344874807483, tokens: 1120 } },
  },
  initialPreset: 'start',
  simulate: simulateFewShot,
  outputs: [
    { kind: 'meter', label: 'Accuracy', value: (r) => r.accuracy, detail: () => '= on 1,000 held-out complaints', emphasis: (r) => (r.accuracy < 0.9 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Predicted as refund', value: (r) => r.refundShare, detail: () => '= true share is 30%', emphasis: (r) => (r.refundShare > 0.4 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Prompt tokens', value: (r) => formatCount(r.tokens) },
  ],
  verdict: (r, s) => (r.refundShare > 0.4
    ? { tone: 'no', headline: 'The model is copying the examples.', detail: 'Refund is predicted far more often than it occurs.' }
    : r.accuracy >= 0.9 ? { tone: 'ok', headline: 'Examples are pulling their weight.', detail: 'Balanced, relevant examples fix the subtle cases.' }
      : s.k === 0 ? { tone: 'mid', headline: 'Instructions only.', detail: 'Zero-shot gets most complaints right; add examples where it fails.' }
        : { tone: 'mid', headline: 'Some help, not enough.', detail: 'Try retrieving examples per complaint, and include edge cases.' }),
  narrate: (r, s) => {
    const copying = s.skew && s.order === 'last' ? 'both the majority and the last label' : s.skew ? 'the majority label' : 'the last label';
    return [
      s.k === 0 ? 'With instructions alone, 78% of complaints are labelled correctly.' : `With ${s.k} ${s.selection} ${pluralise(s.k, 'example')}, accuracy is ${formatPercent(r.accuracy, 1)}.`,
      s.k && (s.skew || s.order === 'last') ? `The model now calls ${formatPercent(r.refundShare, 1)} of complaints refunds, against a true 30%: it is copying ${copying}.` : '',
      `The prompt is ${formatCount(r.tokens)} tokens.`,
    ].filter(Boolean).join(' ');
  },
  missions: {
    acc: ({ result }) => result.accuracy >= 0.9,
    cheap: ({ result }) => result.accuracy >= 0.9 && result.tokens <= 1200,
    bias: ({ result }) => result.refundShare >= 0.55,
  },
});
