import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatPercent } from '@/shared/format';
import { CONTROL_SUCCESS, simulateCanary, type CanaryResult, type CanaryState } from '../simulators/canaryRelease';

export const canaryReleasePlayground = definePlayground<CanaryState, CanaryResult>({
  techniqueId: 'canary',
  title: 'Is the canary big enough?',
  intro: '2,000 conversations an hour. Control resolves 94%. You do not know how good v13 really is; pick the truth and see whether your canary could tell. Power is the chance a one-sided test at 5% significance detects the true difference.',
  controls: [
    { kind: 'select', key: 'truth', label: 'v13 is really', options: [{ value: 'worse', label: 'Worse: 90%' }, { value: 'same', label: 'The same: 94%' }, { value: 'better', label: 'Better: 95%' }] },
    { kind: 'steps', key: 'share', label: 'Canary share', values: [0.01, 0.05, 0.1, 0.25], format: (v) => `${Math.round(v * 100)}%` },
    { kind: 'steps', key: 'hours', label: 'Bake time', values: Array.from({ length: 48 }, (_, i) => i + 1), format: (v) => `${v} h` },
  ],
  presets: {
    start: { state: { truth: 'worse', share: 0.01, hours: 2 }, expected: { canaryN: 40, power: 0.2106 } },
    sized: { state: { truth: 'worse', share: 0.05, hours: 5 }, expected: { canaryN: 500, power: 0.9012, extraFailures: 20 } },
    big: { state: { truth: 'worse', share: 0.25, hours: 12 }, expected: { canaryN: 6000, extraFailures: 240 } },
    better: { state: { truth: 'better', share: 0.1, hours: 24 }, expected: { canaryN: 4800, power: 0.9103 } },
  },
  initialPreset: 'start',
  simulate: simulateCanary,
  outputs: [
    { kind: 'value', label: 'Canary conversations', value: (r) => formatCount(Math.round(r.canaryN)), detail: (r) => `success known to within about ${(r.standardError * 196).toFixed(1)} points` },
    { kind: 'meter', label: 'Power to detect the true difference', value: (r) => r.power ?? 0, detail: (r) => (r.power === null ? 'no real difference to detect' : `= ${formatPercent(r.power, 1)}`), emphasis: (r) => ((r.power ?? 1) < 0.8 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Extra failures caused by the canary', value: (r) => formatCount(Math.round(r.extraFailures)), detail: (r) => `at 100% for the same time: ${formatCount(Math.round(r.fullRolloutExtra))}` },
  ],
  verdict: (r) => (r.power === null
    ? { tone: 'ok', headline: 'Nothing to detect.', detail: 'v13 is really the same, so promoting it after the bake is right.' }
    : r.power >= 0.8 ? { tone: 'ok', headline: 'The canary can tell.', detail: `It catches the true difference ${formatPercent(r.power, 0)} of the time.` } : { tone: 'no', headline: 'A pass here proves little.', detail: 'The canary is too small or too short to see the difference.' }),
  narrate: (r, s) => [
    `At ${Math.round(s.share * 100)}% for ${s.hours} h the canary sees ${formatCount(Math.round(r.canaryN))} conversations, so its success rate is known to within about ${(r.standardError * 196).toFixed(1)} points.`,
    r.power === null ? 'Since v13 is really the same, the right outcome is to promote it after the bake.' : r.power >= 0.8 ? `That is enough: the test catches the ${Math.round(Math.abs(r.canarySuccess - CONTROL_SUCCESS) * 100)}-point ${s.truth === 'worse' ? 'drop' : 'gain'} ${formatPercent(r.power, 0)} of the time.` : `The test would miss the ${Math.round(Math.abs(r.canarySuccess - CONTROL_SUCCESS) * 100)}-point ${s.truth === 'worse' ? 'drop' : 'gain'} most of the time (power ${formatPercent(r.power, 0)}).`,
    s.truth === 'worse' ? `Meanwhile the canary caused ${formatCount(Math.round(r.extraFailures))} extra failures; at 100% it would have been ${formatCount(Math.round(r.fullRolloutExtra))}.` : '',
  ].filter(Boolean).join(' '),
  missions: {
    detect: ({ state, result }) => state.truth === 'worse' && (result.power ?? 0) >= 0.8,
    small: ({ state, result }) => state.truth === 'worse' && (result.power ?? 0) >= 0.8 && result.canaryN <= 1000,
    better: ({ state, result }) => state.truth === 'better' && (result.power ?? 0) >= 0.8 && state.share <= 0.1,
  },
});
