/** Readiness of an AI use against Indian financial regulators' expectations (status as of 26 Sep 2026; simplified). */
import { enabledKeys, type Flags } from '@/shared/flags';

export type Entity = 'bank' | 'broker';
export type RiskTier = 'internal' | 'customer' | 'decision';
export const REG_CONTROLS: readonly (readonly [string, string])[] = [
  ['policy', 'Board-approved AI policy'], ['inventory', 'AI inventory with risk tiers'], ['validation', 'Independent validation, incl. vendor models'],
  ['vendor', 'Vendor contract with audit rights'], ['disclose', 'Tell customers AI is involved; human option'], ['grievance', 'Grievance route for AI outcomes'],
  ['incident', 'AI incident reporting'], ['kill', 'Kill switch'], ['hitl', 'Human review of decisions'],
];
export const REG_CONTROL_KEYS = REG_CONTROLS.map(([k]) => k);
const TIER_NEEDS: Readonly<Record<RiskTier, readonly string[]>> = {
  internal: ['policy', 'inventory', 'validation', 'vendor'],
  customer: ['policy', 'inventory', 'validation', 'vendor', 'disclose', 'grievance', 'incident', 'kill'],
  decision: ['policy', 'inventory', 'validation', 'vendor', 'disclose', 'grievance', 'incident', 'kill', 'hitl'],
};
const SOURCES: Readonly<Record<Entity, readonly (readonly [string, string, readonly string[]])[]>> = {
  bank: [['RBI FREE-AI', 'framework, Aug 2025', ['policy', 'inventory', 'validation', 'disclose', 'grievance', 'incident', 'hitl']], ['RBI model risk guidance', 'draft, June 2026', ['policy', 'inventory', 'validation', 'vendor', 'kill', 'hitl', 'disclose']]],
  broker: [['SEBI Regulation 16C', 'in force, Feb 2025', ['policy', 'validation', 'vendor']], ['SEBI AI guidelines', 'announced, not final', ['validation', 'disclose', 'incident', 'kill', 'hitl']]],
};

export interface FinancialRegulationState { readonly entity: Entity; readonly tier: RiskTier; readonly controls: Flags }
export interface SourceReadiness { readonly name: string; readonly status: string; readonly required: number; readonly met: number }
export interface FinancialRegulationResult { readonly required: readonly string[]; readonly gaps: readonly string[]; readonly extra: readonly string[]; readonly built: number; readonly sources: readonly SourceReadiness[] }

export const controlLabel = (key: string): string => REG_CONTROLS.find(([k]) => k === key)?.[1] ?? key;

export function simulateFinancialRegulation(s: FinancialRegulationState): FinancialRegulationResult {
  const required = TIER_NEEDS[s.tier];
  const done = enabledKeys(REG_CONTROL_KEYS, s.controls);
  const has = (k: string) => done.includes(k);
  return {
    required,
    gaps: required.filter((k) => !has(k)),
    extra: done.filter((k) => !required.includes(k)),
    built: done.length,
    sources: SOURCES[s.entity].map(([name, status, list]) => {
      const relevant = list.filter((k) => required.includes(k));
      return { name, status, required: relevant.length, met: relevant.filter(has).length };
    }),
  };
}
