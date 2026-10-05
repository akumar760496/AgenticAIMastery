import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatWholePercent, pluralise } from '@/shared/format';
import { AVAILABLE_TOOLS, REFERENCE_PATH, simulateProcessEval, type ProcessEvalResult, type ProcessEvalState } from '../simulators/processEval';

const preset = (calls: string[], refundCurrency: 'USD' | 'INR', expected: Partial<ProcessEvalResult>) => ({ state: { calls, refundCurrency }, expected });

export const processEvalPlayground = definePlayground<ProcessEvalState, ProcessEvalResult>({
  techniqueId: 'process',
  title: 'Score a refund agent’s trajectory',
  intro: `Reference path: ${REFERENCE_PATH.map((s, i) => `${i + 1}. ${s}`).join(' → ')}`,
  controls: [
    { kind: 'sequence', key: 'calls', label: 'What the agent did', palette: AVAILABLE_TOOLS, maxLength: 8, reference: REFERENCE_PATH },
    { kind: 'select', key: 'refundCurrency', label: 'issue_refund currency', options: [{ value: 'USD', label: 'USD' }, { value: 'INR', label: 'INR' }] },
  ],
  presets: {
    start: preset(['find_order', 'get_account', 'get_account', 'issue_refund'], 'USD', { exactMatch: false, stepEfficiency: 0.75, argumentsCorrect: false }),
    perfect: preset([...REFERENCE_PATH], 'INR', { exactMatch: true, stepEfficiency: 1 }),
    wasteful: preset(['find_order', 'get_account', 'lookup_fx', 'get_account', 'issue_refund'], 'INR', { inOrderMatch: true, stepEfficiency: 0.6 }),
    order: preset(['get_account', 'find_order', 'issue_refund'], 'INR', { inOrderMatch: false, anyOrderMatch: true }),
  },
  initialPreset: 'start',
  simulate: simulateProcessEval,
  outputs: [
    { kind: 'check', label: 'Exact match', value: (r) => r.exactMatch, detail: (r) => (r.exactMatch ? 'Same steps, same order.' : 'The sequence or an argument differs from the reference.') },
    { kind: 'check', label: 'In-order match', value: (r) => r.inOrderMatch, detail: (r) => (r.inOrderMatch ? 'All 3 reference steps appear in order.' : 'A reference step is missing or out of order.') },
    { kind: 'check', label: 'Any-order match', value: (r) => r.anyOrderMatch, detail: (r) => (r.anyOrderMatch ? 'All 3 reference steps appear somewhere.' : 'At least one reference step never happened.') },
    { kind: 'meter', label: 'Step efficiency', value: (r) => r.stepEfficiency, detail: (r) => `= 3 needed ÷ ${r.stepEfficiency ? Math.round(3 / r.stepEfficiency) : 0} taken`, emphasis: (r) => (r.stepEfficiency < 1 ? 'warn' : 'normal') },
    { kind: 'check', label: 'Arguments correct', value: (r) => r.argumentsCorrect },
  ],
  verdict: (r) =>
    r.exactMatch ? { tone: 'ok', headline: 'Perfect trajectory.', detail: 'Right steps, right order, right arguments.' }
      : r.inOrderMatch && r.argumentsCorrect ? { tone: 'mid', headline: 'Correct, but wasteful.', detail: 'Extra calls cost tokens and time.' }
      : { tone: 'no', headline: 'The process is wrong.', detail: r.argumentsCorrect ? 'A step is missing or out of order.' : 'The refund currency is wrong even if the steps look fine.' },
  narrate: (r, s) => {
    const parts = [`The agent made ${s.calls.length} tool ${pluralise(s.calls.length, 'call')}; a correct run needs 3, so efficiency is ${formatWholePercent(r.stepEfficiency)}.`];
    parts.push(r.unnecessaryCalls.length ? `${r.unnecessaryCalls.length} ${pluralise(r.unnecessaryCalls.length, 'call was', 'calls were')} unnecessary (${[...new Set(r.unnecessaryCalls)].join(', ')}), which costs tokens and time.` : 'No wasted calls.');
    parts.push(r.inOrderMatch ? 'The required steps happened in the right order.' : r.anyOrderMatch ? 'All required steps happened, but not in the right order, so the agent may have acted on data it hadn’t fetched yet.' : 'A required step is missing, so the task can’t be complete.');
    if (!r.argumentsCorrect) parts.push('The refund went out in USD instead of INR: the outcome might look fine while the money is wrong.');
    if (r.exactMatch) parts.push('This is a perfect trajectory.');
    return parts.join(' ');
  },
  missions: {
    exact: ({ result }) => result.exactMatch,
    half: ({ result }) => Math.abs(result.stepEfficiency - 0.5) < 1e-9,
    anyonly: ({ result }) => result.anyOrderMatch && !result.inOrderMatch,
  },
});
