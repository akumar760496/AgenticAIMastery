import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatPercent } from '@/shared/format';
import { simulateOnlineEval, type OnlineEvalResult, type OnlineEvalState } from '../simulators/onlineEvaluation';

const delay = (h: number) => (h < 48 ? `${h.toFixed(1)} hours` : `${(h / 24).toFixed(1)} days`);

export const onlineEvaluationPlayground = definePlayground<OnlineEvalState, OnlineEvalResult>({
  techniqueId: 'onlineeval',
  title: 'Monitor answers with a sampled LLM judge',
  intro: '50,000 answers a day. The judge pass rate is normally 92%. On day 8 it really drops to 86%. Judging costs ₹0.40 an answer.',
  controls: [
    { kind: 'steps', key: 'sampleRate', label: 'Judge sample rate', values: [0.005, 0.01, 0.02, 0.05], format: (v) => `${v * 100}%` },
    { kind: 'steps', key: 'windowHours', label: 'Alert window', values: [1, 6, 24], format: (v) => `${v} h` },
    { kind: 'steps', key: 'thresholdPts', label: 'Alert when the pass rate drops by more than', values: [2, 4, 6, 8], format: (v) => `${v} points` },
  ],
  presets: {
    start: { state: { sampleRate: 0.005, windowHours: 1, thresholdPts: 2 }, expected: { falseAlertsPerWeek: 68.2023 } },
    tuned: { state: { sampleRate: 0.02, windowHours: 6, thresholdPts: 4 }, expected: { judgedPerWindow: 250, falseAlertsPerWeek: 0.2764, delayHours: 7.3265, costPerDay: 400 } },
    heavy: { state: { sampleRate: 0.05, windowHours: 1, thresholdPts: 4 }, expected: { falseAlertsPerWeek: 11.119, costPerDay: 1000 } },
    slow: { state: { sampleRate: 0.005, windowHours: 24, thresholdPts: 8 }, expected: { delayHours: 132.5567 } },
  },
  initialPreset: 'start',
  simulate: simulateOnlineEval,
  outputs: [
    { kind: 'value', label: 'Judged answers per window', value: (r) => formatCount(Math.round(r.judgedPerWindow)), detail: (r) => `noise alone moves the pass rate about ${(r.noiseSe * 100).toFixed(1)} points` },
    { kind: 'value', label: 'False alerts a week', value: (r) => (r.falseAlertsPerWeek < 0.01 ? 'almost none' : r.falseAlertsPerWeek.toFixed(2)), emphasis: (r) => (r.falseAlertsPerWeek >= 1 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Chance a window catches the real drop', value: (r) => r.detectProbability },
    { kind: 'value', label: 'Expected delay to catch it', value: (r) => delay(r.delayHours), emphasis: (r) => (r.delayHours > 12 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Judge cost', value: (r) => `₹${formatCount(Math.round(r.costPerDay))} a day` },
  ],
  verdict: (r) => {
    if (r.falseAlertsPerWeek < 1 && r.delayHours <= 12) return { tone: 'ok', headline: 'Quiet and quick.', detail: 'Few false alerts, and a real drop is caught within half a day.' };
    if (r.falseAlertsPerWeek >= 1) return { tone: 'no', headline: 'The alert cries wolf.', detail: 'Too few judgements per window: noise crosses the threshold.' };
    return { tone: 'mid', headline: 'Quiet, but slow.', detail: 'Real drops take too long to confirm.' };
  },
  narrate: (r, s) => `Each ${s.windowHours}-hour window holds ${formatCount(Math.round(r.judgedPerWindow))} judged answers, so the pass rate wobbles by about ${(r.noiseSe * 100).toFixed(1)} points from noise alone. A ${s.thresholdPts}-point threshold gives ${r.falseAlertsPerWeek < 0.01 ? 'almost no' : r.falseAlertsPerWeek.toFixed(2)} false alerts a week. When the real 6-point drop comes, each window catches it with probability ${formatPercent(r.detectProbability, 0)}, so the expected delay is ${delay(r.delayHours)}. The judge costs ₹${formatCount(Math.round(r.costPerDay))} a day.`,
  missions: {
    quiet: ({ result }) => result.falseAlertsPerWeek < 1 && result.delayHours <= 12,
    cheap: ({ result }) => result.falseAlertsPerWeek < 1 && result.delayHours <= 12 && result.costPerDay <= 400,
    blind: ({ result }) => result.falseAlertsPerWeek < 0.1 && result.delayHours >= 48,
  },
});
