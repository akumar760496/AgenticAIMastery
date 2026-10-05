import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatPercent } from '@/shared/format';
import { simulateFeedback, type Capture, type FeedbackResult, type FeedbackState } from '../simulators/feedbackLoops';

const CAPTURE_STORY: Readonly<Record<Capture, string>> = {
  thumbs: 'Only 1.5% of users rate, mostly the angriest, so most failures go unseen',
  implicit: 'Retries, rephrasing and handoffs show far more failures, though noisily',
  both: 'Ratings and behaviour, joined to traces, show what failed and why',
};

export const feedbackLoopsPlayground = definePlayground<FeedbackState, FeedbackResult>({
  techniqueId: 'feedback',
  title: 'Close the feedback loop',
  intro: '2 lakh support chats a week; 72% are resolved without a human today. Numbers are illustrative over eight weeks.',
  controls: [
    { kind: 'select', key: 'capture', label: 'Signals captured', options: [{ value: 'thumbs', label: 'Thumbs only' }, { value: 'implicit', label: 'Implicit only (retry, rephrase, handoff)' }, { value: 'both', label: 'Both, linked to traces' }] },
    { kind: 'toggle', key: 'triage', label: 'Weekly triage into failure patterns with owners' },
    { kind: 'toggle', key: 'flywheel', label: 'Patterns feed eval cases and consented training data' },
  ],
  presets: {
    start: { state: { capture: 'thumbs', triage: false, flywheel: false }, expected: { detected: 0.25, fixDays: 45, resolution: 0.72 } },
    implicit: { state: { capture: 'implicit', triage: false, flywheel: false }, expected: { detected: 0.55, fixDays: 45, resolution: 0.72 } },
    triage: { state: { capture: 'both', triage: true, flywheel: false }, expected: { detected: 0.7, fixDays: 10, resolution: 0.755, hoursPerWeek: 12 } },
    flywheel: { state: { capture: 'both', triage: true, flywheel: true }, expected: { resolution: 0.79, fixDays: 10, hoursPerWeek: 16 } },
  },
  initialPreset: 'start',
  simulate: simulateFeedback,
  outputs: [
    { kind: 'meter', label: 'Failures detected', value: (r) => r.detected, detail: (r) => `${formatCount(r.signalsPerWeek)} signals a week` },
    { kind: 'value', label: 'Days to ship a fix', value: (r) => String(r.fixDays) },
    { kind: 'meter', label: 'Resolution without a human', value: (r) => r.resolution, detail: (r) => `= ${formatPercent(r.resolution, 1)} (+${r.gainPts} pts)` },
    { kind: 'value', label: 'Reviewer hours a week', value: (r) => String(r.hoursPerWeek) },
  ],
  verdict: (r, s) => (r.resolution >= 0.79 && r.fixDays <= 10 && r.hoursPerWeek <= 16
    ? { tone: 'ok', headline: 'The loop is turning.', detail: 'Signals become patterns, patterns become eval cases and fixes.' }
    : !s.triage ? { tone: 'no', headline: 'Signals pile up, nothing changes.', detail: 'Nobody turns the signals into owned fixes.' } : { tone: 'mid', headline: 'Fixing, but not compounding.', detail: 'Feed each pattern into the eval set so fixes stick.' }),
  narrate: (r, s) => `${CAPTURE_STORY[s.capture]}. ${s.triage ? 'A weekly triage names the patterns. ' : ''}Resolution is ${formatPercent(r.resolution, 1)}, fixes take ${r.fixDays} days and reviewers spend ${r.hoursPerWeek} hours a week.`,
  missions: {
    best: ({ result }) => result.resolution >= 0.79 && result.fixDays <= 10 && result.hoursPerWeek <= 16,
    implicit: ({ result }) => result.detected >= 0.55,
    cheap: ({ result }) => result.gainPts >= 3 && result.hoursPerWeek <= 12,
  },
});
