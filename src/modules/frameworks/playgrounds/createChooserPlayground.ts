/**
 * Factory for the framework-chooser playgrounds. Every framework lesson shares one simulator and one layout;
 * only the highlighted framework, its presets and its missions differ.
 */
import { definePlayground, type MissionContext, type PlaygroundDefinition } from '@/domain/playground/PlaygroundDefinition';
import { FRAMEWORKS, NEEDS, rankFrameworks, type ChooserResult, type ChooserState, type FrameworkId } from '../simulators/frameworkChooser';

type Mission = (ctx: MissionContext<ChooserState, ChooserResult>) => boolean;
interface ChooserConfig {
  readonly id: FrameworkId;
  readonly presets: Readonly<Record<string, { readonly state: ChooserState; readonly expected?: Partial<ChooserResult> }>>;
  readonly missions: Readonly<Record<string, Mission>>;
}

const WEIGHT_OPTIONS = [{ value: '0', label: 'Not needed' }, { value: '1', label: 'Useful' }, { value: '2', label: 'Essential' }];
const strengthsText = (r: ChooserResult) => r.ranked[0]?.strengths.join(' and ') || 'your constraints';

export function createChooserPlayground({ id, presets, missions }: ChooserConfig): PlaygroundDefinition<ChooserState, ChooserResult> {
  const name = FRAMEWORKS[id].name;
  const position = (r: ChooserResult) => `${name} ranks ${r.rank} of ${r.ranked.length}.`;
  const exclusion = (r: ChooserResult) => r.excluded.find((x) => x.id === id)?.reason ?? '';
  return definePlayground<ChooserState, ChooserResult>({
    techniqueId: id,
    title: 'Pick my framework',
    intro: `Set what your team needs. Scores are editorial judgements as of Sep 2026, highlighting ${name}; the same UPI-dispute agent is written in each.`,
    controls: [
      { kind: 'select', key: 'lang', label: 'Language', options: [{ value: 'python', label: 'Python' }, { value: 'ts', label: 'TypeScript' }, { value: 'dotnet', label: '.NET (C#)' }, { value: 'jvm', label: 'Java or Go' }] },
      { kind: 'select', key: 'model', label: 'Models', options: [{ value: 'any', label: 'Must be able to switch providers' }, { value: 'claude', label: 'Committed to Claude' }, { value: 'openai', label: 'Committed to OpenAI' }, { value: 'gemini', label: 'Committed to Gemini' }] },
      { kind: 'select', key: 'cloud', label: 'Cloud', options: [{ value: 'none', label: 'No preference' }, { value: 'gcp', label: 'Google Cloud' }, { value: 'azure', label: 'Microsoft Azure' }] },
      ...NEEDS.map(([key, label]) => ({ kind: 'select' as const, key, label, options: WEIGHT_OPTIONS })),
    ],
    presets,
    initialPreset: 'start',
    simulate: (s) => rankFrameworks(s, id),
    outputs: [
      { kind: 'table', columns: ['Framework', 'Fit', 'Lines'], highlightFirstRow: true, rows: (r) => r.ranked.map((x, i) => [`${i === 0 ? '★ ' : ''}${x.name}${x.id === id ? ' ◀' : ''}`, `${Math.round(x.fit * 100)}%`, String(x.loc)]) },
      { kind: 'value', label: 'Ruled out', value: (r) => (r.excluded.length ? r.excluded.map((x) => `${x.name} (${x.reason})`).join('; ') : 'none') },
    ],
    verdict: (r) => {
      const detail = r.top ? `Top pick: ${FRAMEWORKS[r.top].name}, strongest on ${strengthsText(r)}.` : 'Nothing fits these constraints.';
      if (r.top === id) return { tone: 'ok', headline: `${name} fits best.`, detail };
      if (r.ruledOut) return { tone: 'no', headline: `${name} is ruled out.`, detail };
      return { tone: 'mid', headline: position(r), detail };
    },
    narrate: (r) => [
      r.top ? `${FRAMEWORKS[r.top].name} fits these needs best, mainly for ${strengthsText(r)}.` : '',
      r.ruledOut ? `${name} is ruled out: ${exclusion(r)}.` : position(r),
      'Every option writes the same agent in 23 to 31 lines; the difference is what comes built in beyond them.',
    ].filter(Boolean).join(' '),
    missions,
  });
}
