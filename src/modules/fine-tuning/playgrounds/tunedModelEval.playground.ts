import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatFixed, formatWholePercent } from '@/shared/format';
import { simulateTunedEval, type TunedEvalResult, type TunedEvalState } from '../simulators/tunedModelEval';

export const tunedModelEvalPlayground = definePlayground<TunedEvalState, TunedEvalResult>({
  techniqueId: 'tuneeval',
  title: 'Check a tuned underwriting-notes model',
  intro: 'The true improvement from tuning is +4 points on the target task. Your test set decides what you actually see.',
  controls: [
    { kind: 'select', key: 'cases', label: 'Test cases', options: [{ value: '50', label: '50' }, { value: '200', label: '200' }, { value: '1000', label: '1,000' }] },
    { kind: 'select', key: 'contamination', label: 'Near-duplicates of training data', options: [{ value: '0', label: '0%: deduplicated' }, { value: '0.1', label: '10%' }, { value: '0.3', label: '30%' }] },
    { kind: 'toggle', key: 'general', label: 'Run a general-knowledge suite' },
    { kind: 'toggle', key: 'safety', label: 'Run a safety refusal suite' },
  ],
  presets: {
    start: { state: { cases: 50, contamination: 0.1, general: false, safety: false }, expected: { measuredGain: 6.6667, margin: 15.68 } },
    claimed: { state: { cases: 50, contamination: 0.3, general: false, safety: false }, expected: { measuredGain: 12, unearned: 8 } },
    bigger: { state: { cases: 200, contamination: 0.1, general: false, safety: false }, expected: { measuredGain: 6.6667, margin: 7.84 } },
    clean: { state: { cases: 1000, contamination: 0, general: false, safety: false }, expected: { measuredGain: 4, margin: 3.5062 } },
  },
  initialPreset: 'start',
  simulate: simulateTunedEval,
  outputs: [
    { kind: 'value', label: 'Measured gain', value: (r) => `+${formatFixed(r.measuredGain, 1)} pts` },
    { kind: 'value', label: 'Margin of error (95%)', value: (r) => `± ${formatFixed(r.margin, 1)} pts`, emphasis: (r) => (r.margin >= 4 ? 'warn' : 'normal') },
    { kind: 'check', label: 'Gain clearly above zero', value: (r) => r.significant },
    { kind: 'value', label: 'Points the model did not earn', value: (r) => formatFixed(r.unearned, 1), emphasis: (r) => (r.unearned > 0 ? 'warn' : 'normal') },
  ],
  verdict: (r, s) => {
    const honest = s.contamination === 0 && r.margin < 4;
    if (honest && s.general && s.safety) return { tone: 'ok', headline: 'The honest picture.', detail: 'A real 4-point gain, with regressions to weigh before rollout: general knowledge −6 points, safety refusals −3.' };
    if (s.contamination > 0) return { tone: 'no', headline: 'The score is inflated.', detail: 'Leaked test cases add points that tuning did not earn.' };
    if (r.margin >= 4) return { tone: 'mid', headline: 'Too few cases to tell.', detail: 'The margin of error is wider than the effect.' };
    return { tone: 'mid', headline: 'Clean, but incomplete.', detail: 'Run general and safety suites to see what tuning broke.' };
  },
  narrate: (r, s) => {
    const suites = [s.general ? 'a 6-point drop on general knowledge' : '', s.safety ? 'a 3-point drop in safety refusals' : ''].filter(Boolean);
    return [
      `On ${formatCount(s.cases)} cases the tuned model appears ${formatFixed(r.measuredGain, 1)} points better, give or take ${formatFixed(r.margin, 1)}.`,
      s.contamination > 0 ? `${formatWholePercent(s.contamination)} of the test set leaked from training, adding ${formatFixed(r.unearned, 1)} points it did not earn.` : 'The test set is deduplicated, so the gain is not inflated.',
      suites.length ? `The regression suites show ${suites.join(' and ')}.` : 'Nothing outside the target task was checked.',
    ].join(' ');
  },
  missions: {
    tight: ({ state, result }) => result.margin < 4 && state.contamination === 0,
    full: ({ state, result }) => result.margin < 4 && state.contamination === 0 && state.general && state.safety,
    bigger: ({ state, result }) => state.cases === 1000 && result.measuredGain >= 11.9,
  },
});
