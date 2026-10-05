import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatWholePercent } from '@/shared/format';
import { MESSAGES, simulateFunctionCalling, type FunctionCallingResult, type FunctionCallingState, type UserMessage } from '../simulators/functionCalling';

const base: FunctionCallingState = { message: 'one', toolChoice: 'auto', scope: 'first', model: 'careful', strict: false };

export const functionCallingPlayground = definePlayground<FunctionCallingState, FunctionCallingResult>({
  techniqueId: 'fcall',
  title: 'UPI support assistant · tools: get_transaction_status, get_refund_status',
  controls: [
    { kind: 'select', key: 'message', label: 'User message', options: (Object.keys(MESSAGES) as UserMessage[]).map((k) => ({ value: k, label: `${k === 'none' ? 'Needs no tool' : k === 'one' ? 'Needs one tool' : 'Needs two tools in turn'}: ${MESSAGES[k].text}` })) },
    { kind: 'select', key: 'toolChoice', label: 'tool_choice', options: [{ value: 'auto', label: 'auto: the model decides' }, { value: 'any', label: 'any: must call some tool' }, { value: 'tool', label: 'tool: must call get_transaction_status' }, { value: 'none', label: 'none: no tool calls' }] },
    { kind: 'select', key: 'scope', label: 'Forcing applies to', options: [{ value: 'first', label: 'the first request only, then auto' }, { value: 'every', label: 'every request in the loop' }] },
    { kind: 'select', key: 'model', label: 'Model behaviour', options: [{ value: 'careful', label: 'careful: well-formed arguments' }, { value: 'sloppy', label: 'sloppy: first attempt at each tool is malformed' }] },
    { kind: 'toggle', key: 'strict', label: 'strict: true (grammar-constrained arguments)' },
  ],
  presets: {
    start: { state: { ...base, message: 'none', toolChoice: 'any' }, expected: { turns: 2, calls: 1, wasted: 1, end: 'answered' } },
    sloppy: { state: { ...base, message: 'two', model: 'sloppy' }, expected: { turns: 5, calls: 4, validShare: 0.5 } },
    stuck: { state: { ...base, toolChoice: 'tool', scope: 'every' }, expected: { turns: 6, end: 'stuck' } },
    none: { state: { ...base, toolChoice: 'none' }, expected: { turns: 1, calls: 0, end: 'guessed' } },
  },
  initialPreset: 'start',
  simulate: simulateFunctionCalling,
  outputs: [
    { kind: 'badges', items: (r) => r.trace.map((t) => ({ text: t.text, emphasis: t.tone === 'ok' ? 'normal' : 'warn' })) },
    { kind: 'value', label: 'Model turns', value: (r) => String(r.turns) },
    { kind: 'value', label: 'Tool calls made', value: (r) => String(r.calls), detail: (r) => `needed: ${r.needed}${r.wasted ? ` · wasted: ${r.wasted}` : ''}` },
    { kind: 'meter', label: 'Schema-valid arguments', value: (r) => r.validShare, emphasis: (r) => (r.validShare < 1 ? 'warn' : 'normal') },
    { kind: 'value', label: 'End state', value: (r) => (r.end === 'answered' ? 'answered' : r.end === 'guessed' ? 'answered without data' : 'stuck at the step cap') },
  ],
  verdict: (r) => {
    if (r.end === 'stuck') return { tone: 'no', headline: 'The loop never ends.', detail: 'Forcing on every request stops the model from ever answering in text.' };
    if (r.end === 'guessed') return { tone: 'no', headline: 'A guess, not a lookup.', detail: 'tool_choice none blocked a lookup the question needed.' };
    if (r.wasted) return { tone: 'mid', headline: `${r.wasted} wasted call${r.wasted > 1 ? 's' : ''}.`, detail: 'Forcing a tool the question did not need costs a call and a turn.' };
    if (r.validShare < 1) return { tone: 'mid', headline: 'Answered after retries.', detail: 'Malformed arguments came back as errors and were retried; strict mode prevents them.' };
    return { tone: 'ok', headline: 'Clean run.', detail: 'Each needed call made once, then the answer.' };
  },
  narrate: (r, s) => [
    `The message needs ${r.needed === 0 ? 'no tool' : r.needed === 1 ? 'one lookup' : 'two lookups, the second using the first one’s result'}.`,
    s.toolChoice === 'none' ? (r.needed ? 'With tool_choice none the model cannot look anything up, so it answers from nothing.' : 'With tool_choice none the model simply replies.')
      : s.toolChoice === 'auto' ? 'With tool_choice auto the model calls a tool only when the question needs one.'
        : s.scope === 'every' ? `tool_choice ${s.toolChoice} is sent on every request, so the model can never reply in text; the loop stops at the cap of 6 turns.` : `tool_choice ${s.toolChoice} forces a call on the first request only, then the loop switches to auto.`,
    s.model === 'sloppy' ? (s.strict ? 'Strict mode constrains sampling to the schema, so even the sloppy model’s arguments are valid.' : 'The sloppy model sends a malformed argument on its first try at each tool; the error goes back with is_error and it retries.') : '',
    `Result: ${r.turns} model turns, ${r.calls} calls${r.calls ? `, ${formatWholePercent(r.validShare)} schema-valid` : ''}.`,
  ].filter(Boolean).join(' '),
  missions: {
    zero: ({ state, result }) => state.message === 'none' && result.calls === 0 && result.end === 'answered',
    three: ({ state, result }) => state.message === 'two' && result.turns === 3 && result.end === 'answered',
    valid: ({ state, result }) => state.model === 'sloppy' && result.calls > 0 && result.validShare === 1 && result.end === 'answered',
  },
});
