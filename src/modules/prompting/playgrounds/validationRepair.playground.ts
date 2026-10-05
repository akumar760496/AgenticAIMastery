import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatFixed, formatPercent, formatRupees, pluralise } from '@/shared/format';
import { simulateValidationRepair, type ValidationRepairResult, type ValidationRepairState } from '../simulators/validationRepair';

export const validationRepairPlayground = definePlayground<ValidationRepairState, ValidationRepairResult>({
  techniqueId: 'repair',
  title: 'Keep bad invoices out of the ledger',
  intro: 'Outputs already match the schema. 8% break a type check and 10% of the rest break a business rule, such as a total that does not match its items. Each model call costs ₹0.20.',
  controls: [
    { kind: 'toggle', key: 'rules', label: 'Validate business rules (GSTIN format, totals)' },
    { kind: 'steps', key: 'repairs', label: 'Repairs allowed', values: [0, 1, 2, 3], format: (v) => String(v) },
    { kind: 'select', key: 'feedback', label: 'Feedback on failure', options: [{ value: 'generic', label: '“That was wrong, try again”' }, { value: 'specific', label: 'The exact validation errors' }] },
    { kind: 'toggle', key: 'humanQueue', label: 'Send unrepairable records to a human queue' },
  ],
  presets: {
    start: { state: { rules: false, repairs: 0, feedback: 'generic', humanQueue: false }, expected: { silent: 0.092, callsPerRecord: 1 } },
    rules: { state: { rules: true, repairs: 0, feedback: 'generic', humanQueue: false }, expected: { silent: 0.005, dropped: 0.172 } },
    generic: { state: { rules: true, repairs: 2, feedback: 'generic', humanQueue: true }, expected: { clean: 0.92233, queued: 0.07267, callsPerRecord: 1.2838 } },
    specific: { state: { rules: true, repairs: 3, feedback: 'specific', humanQueue: true }, expected: { clean: 0.990356, queued: 0.004644, callsPerRecord: 1.23908 } },
  },
  initialPreset: 'start',
  simulate: simulateValidationRepair,
  outputs: [
    { kind: 'meter', label: 'Clean records', value: (r) => r.clean, detail: () => '= valid and correct by the rules', emphasis: (r) => (r.clean < 0.98 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Silent errors reaching the ledger', value: (r) => r.silent, emphasis: (r) => (r.silent > 0.01 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Human queue', value: (r) => formatPercent(r.queued, 1) },
    { kind: 'value', label: 'Dropped with an exception', value: (r) => formatPercent(r.dropped, 1), emphasis: (r) => (r.dropped > 0 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Model calls per record', value: (r) => formatFixed(r.callsPerRecord, 3), detail: (r) => `${formatRupees(r.rupeesPerRecord, 3)} a record` },
  ],
  verdict: (r) => (r.silent > 0.01
    ? { tone: 'no', headline: 'Bad records are reaching the ledger.', detail: 'Type checks alone let rule violations through.' }
    : r.dropped > 0 ? { tone: 'mid', headline: 'Records are being dropped.', detail: 'Failures raise an exception and disappear. Queue them for a human.' }
      : r.clean >= 0.98 ? { tone: 'ok', headline: 'Clean, and nothing lost.', detail: 'Specific errors repair most failures in one or two rounds.' }
        : { tone: 'mid', headline: 'Too many need a human.', detail: 'Specific feedback and one more repair would clear most of them.' }),
  narrate: (r, s) => [
    s.rules ? `Validators catch the ${formatPercent(r.firstFailure, 1)} of first outputs that break a type or a rule.` : `Only types are checked, so the ${formatPercent(r.silent, 1)} of outputs that break a business rule go straight into the ledger.`,
    s.repairs ? `${s.feedback === 'specific' ? 'Sending the exact error' : 'A generic “try again”'} with up to ${s.repairs} ${pluralise(s.repairs, 'repair')} leaves ${formatPercent(r.stillFailing, 1)} still failing.` : 'There are no repairs.',
    r.stillFailing > 0 ? (s.humanQueue ? 'Those go to a human queue.' : 'Those raise an exception and are dropped.') : '',
    `On average each record takes ${formatFixed(r.callsPerRecord, 2)} model calls.`,
  ].filter(Boolean).join(' '),
  missions: {
    silent: ({ result }) => result.silent < 0.01,
    clean: ({ result }) => result.clean >= 0.98 && result.callsPerRecord <= 1.25,
    queue: ({ state, result }) => state.humanQueue && state.rules && result.queued < 0.01 && result.dropped === 0,
  },
});
