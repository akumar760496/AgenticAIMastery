import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { flagsFrom } from '@/shared/flags';
import { formatFixed, formatWholePercent } from '@/shared/format';
import { AUDIT_FIELD_KEYS, AUDIT_FIELDS, simulateAuditTrail, type AuditTrailResult, type AuditTrailState } from '../simulators/auditTrail';

const ALL = flagsFrom(AUDIT_FIELD_KEYS, AUDIT_FIELD_KEYS);
const isDefensible = (r: AuditTrailResult) => r.answered === 8 && r.tamperEvident && r.available === 1;

export const auditTrailPlayground = definePlayground<AuditTrailState, AuditTrailResult>({
  techniqueId: 'audit',
  title: 'Design the KYC agent’s decision record',
  intro: '3 million decisions a year. An inspector samples disputed cases from the last five years and asks eight questions about each.',
  controls: [
    { kind: 'flagSet', key: 'fields', label: 'Each record holds', options: AUDIT_FIELDS.map(([value, label]) => ({ value, label })) },
    { kind: 'select', key: 'store', label: 'Storage', options: [{ value: 'mutable', label: 'Ordinary database table' }, { value: 'append', label: 'Append-only, hash-chained' }, { value: 'worm', label: 'Hash-chained, write-once retention' }] },
    { kind: 'select', key: 'retention', label: 'Kept for', options: [{ value: '90d', label: '90 days' }, { value: '1y', label: '1 year' }, { value: '5y', label: '5 years after the relationship ends' }] },
    { kind: 'select', key: 'pii', label: 'Personal data in records', options: [{ value: 'raw', label: 'Raw Aadhaar and PAN' }, { value: 'masked', label: 'Masked' }, { value: 'token', label: 'Tokenised' }] },
  ],
  presets: {
    start: { state: { fields: flagsFrom(AUDIT_FIELD_KEYS, ['decision', 'time']), store: 'mutable', retention: '90d', pii: 'raw' }, expected: { answered: 2, available: 0.1, tamperEvident: false } },
    full: { state: { fields: ALL, store: 'mutable', retention: '5y', pii: 'raw' }, expected: { answered: 8, available: 1, tamperEvident: false } },
    locked: { state: { fields: flagsFrom(AUDIT_FIELD_KEYS, ['decision', 'time', 'model', 'input']), store: 'worm', retention: '5y', pii: 'masked' }, expected: { answered: 4, tamperEvident: true } },
    short: { state: { fields: ALL, store: 'append', retention: '1y', pii: 'masked' }, expected: { answered: 8, available: 0.45, tamperEvident: true } },
  },
  initialPreset: 'start',
  simulate: simulateAuditTrail,
  outputs: [
    { kind: 'meter', label: 'Auditor questions answered', value: (r) => r.answered / 8, detail: (r) => `= ${r.answered} of 8`, emphasis: (r) => (r.answered < 8 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Sampled cases still on record', value: (r) => r.available, emphasis: (r) => (r.available < 1 ? 'warn' : 'normal') },
    { kind: 'check', label: 'Tamper-evident', value: (r) => r.tamperEvident },
    { kind: 'value', label: 'Record size · storage a year', value: (r) => `${formatFixed(r.recordKb, 1)} KB · ${formatFixed(r.gbPerYear, 1)} GB` },
  ],
  verdict: (r, s) => {
    const raw = s.pii === 'raw';
    if (isDefensible(r) && !raw) return { tone: 'ok', headline: 'Defensible.', detail: 'Every sampled decision can be replayed and trusted, with no raw identifiers.' };
    if (isDefensible(r)) return { tone: 'mid', headline: 'Defensible, but a liability.', detail: 'The log is now the largest store of raw Aadhaar numbers.' };
    if (r.answered === 8 && !r.tamperEvident) return { tone: 'no', headline: 'Complete but untrustworthy.', detail: 'Anyone with database access could have edited these records.' };
    return { tone: 'no', headline: 'Cannot explain decisions.', detail: r.unanswered.length ? `Unanswerable: ${r.unanswered.join(' ')}` : 'Too few sampled cases are still on record.' };
  },
  narrate: (r) => [
    `Each record answers ${r.answered} of the inspector’s 8 questions, and ${formatWholePercent(r.available)} of sampled cases are still on record.`,
    r.tamperEvident ? 'Records are hash-chained, so edits would show.' : 'Records sit in an ordinary table and could be edited unnoticed.',
    `Storage is about ${formatFixed(r.gbPerYear, 1)} GB a year, a small price.`,
  ].join(' '),
  missions: {
    full: ({ result }) => isDefensible(result),
    private: ({ state, result }) => isDefensible(result) && state.pii !== 'raw',
    edit: ({ result }) => result.answered === 8 && !result.tamperEvident,
  },
});
