/** Agent identity for 30 agents: shared admin vs per-agent vs on-behalf-of, permissions and credential rotation. */
export type IdentityModel = 'shared' | 'peragent' | 'obo';
export type Permissions = 'broad' | 'least' | 'jit';
export type Rotation = 'never' | '90d' | 'short';
const REACH: Readonly<Record<'shared' | 'own', Readonly<Record<Permissions, readonly [systems: number, write: number]>>>> = { shared: { broad: [12, 12], least: [10, 6], jit: [10, 0] }, own: { broad: [12, 12], least: [4, 1], jit: [3, 0] } };
const WINDOW: Readonly<Record<Rotation, readonly [days: number, label: string]>> = { never: [180, 'about 180 days, until someone notices'], '90d': [45, '45 days on average (up to 90)'], short: [15 / 1440, '15 minutes'] };
const OPS_IDENTITY: Readonly<Record<IdentityModel, number>> = { shared: 2, peragent: 12, obo: 20 };
const OPS_PERMS: Readonly<Record<Permissions, number>> = { broad: 0, least: 8, jit: 14 };
export const ALL_RECORDS = 8000000;
export const INCIDENTS = 40;

export interface AgentIdentityState { readonly identity: IdentityModel; readonly permissions: Permissions; readonly rotation: Rotation }
export interface AgentIdentityResult { readonly systems: number; readonly writeSystems: number; readonly records: number; readonly windowLabel: string; readonly windowDays: number; readonly tracedToAgent: number; readonly tracedToBoth: number; readonly standingPrivileged: number; readonly killSwitchStops: number; readonly opsHours: number }

export function simulateAgentIdentity(s: AgentIdentityState): AgentIdentityResult {
  const [systems, writeSystems] = REACH[s.identity === 'shared' ? 'shared' : 'own'][s.permissions];
  const [windowDays, windowLabel] = WINDOW[s.rotation];
  return {
    systems, writeSystems, windowDays, windowLabel,
    records: s.identity === 'obo' ? Math.min(ALL_RECORDS, Math.round(2000 * windowDays)) : ALL_RECORDS,
    tracedToAgent: s.identity === 'shared' ? 6 : INCIDENTS,
    tracedToBoth: s.identity === 'shared' ? 0 : s.identity === 'peragent' ? 12 : INCIDENTS,
    standingPrivileged: s.permissions === 'jit' ? 0 : s.identity === 'shared' ? 1 : s.permissions === 'broad' ? 30 : 12,
    killSwitchStops: s.identity === 'shared' ? 30 : 1,
    opsHours: OPS_IDENTITY[s.identity] + OPS_PERMS[s.permissions] + (s.rotation === 'never' ? 0 : s.rotation === 'short' ? 4 : s.identity === 'shared' ? 1 : 10),
  };
}
