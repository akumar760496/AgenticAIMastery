import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent } from '@/shared/format';
import { simulateAstContext, type AstContextResult, type AstContextState } from '../simulators/astContext';

const st = (mode: AstContextState['mode'], loadCallers: boolean, reparse: boolean): AstContextState => ({ mode, fileLines: 3000, loadCallers, reparse });

export const astContextPlayground = definePlayground<AstContextState, AstContextResult>({
  techniqueId: 'ast',
  title: 'Issue: “Tax is wrong on invoices above INR 1 lakh”',
  intro: 'The fault is in Invoice.apply_tax (16 lines). Its callers are Invoice.total() in billing.py and to_csv() in export.py (20 lines each). The fix changes rounding, so both callers must be checked.',
  controls: [
    { kind: 'select', key: 'mode', label: 'How the agent loads code', options: [{ value: 'file', label: 'Read the whole billing.py' }, { value: 'grep', label: 'grep “tax” across the repo (±10 lines)' }, { value: 'ast', label: 'Repo map + syntax tree: load the function node' }] },
    { kind: 'steps', key: 'fileLines', label: 'Size of billing.py', values: Array.from({ length: 56 }, (_, i) => 500 + i * 100), format: (v) => `${formatCount(v)} lines` },
    { kind: 'toggle', key: 'loadCallers', label: 'Also load callers (find-references)', isEnabled: (s) => s.mode === 'ast' },
    { kind: 'toggle', key: 'reparse', label: 'Re-parse the edit before running tests' },
  ],
  presets: {
    start: { state: st('file', true, false), expected: { tokens: 30000, bothCallers: false } },
    grep: { state: st('grep', true, false), expected: { loadedLines: 798, tokens: 7980, bothCallers: true } },
    ast: { state: st('ast', true, true), expected: { loadedLines: 56, tokens: 560, precision: 1, bothCallers: true } },
    narrow: { state: st('ast', false, true), expected: { tokens: 160, precision: 1, bothCallers: false } },
  },
  initialPreset: 'start',
  simulate: simulateAstContext,
  outputs: [
    { kind: 'meter', label: 'Share of a 128k context window', value: (r) => r.windowShare, detail: (r) => `= ${formatCount(r.tokens)} tokens (${formatCount(r.loadedLines)} lines × 10)`, emphasis: (r) => (r.windowShare > 0.2 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Relevant share of what was loaded', value: (r) => r.precision, detail: (r) => `= ${r.relevantLines} relevant lines ÷ ${formatCount(r.loadedLines)} loaded`, emphasis: (r) => (r.precision < 0.5 ? 'warn' : 'normal') },
    { kind: 'check', label: 'Both callers seen', value: (r) => r.bothCallers },
    { kind: 'value', label: 'Test runs needed', value: (r) => String(r.testRuns), detail: (r) => (r.testRuns === 1 ? 'broken first edit caught instantly by re-parse' : 'broken first edit caught only by a failing test run') },
  ],
  verdict: (r, s) => (r.bothCallers
    ? { tone: s.reparse && r.windowShare < 0.05 ? 'ok' : 'mid', headline: 'Complete fix.', detail: r.windowShare < 0.05 ? 'Small context, both callers covered.' : 'Correct, but the context is noisy and costly.' }
    : { tone: 'no', headline: 'Incomplete fix.', detail: 'to_csv() still rounds the old way, so exported invoices stay wrong.' }),
  narrate: (r, s) => [
    `The agent loaded ${formatCount(r.loadedLines)} lines, about ${formatCount(r.tokens)} tokens, ${formatWholePercent(r.windowShare)} of the context window, and ${formatWholePercent(r.precision)} of it was relevant.`,
    s.mode === 'file' ? 'Reading the whole file costs more as the file grows, yet still misses the caller in export.py.' : s.mode === 'grep' ? 'Text search finds every mention of “tax”, including comments and tests, so the model wades through noise.' : r.bothCallers ? 'The syntax tree gave the exact function and find-references added its two callers.' : 'Loading only the function is lean, but the side effect in export.py is invisible.',
    s.reparse ? 'Re-parsing caught the missing bracket in the first edit at once.' : 'The first edit had a missing bracket; without re-parsing, it was only found when the test run failed.',
  ].join(' '),
  missions: {
    lean: ({ state, result }) => result.tokens < 1000 && result.bothCallers && state.reparse,
    trap: ({ result }) => result.tokens < 500 && !result.bothCallers,
    blowup: ({ state, result }) => state.mode === 'file' && result.windowShare >= 0.25,
  },
});
