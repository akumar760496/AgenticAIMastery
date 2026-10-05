/** DPDP Act readiness for a digital lender's onboarding agent. Penalty bands are the Act's maximums in ₹ crore. */
import { enabledKeys, type Flags } from '@/shared/flags';

export interface DpdpObligation { readonly key: string; readonly label: string; readonly obligation: string; readonly bandCrore: number }
export const DPDP_OBLIGATIONS: readonly DpdpObligation[] = [
  { key: 'notice', label: 'Itemised notice in plain language', obligation: 'notice', bandCrore: 50 },
  { key: 'consent', label: 'Separate consent for each purpose', obligation: 'consent', bandCrore: 50 },
  { key: 'fields', label: 'Only needed fields; Aadhaar masked', obligation: 'minimisation', bandCrore: 50 },
  { key: 'vendor', label: 'Processor contract with the model vendor', obligation: 'security safeguards', bandCrore: 250 },
  { key: 'retention', label: 'Delete when the purpose ends', obligation: 'retention', bandCrore: 50 },
  { key: 'breach', label: 'Breach runbook: Board within 72 hours', obligation: 'breach reporting', bandCrore: 200 },
  { key: 'erasure', label: 'Erasure reaches every store', obligation: 'erasure', bandCrore: 50 },
];
export const DPDP_KEYS = DPDP_OBLIGATIONS.map((o) => o.key);

export interface DpdpState { readonly met: Flags }
export interface DpdpResult { readonly metCount: number; readonly gaps: readonly DpdpObligation[]; readonly bandCrore: number; readonly fieldsHeld: number; readonly storesErased: number }

export function simulateDpdp(s: DpdpState): DpdpResult {
  const met = new Set(enabledKeys(DPDP_KEYS, s.met));
  const gaps = DPDP_OBLIGATIONS.filter((o) => !met.has(o.key));
  return {
    metCount: met.size, gaps,
    bandCrore: gaps.reduce((m, g) => Math.max(m, g.bandCrore), 0),
    fieldsHeld: met.has('fields') ? 6 : 14,
    storesErased: met.has('erasure') ? 5 : 2,
  };
}
