import { definePlayground, type ListItem } from '@/domain/playground/PlaygroundDefinition';
import { formatRupees, joinWithAnd, pluralise } from '@/shared/format';
import { GENUINE_COUNT, INJECTED_COUNT, simulateZeroTrust, type GatedCall, type ZeroTrustResult, type ZeroTrustState } from '../simulators/zeroTrustTools';

const LIMITS = Array.from({ length: 11 }, (_, i) => i * 5000);

function view(c: GatedCall): Pick<ListItem, 'status' | 'tone'> {
  if (c.decision === 'deny') return { status: 'denied', tone: 'ok' };
  if (c.decision === 'ask') return { status: c.call.injected ? 'asked: rejected' : 'asked: approved', tone: 'human' };
  return c.call.injected ? { status: 'ran: harmful', tone: 'no' } : { status: 'ran', tone: 'ok' };
}

export const zeroTrustPlayground = definePlayground<ZeroTrustState, ZeroTrustResult>({
  techniqueId: 'zt',
  title: 'Runtime policy',
  intro: 'Calls 5–8 were planted by an injected email the agent read.',
  controls: [
    { kind: 'select', key: 'defaultRule', label: 'Tools not in the policy', options: [{ value: 'allow', label: 'Allow by default' }, { value: 'deny', label: 'Deny by default' }] },
    { kind: 'toggle', key: 'scopeEmail', label: 'Email only to the customer on the ticket' },
    { kind: 'choice', key: 'credential', label: 'Credential', options: [{ value: 'admin', label: 'Shared admin key' }, { value: 'task', label: 'Task-scoped token, 15 min' }] },
    { kind: 'steps', key: 'approvalLimit', label: 'Refunds above this need a supervisor', values: LIMITS, format: formatRupees },
  ],
  presets: {
    start: { state: { defaultRule: 'allow', scopeEmail: false, credential: 'admin', approvalLimit: 50000 }, expected: { harmfulActions: 4, approvalPrompts: 0, genuineCompleted: 4 } },
    zt: { state: { defaultRule: 'deny', scopeEmail: true, credential: 'task', approvalLimit: 10000 }, expected: { harmfulActions: 0, approvalPrompts: 2, genuineCompleted: 4 } },
    askall: { state: { defaultRule: 'deny', scopeEmail: true, credential: 'task', approvalLimit: 0 }, expected: { harmfulActions: 0, approvalPrompts: 3, genuineCompleted: 4 } },
  },
  initialPreset: 'start',
  simulate: simulateZeroTrust,
  outputs: [
    { kind: 'meter', label: 'Harmful actions executed', value: (r) => r.harmfulActions / INJECTED_COUNT, detail: (r) => `= ${r.harmfulActions} of ${INJECTED_COUNT} injected calls ran`, emphasis: (r) => (r.harmfulActions ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Legitimate work completed', value: (r) => r.genuineCompleted / GENUINE_COUNT, detail: (r) => `= ${r.genuineCompleted} of ${GENUINE_COUNT} legitimate calls done` },
    { kind: 'value', label: 'Approval prompts for the supervisor', value: (r) => String(r.approvalPrompts) },
    { kind: 'value', label: 'Policy check per call', value: () => '≈ 2 ms' },
    {
      kind: 'itemList', title: 'Eight tool calls the agent attempts',
      items: (r) => r.calls.map((c, i) => ({ label: `#${i + 1}${c.call.injected ? ' · injected' : ''}`, text: c.call.name, ...view(c), detail: c.reason, flagged: c.harmful })),
    },
    { kind: 'table', columns: ['#', 'Tool', 'Decision'], rows: (r) => r.calls.map((c, i) => [String(i + 1), c.call.name.split('(')[0] ?? c.call.name, c.decision === 'ask' ? 'ask_human' : c.decision]) },
  ],
  verdict: (r) => {
    if (r.harmfulActions) return { tone: 'no', headline: `${r.harmfulActions} harmful ${pluralise(r.harmfulActions, 'action')} ran.`, detail: 'The injection turned into real side effects.' };
    return r.approvalPrompts > 2
      ? { tone: 'mid', headline: 'No harmful action ran.', detail: `But ${r.approvalPrompts} approval prompts per task invites rubber-stamping.` }
      : { tone: 'ok', headline: 'No harmful action ran.', detail: 'The injection was contained at the action layer.' };
  },
  narrate: (r, s) => {
    const parts = [`The injected email made the agent attempt four extra calls. ${r.harmfulActions ? `${r.harmfulActions} of them ran (${pluralise(r.harmfulIds.length, 'call')} ${joinWithAnd(r.harmfulIds.map(String))}).` : 'None of them ran.'}`];
    parts.push(s.defaultRule === 'allow' ? 'Allowing unknown tools by default let export_customers run, although nobody ever approved that tool.' : 'Deny by default refused export_customers because it isn’t in the policy.');
    parts.push(s.credential === 'admin' ? 'The shared admin key can read any customer, so the cross-customer read succeeded.' : 'The task-scoped token only covers this ticket’s customer, so reading C-5120 failed.');
    if (!s.scopeEmail) parts.push('Emails can go anywhere, so the statement went to an outside mailbox.');
    parts.push(r.approvalPrompts ? `${r.approvalPrompts} ${pluralise(r.approvalPrompts, 'refund')} waited for the supervisor, who approved the genuine ones and rejected any injected one.` : 'No refund needed approval.');
    if (r.approvalPrompts > 2) parts.push('Asking about routine small refunds creates approval fatigue.');
    return parts.join(' ');
  },
  missions: {
    safe: ({ result }) => result.harmfulActions === 0,
    lean: ({ result }) => result.harmfulActions === 0 && result.approvalPrompts === 1,
    key: ({ result }) => result.harmfulActions === 1 && result.harmfulIds[0] === 7,
  },
});
