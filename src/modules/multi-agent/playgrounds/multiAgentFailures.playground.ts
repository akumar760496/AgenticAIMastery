import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { simulateFailures, type FailureResult, type FailureState } from '../simulators/multiAgentFailures';

const base: FailureState = { messageCap: false, tokenCap: false, timeCap: false, repetitionDetector: false, verifier: false, operator: 'and', forgetPct: 20 };

export const multiAgentFailuresPlayground = definePlayground<FailureState, FailureResult>({
  techniqueId: 'mafail',
  title: '50 overnight coder–reviewer runs',
  intro: 'A run needs 8 to 26 messages; each costs 4k tokens and 20 s. 8 runs fall into a loop, and 6 claim APPROVED too early. Runs nobody stops are killed by hand at 60 messages.',
  controls: [
    { kind: 'toggle', key: 'messageCap', label: 'MaxMessageTermination(30)' },
    { kind: 'toggle', key: 'tokenCap', label: 'TokenUsageTermination(100k): 25 messages' },
    { kind: 'toggle', key: 'timeCap', label: 'TimeoutTermination(12 min): 36 messages' },
    { kind: 'toggle', key: 'repetitionDetector', label: 'Repetition detector' },
    { kind: 'toggle', key: 'verifier', label: 'Verifier: tests must pass before APPROVED counts' },
    { kind: 'select', key: 'operator', label: 'Combine the stop signal and caps with', options: [{ value: 'and', label: '& (AND): all must fire' }, { value: 'or', label: '| (OR): any one stops the run' }] },
    { kind: 'steps', key: 'forgetPct', label: 'Chance an agent forgets to say APPROVED', values: Array.from({ length: 13 }, (_, i) => i * 5), format: (v) => `${v}%` },
  ],
  presets: {
    start: { state: base, expected: { endless: 15, premature: 6, unverified: 35, averageK: 116.08 } },
    andcaps: { state: { ...base, messageCap: true, tokenCap: true, timeCap: true }, expected: { endless: 15, averageK: 172.8, unverified: 35 } },
    andver: { state: { ...base, messageCap: true, tokenCap: true, timeCap: true, verifier: true }, expected: { unverified: 0, premature: 0 } },
    det: { state: { ...base, repetitionDetector: true, operator: 'or' }, expected: { endless: 7, premature: 6, unverified: 43 } },
  },
  initialPreset: 'start',
  simulate: simulateFailures,
  outputs: [
    { kind: 'badges', items: (r) => [
      { text: `finished ${r.outcomes.filter((o) => o === 'finished').length}`, emphasis: 'normal' as const },
      { text: `stopped early ${r.premature}`, emphasis: r.premature ? 'warn' as const : 'normal' as const },
      { text: `loops cut ${r.loopsCut}`, emphasis: 'normal' as const },
      { text: `endless ${r.endless}`, emphasis: r.endless ? 'warn' as const : 'normal' as const },
    ] },
    { kind: 'value', label: 'Endless runs', value: (r) => `${r.endless} of 50`, emphasis: (r) => (r.endless ? 'warn' : 'normal') },
    { kind: 'value', label: 'Average tokens per run', value: (r) => `${r.averageK.toFixed(1)}k`, detail: (r) => `= ${r.ratio.toFixed(2)}× the ${r.baseK.toFixed(1)}k a run needs` },
    { kind: 'value', label: 'Premature stops', value: (r) => String(r.premature), detail: (r) => (r.falseApprovals ? `${r.falseApprovals} false APPROVED claims accepted` : '') },
    { kind: 'value', label: 'Unverified outputs shipped', value: (r) => String(r.unverified), emphasis: (r) => (r.unverified ? 'warn' : 'normal') },
  ],
  verdict: (r, s) => {
    const tone = r.endless === 0 && r.premature <= 2 && r.unverified === 0 ? 'ok' : r.endless ? 'no' : 'mid';
    const headline = r.endless ? `${r.endless} runs never stop.` : r.unverified ? `${r.unverified} outputs shipped unchecked.` : r.premature > 2 ? `${r.premature} runs stopped too early.` : 'Bounded and verified.';
    const detail = s.operator === 'and' && r.caps ? 'AND waits for every condition; use OR.' : !r.caps && !s.repetitionDetector ? 'Nothing but the agents’ own word ends a run.' : !s.verifier ? 'Add a verifier so APPROVED means checked.' : 'Caps, detection and verification all in place.';
    return { tone, headline, detail };
  },
  narrate: (r, s) => [
    r.caps ? `${r.caps} caps are on, combined with ${s.operator === 'or' ? 'OR, so the first one reached stops a run' : 'AND, so a run stops only when every condition has fired'}.` : 'No caps are set, so a run ends only when an agent says APPROVED.',
    s.repetitionDetector ? 'The repetition detector breaks the 8 loops after 3 extra messages.' : 'The 8 looping runs never finish on their own.',
    s.verifier ? 'The verifier rejects early APPROVED claims: done now means the tests passed.' : `Early APPROVED claims are accepted, and ${s.forgetPct}% of the remaining runs never say it.`,
    `Result: ${r.endless} endless, ${r.premature} premature, ${r.unverified} unverified, ${r.averageK.toFixed(1)}k tokens per run (${r.ratio.toFixed(2)}× what the work needs).`,
  ].join(' '),
  missions: {
    noendless: ({ result }) => result.endless === 0,
    fewprem: ({ result }) => result.caps >= 2 && result.premature <= 2 && result.endless === 0,
    verified: ({ state, result }) => state.verifier && result.unverified === 0 && result.ratio < 1.3 && result.endless === 0,
  },
});
