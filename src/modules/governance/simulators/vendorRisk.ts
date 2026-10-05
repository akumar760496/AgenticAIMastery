/** Godavari Bank (fictional) on an overseas LLM provider: 2,00,000 complaint conversations a month; one 8-hour provider incident a year. */
export type DataTerms = 'default' | 'zdr';
export type VersionPolicy = 'alias' | 'pinned';
export type ProviderSetup = 'single' | 'fallback';
export interface VendorRiskState { readonly data: DataTerms; readonly version: VersionPolicy; readonly providers: ProviderSetup; readonly exitPlan: boolean }
export interface VendorRiskResult { readonly retentionDays: number; readonly heldConversations: number; readonly silentChanges: number; readonly plannedUpgrades: number; readonly outageHours: number; readonly findings: readonly string[]; readonly extraCost: number }

export function simulateVendorRisk(s: VendorRiskState): VendorRiskResult {
  const zdr = s.data === 'zdr'; const fallback = s.providers === 'fallback';
  const findings: string[] = [];
  if (!zdr) findings.push('customer data kept 30 days offshore, not assessed');
  if (s.version === 'alias') findings.push('no change control over the model version');
  if (!s.exitPlan) findings.push('no documented exit strategy');
  if (!fallback && !s.exitPlan) findings.push('concentration risk on one provider not managed');
  return {
    retentionDays: zdr ? 0 : 30,
    heldConversations: zdr ? 0 : 200000,
    silentChanges: s.version === 'alias' ? (fallback ? 10 : 6) : 0,
    plannedUpgrades: s.version === 'pinned' ? (fallback ? 3 : 2) : 0,
    outageHours: fallback ? 0.25 : 8,
    findings,
    extraCost: (zdr ? 600000 : 0) + (s.version === 'pinned' ? 240000 : 0) + (fallback ? 900000 : 0) + (s.exitPlan ? 120000 : 0),
  };
}
