/** Indirect prompt injection: five attacks against six layered defences, with the usefulness each defence costs. */
export type Attack = 'direct' | 'doc' | 'name' | 'exfil' | 'poison';
export type Defence = 'classifier' | 'spotlight' | 'separation' | 'confirm' | 'egress' | 'pin';
export const ATTACKS: Readonly<Record<Attack, { readonly label: string; readonly baseline: number }>> = {
  direct: { label: 'Direct jailbreak in the chat', baseline: 0.35 }, doc: { label: 'Hidden instruction in a statement PDF', baseline: 0.62 },
  name: { label: 'Payee name that carries an instruction', baseline: 0.48 }, exfil: { label: 'Injected markdown image that leaks data', baseline: 0.55 },
  poison: { label: 'Poisoned MCP tool description', baseline: 0.7 },
};
export const DEFENCES: readonly { readonly key: Defence; readonly label: string; readonly cost: number; readonly factor: Readonly<Record<Attack, number>> }[] = [
  { key: 'classifier', label: 'Input classifier on chat and documents', cost: 2, factor: { direct: 0.25, doc: 0.6, name: 0.8, exfil: 0.7, poison: 1 } },
  { key: 'spotlight', label: 'Spotlighting: mark untrusted text as data', cost: 1, factor: { direct: 1, doc: 0.5, name: 0.6, exfil: 0.6, poison: 0.9 } },
  { key: 'separation', label: 'Privilege separation: quarantined reader', cost: 5, factor: { direct: 1, doc: 0.08, name: 0.1, exfil: 0.15, poison: 0.9 } },
  { key: 'confirm', label: 'Customer confirms payees and transfers', cost: 4, factor: { direct: 0.3, doc: 0.2, name: 0.2, exfil: 1, poison: 0.3 } },
  { key: 'egress', label: 'Egress allowlist: no untrusted images or links', cost: 1, factor: { direct: 1, doc: 1, name: 1, exfil: 0.02, poison: 0.4 } },
  { key: 'pin', label: 'Pin and review MCP tool descriptions', cost: 1, factor: { direct: 1, doc: 1, name: 1, exfil: 1, poison: 0.05 } },
];
const BASE_TASK_SUCCESS = 92;

export interface IndirectState { readonly attack: Attack; readonly defences: Readonly<Record<Defence, boolean>> }
export interface IndirectResult { readonly success: Readonly<Record<Attack, number>>; readonly chosen: number; readonly average: number; readonly taskSuccess: number; readonly active: readonly string[] }

export function simulateIndirect(s: IndirectState): IndirectResult {
  const success = {} as Record<Attack, number>;
  for (const a of Object.keys(ATTACKS) as Attack[]) success[a] = DEFENCES.reduce((v, d) => (s.defences[d.key] ? v * d.factor[a] : v), ATTACKS[a].baseline);
  return {
    success, chosen: success[s.attack],
    average: Object.values(success).reduce((a, b) => a + b, 0) / 5,
    taskSuccess: BASE_TASK_SUCCESS - DEFENCES.reduce((a, d) => a + (s.defences[d.key] ? d.cost : 0), 0),
    active: DEFENCES.filter((d) => s.defences[d.key]).map((d) => d.label),
  };
}
