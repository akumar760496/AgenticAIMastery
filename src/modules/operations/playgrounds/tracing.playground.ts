import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatWholePercent } from '@/shared/format';
import { FIXES, GROUPS, simulateTracing, type Fix, type Grouping, type TracingResult, type TracingState } from '../simulators/tracing';

const minutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`);

export const tracingPlayground = definePlayground<TracingState, TracingResult>({
  techniqueId: 'tracing',
  title: 'Accepted summaries fell from 94% to 86% at 02:00',
  intro: 'No deploy happened. An alert fired 12 minutes later. Diagnosis takes 8 min when traces show the cause, about an hour of digging when they do not.',
  controls: [
    { kind: 'select', key: 'spans', label: 'Spans record', options: [{ value: 'basic', label: 'Request model only' }, { value: 'full', label: 'Full GenAI attributes' }] },
    { kind: 'select', key: 'grouping', label: 'Group failed traces by', options: (Object.keys(GROUPS) as Grouping[]).map((k) => ({ value: k, label: GROUPS[k].title })) },
    { kind: 'select', key: 'fix', label: 'Fix', options: (Object.keys(FIXES) as Fix[]).map((k) => ({ value: k, label: k === 'none' ? 'None yet' : FIXES[k].label })) },
  ],
  presets: {
    start: { state: { spans: 'basic', grouping: 'none', fix: 'none' }, expected: { success: 0.86, causeFound: false, resolved: false } },
    guess: { state: { spans: 'basic', grouping: 'region', fix: 'restart' }, expected: { success: 0.86 } },
    found: { state: { spans: 'full', grouping: 'model', fix: 'none' }, expected: { causeFound: true, resolved: false } },
    pinned: { state: { spans: 'full', grouping: 'model', fix: 'pin' }, expected: { success: 0.94, mttrMin: 25 } },
  },
  initialPreset: 'start',
  simulate: simulateTracing,
  outputs: [
    { kind: 'table', columns: ['Group', 'Success', 'Traffic'], rows: (r) => r.rows.map(([n, s, t]) => [n, formatWholePercent(s), formatWholePercent(t)]) },
    { kind: 'check', label: 'Cause found', value: (r) => r.causeFound },
    { kind: 'meter', label: 'Success after the fix', value: (r) => r.success, emphasis: (r) => (r.success < 0.94 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Time to recover', value: (r) => (r.mttrMin === null ? 'not recovered' : minutes(r.mttrMin)), detail: (r) => (r.mttrMin === null ? '' : `12 to alert + ${r.diagnosisMin} to diagnose + the fix`) },
  ],
  verdict: (r) => (r.resolved
    ? { tone: 'ok', headline: 'Recovered.', detail: 'The traces named the snapshot that changed, and pinning the old one restored success.' }
    : r.causeFound ? { tone: 'mid', headline: 'Cause found, no fix yet.', detail: 'Pin the snapshot that still works.' } : { tone: 'no', headline: 'Still guessing.', detail: r.blind ? 'Spans only record the requested model, so every trace looks the same.' : 'Group by an attribute that actually changed.' }),
  narrate: (r, s) => [
    r.blind ? 'You grouped by the response model, but your spans only record the model you asked for, alpha-latest, so every trace looks the same.'
      : s.grouping === 'model' ? 'Grouped by gen_ai.response.model, the failures split cleanly: alpha-0712 still succeeds 94% of the time, the new alpha-0918 only 84%, and it now serves 80% of traffic.'
        : s.grouping === 'none' ? 'Without grouping you only know the average fell to 86%.' : `Grouping by ${GROUPS[s.grouping].title.toLowerCase()} shows every group near 86%, so it is not the cause.`,
    s.fix === 'none' ? 'No fix yet.' : s.fix === 'pin' ? 'Pinning alpha-0712 takes 5 minutes and restores 94%.' : s.fix === 'fallback' ? 'Provider Beta recovers some ground at 91%, but your prompts were never evaluated on it.' : `${FIXES[s.fix].label} changes nothing, because the cause is on the provider’s side.`,
    r.mttrMin !== null ? `Recovery took ${minutes(r.mttrMin)} end to end.` : '',
  ].filter(Boolean).join(' '),
  missions: {
    find: ({ result }) => result.causeFound,
    restore: ({ result }) => result.success >= 0.94,
    fast: ({ result }) => result.resolved && (result.mttrMin ?? 999) <= 30,
  },
});
