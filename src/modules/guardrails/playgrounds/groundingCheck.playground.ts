import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount } from '@/shared/format';
import { SUPPORT_THRESHOLDS, simulateGrounding, usesThreshold, type GroundingResult, type GroundingState } from '../simulators/groundingCheck';

const meetsTarget = (r: GroundingResult) => r.reachingUsers <= 50 && r.goodRefused <= 150 && r.latencyMs <= 600;
const DETECTOR_STORY: Readonly<Record<GroundingState['detector'], string>> = {
  none: 'Every draft goes out unchecked',
  llm: 'An LLM judge reads each whole answer, which is slow and misses claims buried in long answers',
  claims: 'A small checker scores each claim against the retrieved policy text',
  cascade: 'The small checker scores every claim and sends only the unsure ones to an LLM judge',
};

export const groundingPlayground = definePlayground<GroundingState, GroundingResult>({
  techniqueId: 'grounding',
  title: 'Check Suraksha Health’s answers (fictional insurer)',
  controls: [
    { kind: 'select', key: 'detector', label: 'Detector', options: [
      { value: 'none', label: 'No grounding check' }, { value: 'llm', label: 'LLM judge on the whole answer' },
      { value: 'claims', label: 'Small claim checker (MiniCheck-style)' }, { value: 'cascade', label: 'Claim checker, unsure claims to an LLM judge' },
    ] },
    { kind: 'steps', key: 'threshold', label: 'Support threshold (claim checkers only)', values: SUPPORT_THRESHOLDS, format: (v) => v.toFixed(1) },
    { kind: 'toggle', key: 'regenerate', label: 'Regenerate flagged answers once before refusing', isEnabled: (s) => s.detector !== 'none' },
  ],
  presets: {
    start: { state: { detector: 'none', threshold: 0.5, regenerate: false }, expected: { reachingUsers: 600, goodRefused: 0 } },
    llm: { state: { detector: 'llm', threshold: 0.5, regenerate: false }, expected: { reachingUsers: 180, goodRefused: 470, latencyMs: 1200, costInr: 4000 } },
    claims: { state: { detector: 'claims', threshold: 0.5, regenerate: false }, expected: { reachingUsers: 72, goodRefused: 564, latencyMs: 150, costInr: 300 } },
    cascade: { state: { detector: 'cascade', threshold: 0.5, regenerate: true }, expected: { reachingUsers: 42, goodRefused: 85, latencyMs: 516, costInr: 1520 } },
  },
  initialPreset: 'start',
  simulate: simulateGrounding,
  outputs: [
    { kind: 'meter', label: 'Unsupported answers caught', value: (r) => r.recall, emphasis: (r) => (r.recall < 0.8 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Unsupported answers reaching users', value: (r) => `${formatCount(r.reachingUsers)} a day`, emphasis: (r) => (r.reachingUsers > 100 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Good answers refused', value: (r) => `${formatCount(r.goodRefused)} a day`, emphasis: (r) => (r.goodRefused > 300 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Added latency (average)', value: (r) => `${r.latencyMs} ms` },
    { kind: 'value', label: 'Cost', value: (r) => `₹${formatCount(r.costInr)} a day` },
  ],
  verdict: (r) => {
    if (meetsTarget(r)) return { tone: 'ok', headline: 'Few errors, few refusals.', detail: 'Cheap checks on every claim, the LLM only for unsure ones.' };
    if (r.reachingUsers > 300) return { tone: 'no', headline: 'Unsupported claims reach customers.', detail: 'Add a grounding check.' };
    if (r.goodRefused > 300) return { tone: 'mid', headline: 'Too many good answers refused.', detail: 'Raise the threshold or regenerate before refusing.' };
    return { tone: 'mid', headline: 'Close, but not there yet.', detail: 'Try the cascade and regeneration.' };
  },
  narrate: (r, s) => `${DETECTOR_STORY[s.detector]}${usesThreshold(s.detector) ? ` at a support threshold of ${s.threshold.toFixed(1)}` : ''}. ${formatCount(r.reachingUsers)} unsupported answers a day reach users; ${formatCount(r.goodRefused)} good ones are refused.`,
  missions: {
    best: ({ result }) => meetsTarget(result),
    cheap: ({ state: s, result }) => s.detector === 'claims' && result.reachingUsers <= 80 && result.costInr <= 500,
    over: ({ result }) => result.goodRefused > 1000,
  },
});
