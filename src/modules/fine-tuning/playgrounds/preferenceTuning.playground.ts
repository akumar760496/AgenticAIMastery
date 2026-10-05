import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatFixed, formatWholePercent, pluralise } from '@/shared/format';
import { simulateDpo, type DpoResult, type DpoState } from '../simulators/preferenceTuning';

const isSafe = (r: DpoResult, s: DpoState) => r.winRate >= 62 && r.regression <= 1 && !s.lengthBias;

export const preferenceTuningPlayground = definePlayground<DpoState, DpoResult>({
  techniqueId: 'dpo',
  title: 'Tune a research assistant on adviser preferences',
  intro: 'Advisers compare two answers per question. The win rate is against the current model on 1,000 held-out questions; 50% means no change.',
  controls: [
    { kind: 'select', key: 'pairs', label: 'Preference pairs', options: [{ value: '1000', label: '1,000' }, { value: '5000', label: '5,000' }, { value: '20000', label: '20,000' }] },
    { kind: 'select', key: 'noise', label: 'Pairs labelled the wrong way', options: [{ value: '0.05', label: '5%: filtered by agreement' }, { value: '0.15', label: '15%' }, { value: '0.3', label: '30%: single rushed labeller' }] },
    { kind: 'select', key: 'beta', label: 'beta', options: [{ value: '0.01', label: '0.01: free to drift' }, { value: '0.1', label: '0.1: common default' }, { value: '0.5', label: '0.5: kept close' }] },
    { kind: 'toggle', key: 'fromSft', label: 'Start from the SFT model' },
    { kind: 'toggle', key: 'lengthBias', label: 'Chosen answer is usually the longer one' },
  ],
  presets: {
    start: { state: { pairs: 1000, noise: 0.3, beta: 0.1, lengthBias: false, fromSft: true }, expected: { winRate: 54.32, netPairs: 400 } },
    clean: { state: { pairs: 5000, noise: 0.05, beta: 0.1, lengthBias: false, fromSft: true }, expected: { winRate: 63.77, regression: 1 } },
    loose: { state: { pairs: 20000, noise: 0.15, beta: 0.01, lengthBias: false, fromSft: true }, expected: { winRate: 63.86, regression: 6 } },
    raw: { state: { pairs: 5000, noise: 0.05, beta: 0.1, lengthBias: false, fromSft: false }, expected: { winRate: 58.262, regression: 3 } },
  },
  initialPreset: 'start',
  simulate: simulateDpo,
  outputs: [
    { kind: 'meter', label: 'Win rate vs current model', value: (r) => r.winRate / 100, detail: () => '= 50% means no change', emphasis: (r) => (r.winRate < 62 ? 'warn' : 'normal') },
    { kind: 'value', label: 'General suite change', value: (r) => (r.regression ? `−${r.regression} pts` : 'no change'), emphasis: (r) => (r.regression > 1 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Average answer length', value: (r) => `${r.lengthChange > 0 ? '+' : ''}${r.lengthChange}%` },
    { kind: 'value', label: 'Net useful pairs', value: (r) => formatCount(Math.round(r.netPairs)) },
  ],
  verdict: (r, s) => (isSafe(r, s)
    ? { tone: 'ok', headline: 'Preferred, and nothing broke.', detail: 'Clean pairs on an SFT model with a moderate beta.' }
    : s.lengthBias ? { tone: 'mid', headline: 'It learned that longer wins.', detail: 'Answers grew 45% longer without being better.' }
      : r.winRate >= 62 ? { tone: 'mid', headline: 'Preferred, at a cost.', detail: 'A small beta let the model drift and lose general skills.' }
        : { tone: 'no', headline: 'Barely moved.', detail: 'Too few clean pairs, or no SFT start.' }),
  narrate: (r, s) => [
    `${formatCount(s.pairs)} pairs with ${formatWholePercent(s.noise)} flipped labels leave ${formatCount(Math.round(r.netPairs))} pairs of net signal.`,
    `The tuned model wins ${formatFixed(r.winRate, 1)}% of comparisons${s.fromSft ? '' : ', held back by starting from a model that does not yet follow instructions well'}.`,
    r.regression ? `The general suite drops ${r.regression} ${pluralise(r.regression, 'point')}.` : 'The general suite is unchanged.',
    s.lengthBias ? 'Because chosen answers were usually longer, answers grew by 45%.' : '',
  ].filter(Boolean).join(' '),
  missions: {
    win: ({ result }) => result.winRate >= 62,
    safe: ({ state, result }) => isSafe(result, state),
    verbose: ({ result }) => result.lengthChange >= 40 && result.winRate >= 60,
  },
});
