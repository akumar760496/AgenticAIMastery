import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { flagsFrom } from '@/shared/flags';
import { formatWholePercent, pluralise } from '@/shared/format';
import { FRAMEWORK_CONTROL_KEYS, FRAMEWORK_CONTROLS, simulateFrameworks, type FrameworkResult, type FrameworkState } from '../simulators/frameworkCoverage';

const controls = (...on: string[]): FrameworkState => ({ controls: flagsFrom(FRAMEWORK_CONTROL_KEYS, on) });
const NAMES = { nist: 'NIST', iso: 'ISO', rbi: 'RBI', eu: 'EU' } as const;

export const frameworkCoveragePlayground = definePlayground<FrameworkState, FrameworkResult>({
  techniqueId: 'frameworks',
  title: 'Build one control library',
  intro: 'Tick the controls in place. Each counts towards every framework it serves. Mappings are simplified for learning.',
  controls: [{ kind: 'flagSet', key: 'controls', label: 'Controls in place', options: FRAMEWORK_CONTROLS.map(([value, label]) => ({ value, label })) }],
  presets: {
    start: { state: controls('evals', 'redteam'), expected: { nist: 0.25, built: 2 } },
    paper: { state: controls('policy', 'training', 'review'), expected: { nist: 0.25, built: 3 } },
    core: { state: controls('policy', 'inventory', 'impact', 'evals', 'monitor', 'incident', 'vendor', 'review'), expected: { nist: 1, built: 8 } },
    all: { state: controls(...FRAMEWORK_CONTROL_KEYS), expected: { complete: true, built: 11 } },
  },
  initialPreset: 'start',
  simulate: simulateFrameworks,
  outputs: [
    { kind: 'meter', label: 'NIST AI RMF functions', value: (r) => r.nist, detail: () => '= Govern, Map, Measure, Manage', emphasis: (r) => (r.nist < 1 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'ISO/IEC 42001 elements', value: (r) => r.iso, detail: () => '= needed for certification', emphasis: (r) => (r.iso < 1 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'RBI FREE-AI expectations', value: (r) => r.rbi, emphasis: (r) => (r.rbi < 1 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'EU AI Act high-risk (provider)', value: (r) => r.eu, emphasis: (r) => (r.eu < 1 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Controls built', value: (r) => `${r.built} of 11` },
  ],
  verdict: (r, s) => {
    if (r.complete) return { tone: 'ok', headline: 'Covered everywhere.', detail: 'One library answers all four.' };
    const tone = r.built <= 3 ? 'no' : 'mid';
    if (s.controls.evals && !s.controls.policy) return { tone, headline: 'Engineering without governance.', detail: 'Strong tests, but no policy, owner or inventory to hang them on.' };
    if (s.controls.policy && !s.controls.evals) return { tone, headline: 'Governance on paper.', detail: 'Policies with nothing measured behind them.' };
    return { tone, headline: 'Partly covered.', detail: 'Find the frameworks still short and add the controls they need.' };
  },
  narrate: (r) => {
    const short = (Object.keys(NAMES) as (keyof typeof NAMES)[]).filter((k) => r[k] < 1).map((k) => NAMES[k]);
    return `${r.built} ${pluralise(r.built, 'control')} cover ${formatWholePercent(r.nist)} of NIST’s functions, ${formatWholePercent(r.iso)} of ISO/IEC 42001, ${formatWholePercent(r.rbi)} of RBI’s expectations and ${formatWholePercent(r.eu)} of EU high-risk duties. ${short.length ? `Still short: ${short.join(', ')}.` : 'Every framework is fully covered.'}`;
  },
  missions: {
    nist: ({ result }) => result.nist === 1 && result.built <= 4,
    iso: ({ result }) => result.iso === 1,
    all: ({ result }) => result.complete,
  },
});
