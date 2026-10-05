import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatPercent } from '@/shared/format';
import { ATTACKS, DEFENCES, simulateIndirect, type Attack, type Defence, type IndirectResult, type IndirectState } from '../simulators/indirectInjection';

const none: Record<Defence, boolean> = { classifier: false, spotlight: false, separation: false, confirm: false, egress: false, pin: false };
const p1 = (v: number) => formatPercent(v, 1);

export const indirectInjectionPlayground = definePlayground<IndirectState, IndirectResult>({
  techniqueId: 'indirect',
  title: 'Attack, then defend',
  intro: 'You are the attacker. The agent reads statements and payee names, renders markdown, loads an MCP tool and can add payees and transfer money. Then switch defences on one by one.',
  controls: [
    { kind: 'select', key: 'attack', label: 'Your attack', options: (Object.keys(ATTACKS) as Attack[]).map((k) => ({ value: k, label: ATTACKS[k].label })) },
    { kind: 'flagSet', key: 'defences', label: 'Defences', options: DEFENCES.map((d) => ({ value: d.key, label: d.label })) },
  ],
  presets: {
    start: { state: { attack: 'doc', defences: none }, expected: { chosen: 0.62, average: 0.54 } },
    cls: { state: { attack: 'doc', defences: { ...none, classifier: true } }, expected: { chosen: 0.372 } },
    arch: { state: { attack: 'doc', defences: { ...none, spotlight: true, separation: true, confirm: true } }, expected: { chosen: 0.005 } },
    all: { state: { attack: 'poison', defences: { classifier: true, spotlight: true, separation: true, confirm: true, egress: true, pin: true } }, expected: { taskSuccess: 78 } },
  },
  initialPreset: 'start',
  simulate: simulateIndirect,
  outputs: [
    { kind: 'meter', label: 'Your attack succeeds', value: (r) => r.chosen, detail: (r) => `= ${p1(r.chosen)}`, emphasis: (r) => (r.chosen >= 0.05 ? 'warn' : 'normal') },
    { kind: 'table', columns: ['Attack', 'Success'], rows: (r) => (Object.keys(ATTACKS) as Attack[]).map((a) => [ATTACKS[a].label, p1(r.success[a])]) },
    { kind: 'value', label: 'Average across all five', value: (r) => p1(r.average), emphasis: (r) => (r.average >= 0.05 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Real tasks that still succeed', value: (r) => r.taskSuccess / 100 },
  ],
  verdict: (r) => (r.average < 0.05 && r.taskSuccess >= 75
    ? { tone: 'ok', headline: 'Layered defences hold.', detail: 'Every attack is below 5% and real work still gets done.' }
    : r.chosen < 0.05 ? { tone: 'mid', headline: 'This attack is stopped.', detail: 'Check the others: each needs its own layer.' } : { tone: 'no', headline: 'The attack still lands.', detail: 'No single filter is enough; separate untrusted text from the model that acts.' }),
  narrate: (r, s) => [
    `Your attack, ${ATTACKS[s.attack].label.toLowerCase()}, succeeds ${p1(ATTACKS[s.attack].baseline)} of the time against an undefended agent.`,
    r.active.length ? `With ${r.active.length} defences on, it falls to ${p1(r.chosen)}.` : 'No defences are on yet.',
    s.defences.classifier && !s.defences.separation && s.attack === 'doc' ? 'The classifier catches obvious phrasing, but many document injections are paraphrased, so it alone is not enough.' : '',
    s.defences.separation ? 'Privilege separation is the biggest single step for injected content, because the model that calls tools never reads the raw text.' : '',
    s.attack === 'poison' && !s.defences.pin ? 'A poisoned tool description is read by the planner itself, so separation barely helps; pinning and review do.' : '',
    `Real customers complete ${r.taskSuccess}% of tasks.`,
  ].filter(Boolean).join(' '),
  missions: {
    doc: ({ state, result }) => state.attack === 'doc' && result.success.doc < 0.05,
    all: ({ result }) => result.average < 0.05 && result.taskSuccess >= 75,
    cls: ({ state, result }) => state.defences.classifier && !state.defences.spotlight && !state.defences.separation && !state.defences.confirm && !state.defences.egress && !state.defences.pin && state.attack === 'doc' && result.success.doc > 0.3,
  },
});
