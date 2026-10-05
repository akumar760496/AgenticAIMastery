import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount } from '@/shared/format';
import { simulateIncident, type IncidentResult, type IncidentState } from '../simulators/incidentResponse';

const inr = (v: number) => `₹${formatCount(Math.round(v))}`;

export const incidentResponsePlayground = definePlayground<IncidentState, IncidentResult>({
  techniqueId: 'incident',
  title: 'Chukta Pay’s duplicate refunds (fictional)',
  intro: 'Refund-agent prompt v8 ships at 10:00 and pays about 40 duplicate refunds an hour, averaging ₹1,500: ₹1,000 a minute. Complaints take about 4 hours to reach on-call; the alert fires in 12 minutes. A live hotfix takes 40 minutes and stops only 75%; the kill switch takes 5 minutes.',
  controls: [
    { kind: 'select', key: 'detection', label: 'Detection', options: [{ value: 'complaints', label: 'Merchant complaints only' }, { value: 'anomaly', label: 'Alert on refund-rate anomaly' }] },
    { kind: 'select', key: 'response', label: 'Response', options: [{ value: 'hotfix', label: 'Hot-fix the prompt live' }, { value: 'kill', label: 'Kill switch, then roll back to v7' }] },
    { kind: 'select', key: 'traces', label: 'Trace capture', options: [{ value: 'logs', label: 'Logs only' }, { value: 'full', label: 'Full traces with tool responses' }] },
    { kind: 'toggle', key: 'addEvalCase', label: 'Add the failing case to the eval set' },
  ],
  presets: {
    start: { state: { detection: 'complaints', response: 'hotfix', traces: 'logs', addEvalCase: false }, expected: { detectMin: 240, lostInr: 570000, rootCause: false, recurrencePct: 60 } },
    alert: { state: { detection: 'anomaly', response: 'hotfix', traces: 'logs', addEvalCase: false }, expected: { detectMin: 12, lostInr: 399000 } },
    kill: { state: { detection: 'anomaly', response: 'kill', traces: 'logs', addEvalCase: false }, expected: { containMin: 5, lostInr: 17000, recurrencePct: 60 } },
    full: { state: { detection: 'anomaly', response: 'kill', traces: 'full', addEvalCase: true }, expected: { lostInr: 17000, rootCause: true, recurrencePct: 5 } },
  },
  initialPreset: 'start',
  simulate: simulateIncident,
  outputs: [
    { kind: 'value', label: 'Time to detect', value: (r) => (r.detectMin >= 60 ? `${r.detectMin / 60} h` : `${r.detectMin} min`) },
    { kind: 'value', label: 'Time to contain', value: (r) => (r.containMin === null ? 'not contained that day' : `${r.containMin} min after detection`) },
    { kind: 'value', label: 'Lost in duplicate refunds', value: (r) => inr(r.lostInr), emphasis: (r) => (r.lostInr > 30000 ? 'warn' : 'normal') },
    { kind: 'check', label: 'Root cause found', value: (r) => r.rootCause },
    { kind: 'value', label: 'Recurrence risk', value: (r) => `${r.recurrencePct}%`, emphasis: (r) => (r.recurrencePct > 5 ? 'warn' : 'normal') },
  ],
  verdict: (r) => {
    if (r.lostInr <= 30000 && r.rootCause && r.recurrencePct <= 5) return { tone: 'ok', headline: 'Contained, understood, prevented.', detail: 'Fast detection, a kill switch, replayable traces and a regression case.' };
    if (r.lostInr <= 30000) return { tone: 'mid', headline: 'Contained, but not understood.', detail: 'Without recorded tool responses the cause stays a guess.' };
    return { tone: 'no', headline: 'The money keeps leaking.', detail: 'Detect faster and stop the agent before fixing it.' };
  },
  narrate: (r, s) => [
    s.detection === 'anomaly' ? 'The refund-rate alert fires at 10:12, 12 minutes after v8 went live.' : 'Nobody notices until merchants complain about double debits, about 4 hours after v8 went live.',
    s.response === 'kill' ? 'The on-call engineer flips the kill switch 5 minutes later, so refunds queue for people, then rolls back to v7.' : r.rootCause ? 'A live prompt hotfix takes 40 minutes and stops 75% of duplicates; a replay-tested fix stops the rest at 60 minutes.' : 'A live prompt hotfix takes 40 minutes and stops only 75% of duplicates; the rest keep leaking for the day.',
    `In all, ${inr(r.lostInr)} goes out in duplicate refunds.`,
    r.rootCause ? 'Replaying the trace with its recorded PENDING response reproduces the double refund, so the cause is clear.' : 'With logs only, a live re-run gets SUCCESS and never double-refunds, so the cause stays a guess.',
    s.addEvalCase ? (r.rootCause ? 'The trace is now an eval case, so no release that pays twice can ship again.' : 'An eval case was added, but without the recorded tool response it passes even on v8.') : 'No eval case was added, so a future prompt could reintroduce the bug unnoticed.',
  ].join(' '),
  missions: {
    contain: ({ result }) => result.lostInr <= 30000,
    replay: ({ result }) => result.rootCause && result.recurrencePct <= 5,
    slow: ({ state, result }) => state.detection === 'complaints' && state.response === 'kill' && result.lostInr <= 300000,
  },
});
