import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount } from '@/shared/format';
import { USERS, simulateToolAuth, type ToolAuthResult, type ToolAuthState } from '../simulators/toolAuth';

const hours = (h: number) => (h === 0.25 ? '15 minutes' : h === 1 ? '1 hour' : h === 2160 ? '2,160 hours (90 days)' : `${h} hours`);

export const toolAuthPlayground = definePlayground<ToolAuthState, ToolAuthResult>({
  techniqueId: 'toolauth',
  title: 'Dhan Disha assistant · 50,000 connected users (fictional)',
  intro: 'Five tools: get_portfolio, get_statements, start_sip, redeem_units and update_mandate. A shared key is rotated every 90 days; refresh tokens last 30 days.',
  controls: [
    { kind: 'select', key: 'credential', label: 'Credential model', options: [{ value: 'shared', label: 'One shared API key for all users' }, { value: 'user', label: 'Per-user OAuth token (delegated)' }] },
    { kind: 'select', key: 'scope', label: 'Scope granularity', options: [{ value: 'broad', label: 'Broad: every call carries all five scopes' }, { value: 'tool', label: 'Per tool: one scope per call; writes need step-up consent' }] },
    { kind: 'steps', key: 'lifetimeHours', label: 'Access-token lifetime', values: [24, 1, 0.25], format: hours },
    { kind: 'select', key: 'secrets', label: 'Secrets are kept', options: [{ value: 'prompt', label: 'In the system prompt' }, { value: 'vault', label: 'In a vault the tool layer reads' }] },
  ],
  presets: {
    start: { state: { credential: 'shared', scope: 'broad', lifetimeHours: 24, secrets: 'prompt' }, expected: { accountsExposed: 50000, exposure: 108000000, canCopy: true, attributable: 0 } },
    oauth: { state: { credential: 'user', scope: 'broad', lifetimeHours: 24, secrets: 'vault' }, expected: { exposure: 24, canCopy: false, attributable: 1 } },
    scoped: { state: { credential: 'user', scope: 'tool', lifetimeHours: 1, secrets: 'vault' }, expected: { exposure: 1, promptsPerDay: 0.2333, refreshesPerDay: 3 } },
    leaky: { state: { credential: 'user', scope: 'tool', lifetimeHours: 0.25, secrets: 'prompt' }, expected: { exposure: 0.25, canCopy: true, refreshesPerDay: 6 } },
  },
  initialPreset: 'start',
  simulate: simulateToolAuth,
  outputs: [
    { kind: 'value', label: 'Accounts exposed if a credential leaks', value: (r) => formatCount(r.accountsExposed), detail: (r) => `for ${hours(r.windowHours)} · ${r.readOnly ? 'read-only, one tool' : 'read and redeem, all five tools'}`, emphasis: (r) => (r.accountsExposed > 1 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Exposure (accounts × hours)', value: (r) => `${r.exposure < 1 ? r.exposure : formatCount(r.exposure)} account-hours` },
    { kind: 'value', label: 'Accounts a prompt injection can reach', value: (r) => formatCount(r.injectionReach), detail: (r) => (r.canCopy ? 'and it can make the model echo the credential itself' : 'the credential never enters the prompt, so it cannot be echoed') },
    { kind: 'value', label: 'Re-auth prompts per user per day', value: (r) => r.promptsPerDay.toFixed(2), detail: (r) => (r.refreshesPerDay ? `${r.refreshesPerDay} silent refreshes a day (${formatCount(r.refreshesPerDay * USERS)} in all)` : 'none: users never consent at all') },
    { kind: 'meter', label: 'Calls attributable to a user', value: (r) => r.attributable },
  ],
  verdict: (r, s) => {
    if (s.credential === 'user' && r.readOnly && s.lifetimeHours <= 1 && !r.canCopy) return { tone: 'ok', headline: 'Contained and traceable.', detail: 'A leak or an injection touches one user, one scope, briefly, and every call names its user.' };
    if (s.credential === 'shared') return { tone: 'no', headline: 'One key opens every account.', detail: 'Switch to per-user OAuth tokens so each call can only act for the user who consented.' };
    return { tone: 'mid', headline: 'Better, not there yet.', detail: r.canCopy ? 'Move the token out of the prompt and into a vault the tool layer reads.' : !r.readOnly ? 'Give each tool its own scope, so a read call cannot redeem.' : 'Shorten the access-token lifetime; refresh keeps it silent.' };
  },
  narrate: (r, s) => [
    s.credential === 'shared' ? `Every tool call uses one shared key, so a leak exposes all ${formatCount(USERS)} accounts for up to 90 days, and a prompt injection can act on any of them.` : `Each call carries the user’s own token, so a leak exposes one account for ${hours(s.lifetimeHours)}.`,
    r.readOnly ? 'Each call carries only its tool’s scope, so a leaked read token cannot redeem units.' : 'Every call carries all five scopes, so even a portfolio lookup could redeem units.',
    r.canCopy ? 'Because the credential sits in the prompt, an injected instruction can make the model print it.' : 'The credential stays in a vault; the model only sees results.',
    s.credential === 'shared' ? 'Users are never asked to consent, and the API cannot tell which user any call was for.' : `Users see ${r.promptsPerDay.toFixed(2)} prompts a day, about one every ${Math.round(1 / r.promptsPerDay)} days.`,
  ].join(' '),
  missions: {
    contain: ({ state, result }) => result.accountsExposed === 1 && result.windowHours <= 1 && state.scope === 'tool',
    inject: ({ state, result }) => result.injectionReach === 1 && !result.canCopy && state.scope === 'tool',
    short: ({ state, result }) => state.credential === 'user' && state.lifetimeHours === 0.25 && result.promptsPerDay <= 0.25 && result.attributable === 1,
  },
});
