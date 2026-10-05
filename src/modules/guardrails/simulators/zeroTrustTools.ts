/** Zero-trust tool gate: eight tool calls (four planted by an injected email) against a runtime policy. */
export type DefaultRule = 'allow' | 'deny';
export type Credential = 'admin' | 'task';
export type ToolKind = 'read' | 'email' | 'refund' | 'unlisted';

export interface ToolCall {
  readonly name: string;
  readonly kind: ToolKind;
  readonly injected: boolean;
  readonly ownCustomer?: boolean;
  readonly externalRecipient?: boolean;
  readonly amount?: number;
}

export const TOOL_CALLS: readonly ToolCall[] = [
  { name: 'read_orders(ticket #4471)', kind: 'read', injected: false, ownCustomer: true },
  { name: 'send_email(to: ticket customer)', kind: 'email', injected: false, externalRecipient: false },
  { name: 'refund(INR 4,500)', kind: 'refund', injected: false, amount: 4500 },
  { name: 'refund(INR 18,000)', kind: 'refund', injected: false, amount: 18000 },
  { name: 'send_email(to: backup@mailbox.example)', kind: 'email', injected: true, externalRecipient: true },
  { name: 'export_customers(all)', kind: 'unlisted', injected: true },
  { name: 'read_orders(customer C-5120)', kind: 'read', injected: true, ownCustomer: false },
  { name: 'refund(INR 45,000 to a new account)', kind: 'refund', injected: true, amount: 45000 },
];
export const INJECTED_COUNT = TOOL_CALLS.filter((c) => c.injected).length;
export const GENUINE_COUNT = TOOL_CALLS.length - INJECTED_COUNT;

export interface ZeroTrustState {
  readonly defaultRule: DefaultRule;
  readonly scopeEmail: boolean;
  readonly credential: Credential;
  /** Refunds above this amount (INR) need a supervisor. */
  readonly approvalLimit: number;
}

export type GateDecision = 'allow' | 'deny' | 'ask';
export interface GatedCall { readonly call: ToolCall; readonly decision: GateDecision; readonly reason: string; readonly harmful: boolean; readonly completed: boolean }

export interface ZeroTrustResult {
  readonly calls: readonly GatedCall[];
  readonly harmfulActions: number;
  readonly harmfulIds: readonly number[];
  readonly approvalPrompts: number;
  readonly genuineCompleted: number;
}

const formatInr = (v: number) => `INR ${Math.round(v).toLocaleString('en-IN')}`;

function decide(call: ToolCall, s: ZeroTrustState): { decision: GateDecision; reason: string } {
  switch (call.kind) {
    case 'read':
      if (s.credential === 'task' && !call.ownCustomer) return { decision: 'deny', reason: 'token covers this customer only' };
      return { decision: 'allow', reason: s.credential === 'admin' ? 'admin key can read everything' : 'within token scope' };
    case 'email':
      if (s.scopeEmail && call.externalRecipient) return { decision: 'deny', reason: 'recipient is not the ticket customer' };
      return { decision: 'allow', reason: s.scopeEmail ? 'recipient matches the ticket' : 'any recipient allowed' };
    case 'refund':
      return (call.amount ?? 0) > s.approvalLimit
        ? { decision: 'ask', reason: `above ${formatInr(s.approvalLimit)}` }
        : { decision: 'allow', reason: `at or below ${formatInr(s.approvalLimit)}` };
    case 'unlisted':
      return { decision: s.defaultRule, reason: `not in the policy: ${s.defaultRule} by default` };
  }
}

export function simulateZeroTrust(state: ZeroTrustState): ZeroTrustResult {
  // A supervisor approves genuine refunds and rejects injected ones.
  const calls = TOOL_CALLS.map((call): GatedCall => {
    const { decision, reason } = decide(call, state);
    return { call, decision, reason, harmful: decision === 'allow' && call.injected, completed: !call.injected && decision !== 'deny' };
  });
  const harmfulIds = calls.flatMap((c, i) => (c.harmful ? [i + 1] : []));
  return {
    calls,
    harmfulActions: harmfulIds.length,
    harmfulIds,
    approvalPrompts: calls.filter((c) => c.decision === 'ask').length,
    genuineCompleted: calls.filter((c) => c.completed).length,
  };
}
