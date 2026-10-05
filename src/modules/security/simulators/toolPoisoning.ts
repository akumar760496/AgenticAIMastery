/** Five requested MCP servers: a look-alike, hidden instructions and a rug pull on day 3, against four controls. */
export interface ToolPoisoningState { readonly allowlist: boolean; readonly scanDescriptions: boolean; readonly pinHashes: boolean; readonly scopedTokens: boolean; readonly day: number }
export type ServerStatus = 'ok' | 'blocked' | 'poisoned';
export interface ServerRow { readonly name: string; readonly status: string; readonly kind: ServerStatus }
export interface ToolPoisoningResult { readonly servers: readonly ServerRow[]; readonly reaching: readonly string[]; readonly typosquatBlocked: boolean; readonly legitimateConnected: number; readonly tokenExposed: boolean; readonly rugPulled: boolean; readonly rugCaught: boolean }
const RUG_DAY = 3;

export function simulateToolPoisoning(s: ToolPoisoningState): ToolPoisoningResult {
  const rugPulled = s.day >= RUG_DAY;
  const servers: ServerRow[] = [{ name: 'ledger-mcp', status: 'connected', kind: 'ok' }, { name: 'weather-mcp', status: 'connected', kind: 'ok' }];
  const reaching: string[] = [];
  if (rugPulled && s.pinHashes) servers.push({ name: 'notes-mcp', status: 'blocked: description changed', kind: 'blocked' });
  else if (rugPulled) { servers.push({ name: 'notes-mcp', status: 'connected · poisoned since day 3', kind: 'poisoned' }); reaching.push('notes-mcp'); }
  else servers.push({ name: 'notes-mcp', status: 'connected', kind: 'ok' });
  if (s.scanDescriptions) servers.push({ name: 'pdf-tools', status: 'blocked: hidden instructions', kind: 'blocked' });
  else { servers.push({ name: 'pdf-tools', status: 'connected · hidden instructions', kind: 'poisoned' }); reaching.push('pdf-tools'); }
  if (s.allowlist) servers.push({ name: 'slack-mpc', status: 'blocked: not on the allowlist', kind: 'blocked' });
  else if (s.scanDescriptions) servers.push({ name: 'slack-mpc', status: 'blocked: hidden instructions', kind: 'blocked' });
  else { servers.push({ name: 'slack-mpc', status: 'connected · typosquat', kind: 'poisoned' }); reaching.push('slack-mpc'); }
  return { servers, reaching, typosquatBlocked: s.allowlist || s.scanDescriptions, legitimateConnected: 2 + (rugPulled ? 0 : 1), tokenExposed: reaching.length > 0 && !s.scopedTokens, rugPulled, rugCaught: rugPulled && s.pinHashes };
}
