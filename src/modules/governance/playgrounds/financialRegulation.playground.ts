import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { flagsFrom } from '@/shared/flags';
import { joinWithAnd } from '@/shared/format';
import { controlLabel, REG_CONTROL_KEYS, REG_CONTROLS, simulateFinancialRegulation, type FinancialRegulationResult, type FinancialRegulationState } from '../simulators/financialRegulation';

const lower = (t: string) => (/^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);
const names = (keys: readonly string[]) => keys.map((k) => lower(controlLabel(k)));
const TIER_TEXT = { internal: 'staff-only tool', customer: 'customer-facing agent', decision: 'decision-making agent' } as const;
const isReady = (r: FinancialRegulationResult) => r.gaps.length === 0;

export const financialRegulationPlayground = definePlayground<FinancialRegulationState, FinancialRegulationResult>({
  techniqueId: 'finreg',
  title: 'Get an AI use ready for your regulator',
  intro: 'Readiness is judged against the controls each source expects for this risk tier. Status as of 26 Sep 2026. Educational, not legal advice.',
  controls: [
    { kind: 'select', key: 'entity', label: 'Entity', options: [{ value: 'bank', label: 'Bank or NBFC (RBI)' }, { value: 'broker', label: 'Broker or other intermediary (SEBI)' }] },
    { kind: 'select', key: 'tier', label: 'AI use', options: [{ value: 'internal', label: 'Internal tool (staff only)' }, { value: 'customer', label: 'Customer-facing support agent' }, { value: 'decision', label: 'Decides about customers (KYC, credit)' }] },
    { kind: 'flagSet', key: 'controls', label: 'Controls in place', options: REG_CONTROLS.map(([value, label]) => ({ value, label })) },
  ],
  presets: {
    start: { state: { entity: 'broker', tier: 'customer', controls: flagsFrom(REG_CONTROL_KEYS, ['validation']) }, expected: { built: 1 } },
    vendor: { state: { entity: 'broker', tier: 'customer', controls: flagsFrom(REG_CONTROL_KEYS, ['policy', 'inventory', 'disclose', 'grievance', 'incident', 'kill']) }, expected: { built: 6 } },
    bank: { state: { entity: 'bank', tier: 'decision', controls: flagsFrom(REG_CONTROL_KEYS, ['policy', 'inventory', 'validation', 'vendor', 'disclose', 'grievance', 'incident', 'kill']) }, expected: { built: 8 } },
    heavy: { state: { entity: 'broker', tier: 'internal', controls: flagsFrom(REG_CONTROL_KEYS, REG_CONTROL_KEYS) }, expected: { built: 9 } },
  },
  initialPreset: 'start',
  simulate: simulateFinancialRegulation,
  outputs: [
    { kind: 'table', columns: ['Source', 'Status', 'Met'], rows: (r) => r.sources.map((x) => [x.name, x.status, `${x.met} of ${x.required}`]) },
    { kind: 'value', label: 'Controls this tier needs', value: (r) => String(r.required.length) },
    { kind: 'value', label: 'Controls built', value: (r) => String(r.built) },
    { kind: 'value', label: 'Who answers for a vendor model’s output', value: () => 'You' },
  ],
  verdict: (r) => (!isReady(r)
    ? { tone: 'no', headline: 'Not ready.', detail: `Missing: ${names(r.gaps).join(', ')}.` }
    : r.extra.length > 2 ? { tone: 'mid', headline: 'Ready, but heavy.', detail: `An internal tool does not need ${joinWithAnd(names(r.extra))}.` }
      : { tone: 'ok', headline: 'Ready.', detail: 'Every control this tier needs is in place.' }),
  narrate: (r, s) => {
    const inPlace = r.required.length - r.gaps.length;
    return [
      `A ${TIER_TEXT[s.tier]} at a ${s.entity === 'bank' ? 'bank or NBFC' : 'broker'} needs ${r.required.length} controls; ${inPlace} ${inPlace === 1 ? 'is' : 'are'} in place.`,
      !s.controls.vendor && r.required.includes('vendor') ? 'The vendor model is not covered by a contract with audit rights, but the firm still answers for its output.' : '',
      s.tier === 'decision' && !s.controls.hitl ? 'No human reviews decisions about customers.' : '',
    ].filter(Boolean).join(' ');
  },
  missions: {
    broker: ({ state, result }) => state.entity === 'broker' && state.tier === 'customer' && isReady(result),
    bank: ({ state, result }) => state.entity === 'bank' && state.tier === 'decision' && isReady(result),
    lean: ({ state, result }) => state.tier === 'internal' && isReady(result) && result.built <= 4,
  },
});
