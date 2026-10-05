import { definePlayground, type ControlSpec } from '@/domain/playground/PlaygroundDefinition';
import { formatCount } from '@/shared/format';
import { CALLS, simulateParallel, type ParallelResult, type ParallelState } from '../simulators/parallelCalls';

const LATENCIES = Array.from({ length: 20 }, (_, i) => (i + 1) * 100);
const ms = (v: number) => `${formatCount(v)} ms`;
const base: ParallelState = { lat0: 600, lat1: 700, lat2: 900, lat3: 1200, lat4: 400, dep1: 'none', dep2: 'none', dep3: 'none', dep4: 'all', parallel: false, bureauTimesOut: false, catchErrors: false };
const depOptions = (i: number) => [{ value: 'none', label: 'none' }, ...CALLS.slice(0, i).map((c, j) => ({ value: String(j), label: c.short })), ...(i >= 2 ? [{ value: 'all', label: 'all before it' }] : [])];
const latKeys = ['lat0', 'lat1', 'lat2', 'lat3', 'lat4'] as const;
const depKeys = [null, 'dep1', 'dep2', 'dep3', 'dep4'] as const;

const callControls: ControlSpec<ParallelState>[] = CALLS.flatMap((c, i): ControlSpec<ParallelState>[] => {
  const latency: ControlSpec<ParallelState> = { kind: 'steps', key: latKeys[i]!, label: `${c.name} latency`, values: LATENCIES, format: ms };
  const depKey = depKeys[i];
  return depKey ? [latency, { kind: 'select', key: depKey, label: `${c.name} depends on`, options: depOptions(i) }] : [latency];
});

export const parallelCallsPlayground = definePlayground<ParallelState, ParallelResult>({
  techniqueId: 'parallel',
  title: 'One turn, five calls: open a demat account after KYC',
  controls: [
    ...callControls,
    { kind: 'toggle', key: 'parallel', label: 'Run independent calls in parallel' },
    { kind: 'toggle', key: 'bureauTimesOut', label: 'bureau_pull times out' },
    { kind: 'toggle', key: 'catchErrors', label: 'Catch errors per call and return is_error results' },
  ],
  presets: {
    start: { state: base, expected: { wallMs: 3800, criticalPath: 5 } },
    par: { state: { ...base, parallel: true }, expected: { wallMs: 1600, criticalPath: 2 } },
    fail: { state: { ...base, parallel: true, bureauTimesOut: true }, expected: { returned: 0 } },
    chain: { state: { ...base, parallel: true, dep1: '0', dep2: '1' }, expected: { wallMs: 2600, criticalPath: 4 } },
  },
  initialPreset: 'start',
  simulate: simulateParallel,
  outputs: [
    { kind: 'table', columns: ['Call', 'Start', 'End'], rows: (r) => r.timings.map((t, i) => [CALLS[i]!.name, t.skipped ? '–' : ms(t.start), t.skipped ? 'skipped' : t.failed ? 'timeout' : ms(t.end)]) },
    { kind: 'value', label: 'Wall-clock time', value: (r) => ms(r.wallMs), detail: (r) => `sum of latencies: ${ms(r.sumMs)} → ${(r.sumMs / r.wallMs).toFixed(2)}× faster` },
    { kind: 'value', label: 'Critical path', value: (r) => `${r.criticalPath} call${r.criticalPath === 1 ? '' : 's'}` },
    { kind: 'value', label: 'Results returned', value: (r) => `${r.returned} of 5`, emphasis: (r) => (r.returned < 5 ? 'warn' : 'normal') },
  ],
  verdict: (r, s) => {
    if (r.returned < 5) return { tone: 'no', headline: 'Request rejected.', detail: 'Five tool_use ids have no result, so the next API call fails; catch errors per call.' };
    return s.parallel && r.wallMs < r.sumMs ? { tone: 'ok', headline: `${formatCount(r.sumMs - r.wallMs)} ms saved.`, detail: 'Wall-clock time equals the critical path, not the sum.' } : { tone: 'mid', headline: 'Sequential.', detail: 'Every call waits for the previous one, even the independent lookups.' };
  },
  narrate: (r, s) => [
    s.parallel ? 'The independent calls start together at 0 ms; each dependent call starts when its slowest input finishes.' : 'Each call waits for the one before it, although the four lookups do not need each other.',
    s.bureauTimesOut ? (s.catchErrors ? `bureau_pull times out and returns is_error${r.skipped ? `; ${r.skipped} dependent call${r.skipped > 1 ? 's are' : ' is'} skipped with “Not executed”` : ''}, so the model still sees all 5 results.` : 'bureau_pull times out and its exception propagates, so no results are returned and the request fails with unanswered call ids.') : '',
    `Wall-clock ${ms(r.wallMs)} against ${ms(r.sumMs)} for the sum; the critical path is ${r.criticalPath} calls long.`,
  ].filter(Boolean).join(' '),
  missions: {
    fast: ({ state, result }) => state.parallel && result.wallMs < 1000 && result.returned === 5,
    allfive: ({ state, result }) => state.bureauTimesOut && result.returned === 5,
    crit3: ({ state, result }) => state.parallel && result.criticalPath === 3 && !state.bureauTimesOut,
  },
});
