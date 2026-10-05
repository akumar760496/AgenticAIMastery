/** Defences for a back-office screen agent: ~5% of pages carry injected instructions and some buttons move money. Illustrative. */
import { type Flags } from '@/shared/flags';

export const SAFETY_CONTROLS: readonly (readonly [string, string])[] = [
  ['sandbox', 'Isolated VM, no personal profile'], ['allow', 'Allowlist of domains'], ['vault', 'Credentials filled from a vault'],
  ['screen', 'Injection screening on observations'], ['confirm', 'Human confirmation of irreversible actions'], ['limits', 'Step and spend limits'], ['record', 'Record every session'],
];
export const SAFETY_CONTROL_KEYS = SAFETY_CONTROLS.map(([k]) => k);
const HARM_FACTOR: Readonly<Record<string, number>> = { sandbox: 0.6, allow: 0.4, screen: 0.5, confirm: 0.1, limits: 0.8 };

export interface ActionSafetyState { readonly controls: Flags }
export interface ActionSafetyResult { readonly harmPer1000: number; readonly completion: number; readonly confirmationsPerTask: number; readonly passwordsSeen: boolean; readonly recorded: boolean }

export function simulateActionSafety(s: ActionSafetyState): ActionSafetyResult {
  const on = (k: string) => s.controls[k] === true;
  const harmPer1000 = Object.entries(HARM_FACTOR).reduce((h, [k, f]) => h * (on(k) ? f : 1), 40);
  return { harmPer1000, completion: 0.9 - (on('allow') ? 0.02 : 0) - (on('screen') ? 0.01 : 0), confirmationsPerTask: on('confirm') ? 1.2 : 0, passwordsSeen: !on('vault'), recorded: on('record') };
}
