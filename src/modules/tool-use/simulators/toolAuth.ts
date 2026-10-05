/** Credentials for a 50,000-user assistant: shared key vs per-user OAuth, scopes, token lifetime and where secrets live. */
export type CredentialModel = 'shared' | 'user';
export type ScopeGranularity = 'broad' | 'tool';
export type SecretPlacement = 'prompt' | 'vault';
export const USERS = 50000;
const SHARED_KEY_HOURS = 2160;
const REFRESH_DAYS = 30;
const STEP_UP_PER_DAY = 0.2;

export interface ToolAuthState { readonly credential: CredentialModel; readonly scope: ScopeGranularity; readonly lifetimeHours: number; readonly secrets: SecretPlacement }
export interface ToolAuthResult { readonly accountsExposed: number; readonly windowHours: number; readonly exposure: number; readonly injectionReach: number; readonly canCopy: boolean; readonly readOnly: boolean; readonly promptsPerDay: number; readonly refreshesPerDay: number; readonly attributable: number }

export function simulateToolAuth(s: ToolAuthState): ToolAuthResult {
  const user = s.credential === 'user';
  const accountsExposed = user ? 1 : USERS;
  const windowHours = user ? s.lifetimeHours : SHARED_KEY_HOURS;
  return {
    accountsExposed, windowHours, exposure: accountsExposed * windowHours, injectionReach: accountsExposed,
    canCopy: s.secrets === 'prompt', readOnly: s.scope === 'tool',
    promptsPerDay: user ? 1 / REFRESH_DAYS + (s.scope === 'tool' ? STEP_UP_PER_DAY : 0) : 0,
    refreshesPerDay: user ? (s.lifetimeHours === 24 ? 1 : s.lifetimeHours === 1 ? 3 : 6) : 0,
    attributable: user ? 1 : 0,
  };
}
