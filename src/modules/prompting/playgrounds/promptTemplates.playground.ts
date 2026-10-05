import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatPercent, formatWholePercent } from '@/shared/format';
import { simulatePromptTemplates, type PromptTemplatesResult, type PromptTemplatesState } from '../simulators/promptTemplates';

const base: PromptTemplatesState = { strict: true, variables: 'end', wrap: true, cases: 300, ci: true };
const isSafe = (r: PromptTemplatesResult, s: PromptTemplatesState) => r.catchChance >= 0.95 && r.cacheHit >= 0.8 && s.strict && s.wrap;

export const promptTemplatesPlayground = definePlayground<PromptTemplatesState, PromptTemplatesResult>({
  techniqueId: 'templates',
  title: 'Ship a prompt change safely',
  intro: 'A policy edit is about to ship. Unknown to the author, it breaks refunds for annual plans, an intent in 3% of traffic.',
  controls: [
    { kind: 'toggle', key: 'strict', label: 'Jinja2 with StrictUndefined instead of Python f-strings' },
    { kind: 'select', key: 'variables', label: 'Variables go', options: [{ value: 'top', label: 'At the top' }, { value: 'end', label: 'At the end' }] },
    { kind: 'select', key: 'cases', label: 'Golden cases', options: [{ value: '0', label: 'None' }, { value: '20', label: '20' }, { value: '100', label: '100' }, { value: '300', label: '300' }] },
    { kind: 'toggle', key: 'wrap', label: 'Wrap and escape untrusted ticket text' },
    { kind: 'toggle', key: 'ci', label: 'Run the suite in CI and block the merge on failure' },
  ],
  presets: {
    start: { state: { strict: false, variables: 'top', wrap: false, cases: 0, ci: false }, expected: { catchChance: 0, blankVariableShare: 0.04, cacheHit: 0 } },
    small: { state: { ...base, cases: 20 }, expected: { catchChance: 0.456205657073253 } },
    manual: { state: { ...base, ci: false }, expected: { catchChance: 0.2999677416956853 } },
    full: { state: base, expected: { catchChance: 0.999892472318951, cacheHit: 0.85 } },
  },
  initialPreset: 'start',
  simulate: simulatePromptTemplates,
  outputs: [
    { kind: 'meter', label: 'Chance the regression is caught before release', value: (r) => r.catchChance, emphasis: (r) => (r.catchChance < 0.95 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Edits that ship a blank variable', value: (r) => formatWholePercent(r.blankVariableShare), detail: (r) => (r.blankVariableShare ? 'f-strings render missing data as “None” or an empty string' : 'StrictUndefined fails the render test instead') },
    { kind: 'value', label: 'Prompt cache hit', value: (r) => formatWholePercent(r.cacheHit) },
    { kind: 'check', label: 'Ticket text is kept inside its tags', value: (r) => !r.exposed },
  ],
  verdict: (r, s) => (isSafe(r, s)
    ? { tone: 'ok', headline: 'Changes ship safely.', detail: 'Strict templates, a large suite in CI, cacheable layout and wrapped input.' }
    : r.catchChance < 0.5 ? { tone: 'no', headline: 'The regression will probably ship.', detail: 'Without enough automated cases, a 3% intent is easy to miss.' }
      : { tone: 'mid', headline: 'Nearly there.', detail: 'Fix the remaining gaps: suite size, CI, layout or wrapping.' }),
  narrate: (r, s) => [
    s.cases ? `A suite of ${s.cases} cases covers the broken 3% intent with probability ${formatPercent(r.coverage, 1)}${s.ci ? '' : ', but it only runs when someone remembers, so the real chance is lower'}.` : 'With no tests, the broken refund flow reaches customers.',
    s.strict ? 'Missing variables fail in tests.' : 'About 4% of edits silently render missing data as blank.',
    s.variables === 'end' ? 'Variables at the end keep the stable prefix cacheable.' : 'Variables at the top change the prefix on every call, so the cache never hits.',
  ].join(' '),
  missions: {
    catch: ({ result }) => result.catchChance >= 0.95,
    cache: ({ state, result }) => result.cacheHit >= 0.8 && state.strict,
    all: ({ state, result }) => isSafe(result, state),
  },
});
