import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { simulateReflection, type Feedback, type ReflectionResult, type ReflectionState } from '../simulators/reflection';

const FEEDBACK: Readonly<Record<Feedback, string>> = { none: 'No evaluator', self: 'Self-critique', rules: 'Checklist + rules' };

export const reflectionPlayground = definePlayground<ReflectionState, ReflectionResult>({
  techniqueId: 'reflect',
  title: 'Revise a loan-sanction letter',
  intro: 'Score out of 100 from weighted disclosure checks: rate, tenure, EMI, fees, grievance contact and more. Each draft or revision costs ₹1.50; self-critique ₹0.40 per evaluation, the rules check ₹0.10. The loop keeps the best draft.',
  controls: [
    { kind: 'choice', key: 'feedback', label: 'Feedback source', options: (Object.keys(FEEDBACK) as Feedback[]).map((k) => ({ value: k, label: FEEDBACK[k] })) },
    { kind: 'steps', key: 'maxRounds', label: 'Maximum rounds', values: [1, 2, 3, 4, 5], format: String },
    { kind: 'toggle', key: 'memory', label: 'Memory: lessons from earlier letters (₹0.05)', isEnabled: (s) => s.feedback !== 'none' },
  ],
  presets: {
    start: { state: { feedback: 'self', maxRounds: 3, memory: false }, expected: { scores: [62, 70, 74], best: 74, costInr: 5.7 } },
    rules: { state: { feedback: 'rules', maxRounds: 3, memory: false }, expected: { scores: [62, 81, 92], best: 92, costInr: 4.8 } },
    long: { state: { feedback: 'self', maxRounds: 5, memory: false }, expected: { best: 74, regressed: true, costInr: 9.5 } },
    none: { state: { feedback: 'none', maxRounds: 3, memory: false }, expected: { best: 62, costInr: 1.5 } },
  },
  initialPreset: 'start',
  simulate: simulateReflection,
  outputs: [
    { kind: 'table', columns: ['Round', 'Score'], rows: (r) => r.scores.map((v, i) => [`Round ${i + 1}${i + 1 === r.bestRound ? ' · best' : ''}`, String(v)]) },
    { kind: 'value', label: 'Returned score', value: (r) => `${r.best} / 100`, detail: (r) => `best draft, from round ${r.bestRound}${r.last < r.best ? ` · the last draft scored only ${r.last}` : ''}` },
    { kind: 'value', label: 'Rounds · cost per letter', value: (r) => `${r.rounds} · ₹${r.costInr.toFixed(2)}` },
    { kind: 'check', label: 'Every revision improved', value: (r) => !r.regressed },
  ],
  verdict: (r, s) => (r.best >= 90
    ? { tone: 'ok', headline: 'Good enough to send.', detail: 'External checks tell the model exactly what to fix.' }
    : r.regressed ? { tone: 'no', headline: 'The critic is making it worse.', detail: 'Without an external check, revisions drift.' }
      : { tone: 'mid', headline: 'Not there yet.', detail: s.feedback === 'none' ? 'One draft, no feedback.' : 'Self-critique finds vague issues, not the missing disclosures.' }),
  narrate: (r, s) => [
    s.feedback === 'none' ? `With no evaluator the first draft goes out as it is: ${r.scores[0]} of 100.`
      : s.feedback === 'self' ? `The model critiques its own letter. Scores go ${r.scores.join(' → ')}: early rounds fix wording, but with no external check it cannot tell which disclosures are missing${r.regressed ? ', and later revisions undo earlier fixes' : ''}.`
        : `Each failed rule becomes a specific critique, so scores go ${r.scores.join(' → ')}.`,
    s.memory && s.feedback !== 'none' ? 'Lessons from earlier letters raise the first draft, so fewer rounds are needed.' : '',
    r.last < r.best ? `Returning the best draft (${r.best}) instead of the last (${r.last}) avoids shipping the regression.` : '',
    `Cost: ₹${r.costInr.toFixed(2)} per letter.`,
  ].filter(Boolean).join(' '),
  missions: {
    three: ({ result }) => result.roundReaching90 > 0 && result.roundReaching90 <= 3,
    regress: ({ state, result }) => state.feedback === 'self' && result.regressed,
    cheap: ({ result }) => result.best >= 90 && result.costInr <= 3.25 + 1e-9,
  },
});
