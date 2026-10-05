import { definePlayground, type ControlSpec } from '@/domain/playground/PlaygroundDefinition';
import { CAPABILITIES, GATES, simulateThreatModel, type ThreatModelResult, type ThreatModelState } from '../simulators/threatModel';

const base: ThreatModelState = { data: true, pdfs: true, emails: false, images: true, email: false, transfer: true, approve: false, confirm: false, separated: false, scoped: false };
const toggles: ControlSpec<ThreatModelState>[] = [...CAPABILITIES, ...GATES].map((c) => ({ kind: 'toggle', key: c.key, label: c.label }));

export const threatModelPlayground = definePlayground<ThreatModelState, ThreatModelResult>({
  techniqueId: 'threatmodel',
  title: 'Threat-model a banking assistant',
  intro: 'Capabilities first, then gates. A trifecta path joins private data, untrusted input and an outbound channel; a hijack path lets untrusted input trigger an unconfirmed transfer.',
  controls: toggles,
  presets: {
    start: { state: base, expected: { trifectaPaths: 1, hijackPaths: 1, usefulness: 70, level: 'critical' } },
    full: { state: { ...base, emails: true, email: true }, expected: { trifectaPaths: 4, hijackPaths: 2, usefulness: 100 } },
    gated: { state: { ...base, emails: true, images: false, email: true, approve: true, confirm: true, scoped: true }, expected: { trifectaPaths: 0, hijackPaths: 0, usefulness: 88 } },
    separated: { state: { ...base, emails: true, email: true, separated: true, scoped: true }, expected: { trifectaPaths: 0, hijackPaths: 0, usefulness: 95 } },
  },
  initialPreset: 'start',
  simulate: simulateThreatModel,
  outputs: [
    { kind: 'value', label: 'Trifecta paths', value: (r) => String(r.trifectaPaths), emphasis: (r) => (r.trifectaPaths ? 'warn' : 'normal') },
    { kind: 'value', label: 'Hijack paths', value: (r) => String(r.hijackPaths), emphasis: (r) => (r.hijackPaths ? 'warn' : 'normal') },
    { kind: 'value', label: 'Risk level', value: (r) => r.level, emphasis: (r) => (r.level === 'low' ? 'normal' : 'warn') },
    { kind: 'meter', label: 'Usefulness kept', value: (r) => r.usefulness / 100 },
    { kind: 'badges', items: (r) => r.risks.map((t) => ({ text: t, emphasis: 'warn' as const })) },
  ],
  verdict: (r) => (r.level === 'low'
    ? (r.usefulness >= 80 ? { tone: 'ok', headline: 'No ungated path, still useful.', detail: 'Every path from untrusted input to data leaving or money moving is broken.' } : { tone: 'mid', headline: 'Safe, but hobbled.', detail: 'Gate the paths instead of removing the capabilities.' })
    : { tone: 'no', headline: r.level === 'critical' ? 'Private data can leave.' : 'Untrusted text can move money.', detail: 'Break the path with a gate, a separated reader or scoped data.' }),
  narrate: (r, s) => [
    `With ${[s.pdfs && 'PDFs', s.emails && 'emails'].filter(Boolean).join(' and ') || 'no untrusted inputs'} coming in, there ${r.trifectaPaths === 1 ? 'is' : 'are'} ${r.trifectaPaths} ungated path${r.trifectaPaths === 1 ? '' : 's'} from private data to the outside and ${r.hijackPaths} to an unconfirmed transfer.`,
    s.separated ? 'The separated reader means untrusted text never reaches the model that chooses tools, which removes every path at once.' : s.images ? 'The chat’s image rendering is an outbound channel that needs no click.' : '',
    `The agent keeps ${r.usefulness}% of its usefulness${s.scoped ? ', and a successful attack could expose one customer’s record rather than 500' : ''}.`,
  ].filter(Boolean).join(' '),
  missions: {
    useful: ({ result }) => result.trifectaPaths === 0 && result.hijackPaths === 0 && result.usefulness >= 80,
    nosep: ({ state, result }) => result.trifectaPaths === 0 && result.hijackPaths === 0 && !state.separated && state.transfer && state.email,
    worst: ({ result }) => result.trifectaPaths === 4,
  },
});
