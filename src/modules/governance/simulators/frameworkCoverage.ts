/** One control library mapped onto NIST AI RMF, ISO/IEC 42001, RBI FREE-AI and EU AI Act high-risk duties (simplified). */
import { type Flags } from '@/shared/flags';

export const FRAMEWORK_CONTROLS: readonly (readonly [string, string])[] = [
  ['policy', 'AI policy approved by the board'], ['inventory', 'AI inventory and risk tiers'], ['impact', 'Impact assessment per use case'],
  ['evals', 'Pre-release eval suite'], ['redteam', 'Red teaming'], ['monitor', 'Production monitoring'], ['incident', 'Incident runbook'],
  ['vendor', 'Third-party AI due diligence'], ['training', 'Staff AI training'], ['docs', 'Technical documentation and system cards'], ['review', 'Internal audit and management review'],
];
export const FRAMEWORK_CONTROL_KEYS = FRAMEWORK_CONTROLS.map(([k]) => k);
const NIST_FUNCTIONS: Readonly<Record<string, readonly string[]>> = {
  policy: ['Govern'], inventory: ['Govern', 'Map'], impact: ['Map'], evals: ['Measure'], redteam: ['Measure'], monitor: ['Measure', 'Manage'],
  incident: ['Manage'], vendor: ['Govern', 'Manage'], training: ['Govern'], docs: ['Govern'], review: ['Govern'],
};
const REQUIRED: Readonly<Record<'iso' | 'rbi' | 'eu', readonly string[]>> = {
  iso: ['policy', 'inventory', 'impact', 'training', 'evals', 'monitor', 'vendor', 'review', 'incident'],
  rbi: ['policy', 'inventory', 'evals', 'review', 'incident', 'vendor', 'training'],
  eu: ['impact', 'evals', 'redteam', 'monitor', 'incident', 'docs', 'policy'],
};

export interface FrameworkState { readonly controls: Flags }
export interface FrameworkResult { readonly nist: number; readonly iso: number; readonly rbi: number; readonly eu: number; readonly built: number; readonly complete: boolean }

export function simulateFrameworks(s: FrameworkState): FrameworkResult {
  const on = FRAMEWORK_CONTROL_KEYS.filter((k) => s.controls[k]);
  const functions = new Set(on.flatMap((k) => NIST_FUNCTIONS[k] ?? []));
  const coverage = (list: readonly string[]) => list.filter((k) => s.controls[k]).length / list.length;
  const r = { nist: functions.size / 4, iso: coverage(REQUIRED.iso), rbi: coverage(REQUIRED.rbi), eu: coverage(REQUIRED.eu) };
  return { ...r, built: on.length, complete: r.nist === 1 && r.iso === 1 && r.rbi === 1 && r.eu === 1 };
}
