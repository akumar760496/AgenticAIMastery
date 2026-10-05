import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { simulateA2a, type A2aResult, type A2aState } from '../simulators/agentToAgent';

const st = (task: A2aState['task'], onInput: A2aState['onInput'], signed: boolean, verify: boolean, streaming: boolean): A2aState => ({ task, delivery: 'poll', onInput, signed, verify, streaming, push: false });

export const agentToAgentPlayground = definePlayground<A2aState, A2aResult>({
  techniqueId: 'a2a',
  title: 'Claims agent → garage chain’s agent (fictional)',
  controls: [
    { kind: 'select', key: 'task', label: 'Task', options: [{ value: 'quick', label: 'claim status lookup (2 s)' }, { value: 'input', label: 'negotiate an estimate: asks one question' }, { value: 'long', label: 'full survey and estimate (42 s)' }] },
    { kind: 'select', key: 'delivery', label: 'Delivery', options: [{ value: 'poll', label: 'poll GetTask every 5 s' }, { value: 'stream', label: 'stream updates' }, { value: 'push', label: 'push notifications to a webhook' }] },
    { kind: 'select', key: 'onInput', label: 'When the task is INPUT_REQUIRED, the client', options: [{ value: 'terminal', label: 'treats it as terminal and marks it failed' }, { value: 'answer', label: 'answers on the same task' }] },
    { kind: 'toggle', key: 'signed', label: 'The Agent Card is signed' },
    { kind: 'toggle', key: 'verify', label: 'Client verifies the signature' },
    { kind: 'toggle', key: 'streaming', label: 'Card advertises capabilities.streaming' },
    { kind: 'toggle', key: 'push', label: 'Card advertises capabilities.pushNotifications' },
  ],
  presets: {
    start: { state: st('input', 'terminal', true, true, true), expected: { end: 'failed by client', polls: 2, seenAtS: 10 } },
    unsigned: { state: st('quick', 'answer', false, false, true), expected: { end: 'COMPLETED', polls: 1 } },
    long: { state: st('long', 'answer', true, true, false), expected: { end: 'COMPLETED', polls: 9, seenAtS: 45 } },
    quick: { state: st('quick', 'answer', true, false, true), expected: { end: 'COMPLETED', polls: 1 } },
  },
  initialPreset: 'start',
  simulate: simulateA2a,
  outputs: [
    { kind: 'badges', items: (r) => (r.end === 'rejected' ? [{ text: 'card rejected: no valid signature', emphasis: 'warn' as const }] : r.states.map((t) => ({ text: t, emphasis: t === 'FAILED' || t === 'INPUT_REQUIRED' ? 'warn' as const : 'normal' as const }))) },
    { kind: 'value', label: 'Messages sent', value: (r) => String(r.messages) },
    { kind: 'value', label: 'GetTask polls', value: (r) => String(r.polls), detail: (r) => (r.fellBack ? 'the card does not support that delivery mode, so the client falls back to polling' : '') },
    { kind: 'value', label: 'Result seen after', value: (r) => (r.end === 'rejected' ? 'never sent' : `${r.seenAtS} s`) },
  ],
  verdict: (r, s) => {
    if (r.end === 'rejected') return { tone: 'mid', headline: 'Rejected safely.', detail: 'An unverifiable card is refused before any claim data leaves.' };
    if (r.end !== 'COMPLETED') return { tone: 'no', headline: 'Failed by the client.', detail: 'INPUT_REQUIRED is interrupted, not terminal: answer it on the same task.' };
    if (s.task === 'quick') return { tone: 'mid', headline: 'Completed with an artifact.', detail: 'This works, but a status lookup is a function: delegation adds cards, auth and task handling for nothing.' };
    if (!s.verify) return { tone: 'mid', headline: 'Completed with an artifact.', detail: 'It worked, but nothing proved the card came from the garage chain.' };
    return { tone: 'ok', headline: 'Completed with an artifact.', detail: r.polls ? `${r.polls} polls; streaming or push would need none.` : 'No polling: updates arrived as they happened.' };
  },
  narrate: (r, s) => (r.end === 'rejected' ? 'The client fetches the Agent Card, finds no valid signature and stops before sending any claim data.' : [
    `${s.verify ? 'The card’s signature checks out' : 'The client does not check the card'}, then SendMessage creates a task in TASK_STATE_WORKING.`,
    s.task === 'input' ? (s.onInput === 'terminal' ? 'After 6 s the remote agent asks “Approve OEM parts or aftermarket?”; the client treats INPUT_REQUIRED as the end and marks the task failed.' : 'After 6 s the remote agent asks “Approve OEM parts or aftermarket?”; the client answers on the same taskId and work resumes for 8 s.') : s.task === 'long' ? 'The survey takes 42 s.' : 'The status comes back in 2 s.',
    r.delivery === 'poll' ? `Polling every 5 s costs ${r.polls} GetTask calls and sees the final state up to 5 s late.` : `With ${r.delivery === 'stream' ? 'streaming' : 'push notifications'} each state change arrives when it happens, with no polls.`,
    r.fellBack ? 'The card does not advertise the chosen delivery mode, so the client fell back to polling.' : '',
    s.task === 'quick' ? 'For a single stateless lookup, an API or MCP tool would be simpler than delegating.' : '',
  ].filter(Boolean).join(' ')),
  missions: {
    input: ({ state, result }) => state.task === 'input' && result.passedInput && result.end === 'COMPLETED',
    nopoll: ({ state, result }) => state.task === 'long' && result.end === 'COMPLETED' && result.polls === 0,
    reject: ({ state, result }) => !state.signed && state.verify && result.end === 'rejected',
  },
});
