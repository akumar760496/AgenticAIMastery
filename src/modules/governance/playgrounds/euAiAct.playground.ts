import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { EU_USES, simulateEuAiAct, type EuAiActResult, type EuAiActState } from '../simulators/euAiAct';

const HEADLINE = { prohibited: 'Banned in the EU.', high: 'High-risk: plan now.', transparency: 'Disclose it.', out: 'Outside the Act.', minimal: 'Minimal risk.' } as const;

export const euAiActPlayground = definePlayground<EuAiActState, EuAiActResult>({
  techniqueId: 'euai',
  title: 'Classify a system under the EU AI Act',
  intro: 'Dates reflect the Digital Omnibus, in force since 27 July 2026. Simplified for learning; real classification needs legal review.',
  controls: [
    { kind: 'select', key: 'use', label: 'AI use', options: Object.entries(EU_USES).map(([value, [label]]) => ({ value, label })) },
    { kind: 'select', key: 'role', label: 'Your role', options: [{ value: 'provider', label: 'Provider: we built it' }, { value: 'deployer', label: 'Deployer: we use a vendor’s system' }] },
    { kind: 'toggle', key: 'inEu', label: 'Its output affects people in the EU' },
  ],
  presets: {
    start: { state: { use: 'chatbot', inEu: true, role: 'deployer' }, expected: { tier: 'transparency', appliesFrom: '2 Aug 2026' } },
    credit: { state: { use: 'credit', inEu: true, role: 'provider' }, expected: { tier: 'high', appliesFrom: '2 Dec 2027' } },
    fraud: { state: { use: 'fraud', inEu: true, role: 'provider' }, expected: { tier: 'minimal' } },
    india: { state: { use: 'chatbot', inEu: false, role: 'deployer' }, expected: { tier: 'out' } },
  },
  initialPreset: 'start',
  simulate: simulateEuAiAct,
  outputs: [
    { kind: 'value', label: 'Tier', value: (r) => r.label, emphasis: (r) => (r.tier === 'prohibited' || r.tier === 'high' ? 'warn' : 'normal') },
    { kind: 'value', label: 'Applies from', value: (r) => r.appliesFrom },
    { kind: 'value', label: 'Maximum fine', value: (r) => r.maxFine },
    { kind: 'table', columns: ['Your duties'], rows: (r) => r.duties.map((d) => [d]) },
  ],
  verdict: (r, s) => ({
    tone: r.tier === 'prohibited' ? 'no' : r.tier === 'high' ? 'mid' : 'ok',
    headline: HEADLINE[r.tier],
    detail: r.tier === 'prohibited' ? 'No compliance programme makes this lawful.' : r.tier === 'high' ? 'The duties are large and the date is fixed.'
      : r.tier === 'transparency' ? 'The duty already applies.' : r.tier === 'out' ? 'Indian rules still apply.'
        : s.use === 'fraud' ? 'Fraud detection is carved out of the credit-scoring category.' : 'Only AI literacy applies.',
  }),
  narrate: (r, s) => [
    `${EU_USES[s.use][0]}, ${s.inEu ? 'affecting people in the EU' : 'with no EU users or outputs'}, with you as ${s.role}:`,
    r.tier === 'out' ? 'the Act does not reach it.' : `${r.label.charAt(0).toLowerCase()}${r.label.slice(1)}, applying from ${r.appliesFrom}.`,
    r.tier === 'high' ? (s.role === 'provider' ? 'As provider you carry the heaviest duties, including conformity assessment.' : 'As deployer you must oversee it, keep its logs and inform the people it affects.') : '',
  ].filter(Boolean).join(' '),
  missions: {
    ban: ({ result }) => result.tier === 'prohibited',
    deployer: ({ state, result }) => result.tier === 'high' && state.role === 'deployer',
    out: ({ state, result }) => result.tier === 'out' && EU_USES[state.use][1] === 'high',
  },
});
