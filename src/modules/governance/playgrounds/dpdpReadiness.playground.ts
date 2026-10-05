import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { flagsFrom, type Flags } from '@/shared/flags';
import { joinWithAnd } from '@/shared/format';
import { DPDP_KEYS, DPDP_OBLIGATIONS, simulateDpdp, type DpdpResult, type DpdpState } from '../simulators/dpdpReadiness';

const met = (...on: string[]): DpdpState => ({ met: flagsFrom(DPDP_KEYS, on) as Flags });
const gapNames = (r: DpdpResult, minBand = 0) => r.gaps.filter((g) => g.bandCrore >= minBand).map((g) => g.obligation);

export const dpdpReadinessPlayground = definePlayground<DpdpState, DpdpResult>({
  techniqueId: 'dpdp',
  title: 'Make an onboarding agent DPDP-ready',
  intro: 'A digital lender’s agent reads PAN, Aadhaar and bank statements. Tick what the design already does. Penalty bands are the Act’s maximums for that type of breach. Educational, not legal advice.',
  controls: [{ kind: 'flagSet', key: 'met', label: 'Designed in', options: DPDP_OBLIGATIONS.map((o) => ({ value: o.key, label: o.label })) }],
  presets: {
    start: { state: met(), expected: { metCount: 0, bandCrore: 250, storesErased: 2 } },
    vendor: { state: met('vendor'), expected: { metCount: 1, bandCrore: 200 } },
    nearly: { state: met('notice', 'consent', 'fields', 'vendor', 'retention'), expected: { metCount: 5, bandCrore: 200 } },
    legal: { state: met('notice', 'consent', 'breach'), expected: { metCount: 3, bandCrore: 250 } },
  },
  initialPreset: 'start',
  simulate: simulateDpdp,
  outputs: [
    { kind: 'meter', label: 'Obligations met', value: (r) => r.metCount / 7, detail: (r) => `= ${r.metCount} of 7`, emphasis: (r) => (r.metCount < 7 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Highest penalty band exposed', value: (r) => (r.bandCrore ? `up to ₹${r.bandCrore} crore` : 'none'), emphasis: (r) => (r.bandCrore >= 200 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Personal-data fields held per customer', value: (r) => String(r.fieldsHeld) },
    { kind: 'value', label: 'Stores an erasure request reaches', value: (r) => `${r.storesErased} of 5` },
  ],
  verdict: (r) => (r.metCount === 7
    ? { tone: 'ok', headline: 'Ready for May 2027.', detail: 'Every obligation in this checklist is designed in.' }
    : r.bandCrore >= 200 ? { tone: 'no', headline: 'Serious gaps.', detail: `Still open: ${joinWithAnd(gapNames(r, 200))}, the highest penalty bands.` }
      : { tone: 'mid', headline: 'Getting there.', detail: `Still open: ${gapNames(r).join(', ')}.` }),
  narrate: (r, s) => [
    `The design meets ${r.metCount} of 7 obligations.`,
    r.gaps.length ? `Gaps: ${gapNames(r).join(', ')}.` : '',
    s.met.vendor ? 'The vendor is bound as a processor.' : 'Raw identifiers go to a vendor with no processor contract, a safeguards failure with the highest penalty band.',
    s.met.erasure ? 'Erasure reaches all five stores.' : 'An erasure request reaches only 2 of 5 stores; copies stay in embeddings, memory and logs.',
  ].filter(Boolean).join(' '),
  missions: {
    full: ({ result }) => result.metCount === 7,
    band: ({ result }) => result.bandCrore <= 50 && result.metCount < 7,
    erase: ({ state, result }) => result.metCount === 6 && !state.met.erasure,
  },
});
