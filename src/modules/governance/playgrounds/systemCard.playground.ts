import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { flagsFrom } from '@/shared/flags';
import { CARD_SECTION_KEYS, CARD_SECTIONS, simulateSystemCard, type SystemCardResult, type SystemCardState } from '../simulators/systemCard';

const pagesText = (p: number) => `${p.toFixed(2).replace(/\.?0+$/, '')} ${p === 1 ? 'page' : 'pages'}`;
const allBut = (...off: string[]) => flagsFrom(CARD_SECTION_KEYS, CARD_SECTION_KEYS.filter((k) => !off.includes(k)));

export const systemCardPlayground = definePlayground<SystemCardState, SystemCardResult>({
  techniqueId: 'cards',
  title: 'Write the KYC agent’s system card',
  intro: 'The agent is 94% accurate overall and 71% on scanned regional-language documents. An auditor brings 20 points of questions.',
  controls: [
    { kind: 'select', key: 'audience', label: 'Audience', options: [{ value: 'regulator', label: 'Auditor or regulator' }, { value: 'customer', label: 'Customers' }] },
    { kind: 'flagSet', key: 'sections', label: 'Sections', options: CARD_SECTIONS.map(([value, label]) => ({ value, label })) },
  ],
  presets: {
    start: { state: { audience: 'regulator', sections: flagsFrom(CARD_SECTION_KEYS, ['use', 'evals']) }, expected: { score: 5, hidesSegment: true } },
    eng: { state: { audience: 'regulator', sections: flagsFrom(CARD_SECTION_KEYS, ['use', 'evals', 'seg', 'changes']) }, expected: { score: 10, disclosed: false } },
    avg: { state: { audience: 'regulator', sections: allBut('seg') }, expected: { score: 17, hidesSegment: true } },
    cust: { state: { audience: 'customer', sections: allBut() }, expected: { pages: 2 } },
  },
  initialPreset: 'start',
  simulate: simulateSystemCard,
  outputs: [
    { kind: 'meter', label: 'Auditor questions answered', value: (r) => r.score / 20, detail: (r) => `= ${r.score} of 20 points`, emphasis: (r) => (r.score < 18 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Length', value: (r) => pagesText(r.pages) },
    { kind: 'check', label: 'Failing segment disclosed', value: (r) => r.disclosed },
  ],
  verdict: (r, s) => {
    if (r.hidesSegment) return { tone: 'no', headline: 'The average hides a failure.', detail: '94% overall, with nothing about the 71% segment.' };
    if (s.audience === 'customer') {
      return r.pages <= 1 ? { tone: 'ok', headline: 'Plain and short.', detail: 'Customers see what it does, its limits, the human route and whom to call.' }
        : { tone: 'mid', headline: 'Too long for customers.', detail: 'Keep only what a customer needs: purpose, limits, human review and contact.' };
    }
    return r.score >= 18 ? { tone: 'ok', headline: 'Audit-ready.', detail: 'Purpose, data, segment results, limits, oversight and versions are all covered.' }
      : { tone: 'mid', headline: 'Gaps an auditor will find.', detail: 'Add the sections an auditor will ask about.' };
  },
  narrate: (r, s) => [
    `A ${r.sectionCount}-section card for ${s.audience === 'customer' ? 'customers' : 'an auditor'} answers ${r.score} of 20 points of audit questions in ${pagesText(r.pages)}.`,
    r.hidesSegment ? 'It reports 94% overall and hides the 71% segment.' : s.sections.seg ? `It shows the 71% segment${s.sections.limits ? ' and says what is done about it.' : ' but not what is done about it.'}` : '',
  ].filter(Boolean).join(' '),
  missions: {
    audit: ({ state, result }) => state.audience === 'regulator' && result.score >= 18,
    gap: ({ result }) => result.disclosed,
    cust: ({ state, result }) => state.audience === 'customer' && ['use', 'limits', 'oversight', 'contact'].every((k) => state.sections[k]) && result.pages <= 1,
  },
});
