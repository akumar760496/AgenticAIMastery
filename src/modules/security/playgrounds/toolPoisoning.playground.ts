import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { simulateToolPoisoning, type ToolPoisoningResult, type ToolPoisoningState } from '../simulators/toolPoisoning';

export const toolPoisoningPlayground = definePlayground<ToolPoisoningState, ToolPoisoningResult>({
  techniqueId: 'toolpoison',
  title: 'Five MCP servers are requested',
  intro: 'One is a look-alike, one hides instructions in its descriptions, and one will change its descriptions on day 3.',
  controls: [
    { kind: 'toggle', key: 'allowlist', label: 'Allowlist of reviewed publishers' },
    { kind: 'toggle', key: 'scanDescriptions', label: 'Scan descriptions when connecting' },
    { kind: 'toggle', key: 'pinHashes', label: 'Pin versions and hash descriptions' },
    { kind: 'toggle', key: 'scopedTokens', label: 'One scoped token per server' },
    { kind: 'steps', key: 'day', label: 'Day', values: [1, 2, 3, 4, 5, 6, 7], format: String },
  ],
  presets: {
    start: { state: { allowlist: false, scanDescriptions: false, pinHashes: false, scopedTokens: false, day: 1 }, expected: { reaching: ['pdf-tools', 'slack-mpc'], tokenExposed: true } },
    allow: { state: { allowlist: true, scanDescriptions: false, pinHashes: false, scopedTokens: false, day: 1 }, expected: { reaching: ['pdf-tools'], typosquatBlocked: true } },
    rug: { state: { allowlist: true, scanDescriptions: true, pinHashes: false, scopedTokens: true, day: 5 }, expected: { reaching: ['notes-mcp'], rugCaught: false } },
    locked: { state: { allowlist: true, scanDescriptions: true, pinHashes: true, scopedTokens: true, day: 7 }, expected: { reaching: [], rugCaught: true } },
  },
  initialPreset: 'start',
  simulate: simulateToolPoisoning,
  outputs: [
    { kind: 'itemList', title: 'Servers', items: (r) => r.servers.map((sv) => ({ label: 'MCP', text: sv.name, status: sv.status, tone: sv.kind === 'ok' ? 'ok' : sv.kind === 'blocked' ? 'mid' : 'no', flagged: sv.kind === 'poisoned' })) },
    { kind: 'value', label: 'Servers feeding hostile text to the model', value: (r) => String(r.reaching.length), emphasis: (r) => (r.reaching.length ? 'warn' : 'normal') },
    { kind: 'check', label: 'Look-alike kept out', value: (r) => r.typosquatBlocked },
    { kind: 'check', label: 'Shared full-access token not exposed', value: (r) => !r.tokenExposed },
  ],
  verdict: (r) => (r.reaching.length === 0
    ? { tone: 'ok', headline: 'Nothing hostile reaches the model.', detail: 'Allowlist, scanning, pinning and scoped tokens each close a gap.' }
    : { tone: 'no', headline: `${r.reaching.length} poisoned server${r.reaching.length > 1 ? 's' : ''} connected.`, detail: r.rugPulled && !r.rugCaught ? 'A connect-time check cannot see a later change; pin and hash descriptions.' : 'Review publishers and scan descriptions before connecting.' }),
  narrate: (r, s) => [
    `On day ${s.day}, ${r.reaching.length} server${r.reaching.length === 1 ? '' : 's'} with hostile descriptions ${r.reaching.length === 1 ? 'is' : 'are'} feeding text to the model.`,
    s.allowlist ? 'The allowlist keeps the look-alike slack-mpc out.' : s.scanDescriptions ? 'The scanner happens to flag the look-alike’s descriptions.' : 'Nothing stops the look-alike slack-mpc.',
    r.rugPulled ? (s.pinHashes ? 'notes-mcp changed its descriptions on day 3; the hash no longer matches, so it is blocked for review.' : 'notes-mcp changed its descriptions on day 3 and, with no pinning, the change went straight to the model.') : 'notes-mcp still looks fine; its update lands on day 3.',
    s.scopedTokens ? 'Each server holds only its own read scope.' : 'All servers share one full-access token, so any bad server can act as the user.',
  ].join(' '),
  missions: {
    typo: ({ result }) => result.typosquatBlocked,
    rug: ({ result }) => result.rugCaught,
    clean: ({ state, result }) => state.day === 7 && result.reaching.length === 0 && state.scopedTokens,
  },
});
