/** KYC agent decision record: 3 million decisions a year; an inspector samples disputed cases from five years. */
import { type Flags } from '@/shared/flags';

export type AuditStore = 'mutable' | 'append' | 'worm';
export type Retention = '90d' | '1y' | '5y';
export type PiiHandling = 'raw' | 'masked' | 'token';
export const AUDIT_FIELDS: readonly (readonly [string, string, string])[] = [
  ['input', 'Input: document hash and extracted fields', 'What did it see?'], ['model', 'Model and version', 'Which model ran?'],
  ['prompt', 'Prompt and config version', 'Which instructions?'], ['grounds', 'Policy clauses and documents used', 'Which rule applied?'],
  ['tools', 'Tool calls and results', 'What did it check?'], ['decision', 'Decision and reason codes', 'What and why?'],
  ['human', 'Reviewer, override and reason', 'Who signed off?'], ['time', 'Timestamps', 'When?'],
];
export const AUDIT_FIELD_KEYS = AUDIT_FIELDS.map(([k]) => k);
const AVAILABILITY: Readonly<Record<Retention, number>> = { '90d': 0.1, '1y': 0.45, '5y': 1 };
const DECISIONS_PER_YEAR = 3e6;

export interface AuditTrailState { readonly fields: Flags; readonly store: AuditStore; readonly retention: Retention; readonly pii: PiiHandling }
export interface AuditTrailResult { readonly answered: number; readonly available: number; readonly tamperEvident: boolean; readonly recordKb: number; readonly gbPerYear: number; readonly unanswered: readonly string[] }

export function simulateAuditTrail(s: AuditTrailState): AuditTrailResult {
  const answered = AUDIT_FIELD_KEYS.filter((k) => s.fields[k]).length;
  const recordKb = 0.2 + 0.5 * answered + (s.pii === 'raw' ? 0 : 0.1);
  return {
    answered, available: AVAILABILITY[s.retention], tamperEvident: s.store !== 'mutable', recordKb,
    gbPerYear: ((recordKb * DECISIONS_PER_YEAR) / 1e6) * (s.store === 'worm' ? 1.2 : 1),
    unanswered: AUDIT_FIELDS.filter(([k]) => !s.fields[k]).map(([, , q]) => q),
  };
}
