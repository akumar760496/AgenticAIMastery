import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount } from '@/shared/format';
import { CATEGORY_LABELS, simulateRedTeam, weaknessCount, type Category, type RedTeamResult, type RedTeamState } from '../simulators/redTeaming';

const all = { inj: true, exf: true, agy: true, leak: true };

export const redTeamingPlayground = definePlayground<RedTeamState, RedTeamResult>({
  techniqueId: 'redteam',
  title: 'Red-team the staging agent',
  intro: 'Staging hides 12 weaknesses: 5 easy, 4 that need encodings or several turns, 3 that only multi-turn attacks reveal. Each attack and its grading cost ₹0.80.',
  controls: [
    { kind: 'steps', key: 'attacks', label: 'Attack budget', values: Array.from({ length: 50 }, (_, i) => (i + 1) * 100), format: formatCount },
    ...(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => ({ kind: 'toggle' as const, key: c, label: `${CATEGORY_LABELS[c]} (${weaknessCount(c)})` })),
    { kind: 'toggle', key: 'single', label: 'Single-turn templates' },
    { kind: 'toggle', key: 'encodings', label: 'Encodings (base64, leetspeak)' },
    { kind: 'toggle', key: 'multiTurn', label: 'Multi-turn escalation' },
    { kind: 'toggle', key: 'regressionSuite', label: 'Save hits as a CI regression suite' },
  ],
  presets: {
    start: { state: { attacks: 500, inj: true, exf: false, agy: false, leak: false, single: true, encodings: false, multiTurn: false, regressionSuite: false }, expected: { found: 1.9999, costInr: 400, categories: 1 } },
    wide: { state: { attacks: 2000, ...all, single: true, encodings: false, multiTurn: false, regressionSuite: false }, expected: { found: 5, hardFound: 0, costInr: 1600 } },
    mixed: { state: { attacks: 2500, ...all, single: true, encodings: true, multiTurn: true, regressionSuite: true }, expected: { costInr: 2000 } },
    deep: { state: { attacks: 5000, ...all, single: false, encodings: true, multiTurn: true, regressionSuite: true }, expected: { costInr: 4000 } },
  },
  initialPreset: 'start',
  simulate: simulateRedTeam,
  outputs: [
    { kind: 'meter', label: 'Weaknesses found (of 12)', value: (r) => r.found / 12, detail: (r) => `≈ ${r.found.toFixed(1)}` },
    { kind: 'value', label: 'Of the 3 hardest', value: (r) => r.hardFound.toFixed(1), emphasis: (r) => (r.hardFound < 1 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Cost', value: (r) => `₹${formatCount(r.costInr)}` },
    { kind: 'table', columns: ['Category', 'Found'], rows: (r) => (Object.keys(CATEGORY_LABELS) as Category[]).map((c) => [CATEGORY_LABELS[c], r.perCategory[c] === undefined ? 'not tested' : `${r.perCategory[c]!.toFixed(1)} of ${weaknessCount(c)}`]) },
  ],
  verdict: (r, s) => (r.found >= 9
    ? { tone: 'ok', headline: 'Most weaknesses found.', detail: s.regressionSuite ? 'Hits are saved as regression tests.' : 'Save the hits as regression tests so they stay fixed.' }
    : { tone: r.found >= 5 ? 'mid' : 'no', headline: 'Weaknesses stay hidden.', detail: !s.multiTurn ? 'Only multi-turn attacks reveal the hardest ones.' : r.categories < 4 ? 'Test every category.' : 'Raise the budget.' }),
  narrate: (r, s) => [
    `${formatCount(s.attacks)} attacks across ${r.categories} categories and ${r.strategies} strategies find about ${r.found.toFixed(1)} of the 12 weaknesses for ₹${formatCount(r.costInr)}.`,
    !s.multiTurn ? 'No multi-turn attacks are running, so the 3 weaknesses that only show up over several turns stay hidden however large the budget.' : `Multi-turn attacks reveal about ${r.hardFound.toFixed(1)} of the 3 hardest weaknesses.`,
    r.categories < 4 ? `${4 - r.categories} categories are not tested at all.` : '',
    s.regressionSuite ? 'Every successful attack is kept as a regression test.' : 'Without a regression suite, the next prompt change can quietly reopen what was fixed.',
  ].filter(Boolean).join(' '),
  missions: {
    nine: ({ result }) => result.found >= 9,
    cheap: ({ result }) => result.found >= 9 && result.costInr <= 2000,
    blind: ({ state, result }) => state.single && !state.encodings && !state.multiTurn && state.attacks >= 4000 && result.categories === 4 && result.hardFound < 0.01,
  },
});
