/** The lethal trifecta: private data, untrusted input and an outbound channel, plus unconfirmed actions. */
export const CAPABILITIES = [
  { key: 'data', label: 'Reads the customer’s statements (private data)', weight: 20 },
  { key: 'pdfs', label: 'Reads uploaded PDFs (untrusted)', weight: 20 },
  { key: 'emails', label: 'Reads forwarded emails (untrusted)', weight: 15 },
  { key: 'images', label: 'Chat renders images (outbound)', weight: 5 },
  { key: 'email', label: 'Email tool (outbound)', weight: 15 },
  { key: 'transfer', label: 'Transfer to saved payees (action)', weight: 25 },
] as const;
export const GATES = [
  { key: 'approve', label: 'Human approval on outbound email' }, { key: 'confirm', label: 'Customer confirms every transfer' },
  { key: 'separated', label: 'Separated reader for untrusted content' }, { key: 'scoped', label: 'Data scoped to the current customer' },
] as const;

export interface ThreatModelState {
  readonly data: boolean; readonly pdfs: boolean; readonly emails: boolean; readonly images: boolean; readonly email: boolean; readonly transfer: boolean;
  readonly approve: boolean; readonly confirm: boolean; readonly separated: boolean; readonly scoped: boolean;
}
export type RiskLevel = 'critical' | 'high' | 'low';
export interface ThreatModelResult { readonly trifectaPaths: number; readonly hijackPaths: number; readonly usefulness: number; readonly risks: readonly string[]; readonly level: RiskLevel; readonly blastRadius: number }

export function simulateThreatModel(s: ThreatModelState): ThreatModelResult {
  const untrusted = (s.pdfs ? 1 : 0) + (s.emails ? 1 : 0);
  const outbound = (s.images ? 1 : 0) + (s.email && !s.approve ? 1 : 0);
  const trifectaPaths = s.separated ? 0 : (s.data ? 1 : 0) * untrusted * outbound;
  const hijackPaths = s.separated ? 0 : s.transfer && !s.confirm ? untrusted : 0;
  const usefulness = CAPABILITIES.reduce((a, c) => a + (s[c.key] ? c.weight : 0), 0) - (s.approve && s.email ? 3 : 0) - (s.confirm && s.transfer ? 4 : 0) - (s.separated ? 5 : 0);
  const risks: string[] = [];
  if (untrusted) risks.push('LLM01 Prompt Injection', 'ASI01 Agent Goal Hijack');
  if (outbound || s.email) risks.push('LLM02 Sensitive Information Disclosure');
  if (s.transfer) risks.push('LLM06 Excessive Agency', 'ASI02 Tool Misuse', 'ASI03 Identity and Privilege Abuse');
  if (s.data && !s.scoped) risks.push('Table-wide data access');
  return { trifectaPaths, hijackPaths, usefulness, risks, level: trifectaPaths > 0 ? 'critical' : hijackPaths > 0 ? 'high' : 'low', blastRadius: s.scoped ? 1 : 500 };
}
