import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { simulateMcp, type McpResult, type McpState } from '../simulators/mcpProtocol';

const base: McpState = { transport: 'http', method: 'tools/call', tool: 'read', token: 'none', withInputResponses: false, clientCache: false, trustedServer: false, secondsSinceList: 120 };

export const mcpProtocolPlayground = definePlayground<McpState, McpResult>({
  techniqueId: 'mcp',
  title: 'folio-lookup MCP server (fictional RTA) · revision 2026-07-28',
  controls: [
    { kind: 'select', key: 'transport', label: 'Transport', options: [{ value: 'http', label: 'Streamable HTTP (remote)' }, { value: 'stdio', label: 'stdio (local process)' }] },
    { kind: 'select', key: 'method', label: 'Method', options: ['server/discover', 'tools/list', 'tools/call', 'resources/read'].map((m) => ({ value: m, label: m })) },
    { kind: 'select', key: 'tool', label: 'Tool (for tools/call)', options: [{ value: 'read', label: 'get_folio_summary · readOnlyHint' }, { value: 'write', label: 'update_nominee · destructiveHint' }] },
    { kind: 'select', key: 'token', label: 'Access token (HTTP only)', options: [{ value: 'none', label: 'none' }, { value: 'aud', label: 'valid, but issued for another server' }, { value: 'read', label: 'valid · scope folio:read' }, { value: 'write', label: 'valid · scopes folio:read folio:write' }] },
    { kind: 'toggle', key: 'withInputResponses', label: 'Retry with inputResponses and requestState' },
    { kind: 'toggle', key: 'clientCache', label: 'Client caches list results for ttlMs' },
    { kind: 'toggle', key: 'trustedServer', label: 'Server is trusted (first-party, reviewed)' },
    { kind: 'steps', key: 'secondsSinceList', label: 'Seconds since the last tools/list', values: Array.from({ length: 21 }, (_, i) => i * 30), format: (v) => `${v} s` },
  ],
  presets: {
    start: { state: base, expected: { status: 401, outcome: 'deny' } },
    scope: { state: { ...base, tool: 'write', token: 'read' }, expected: { status: 403 } },
    mrtr: { state: { ...base, tool: 'write', token: 'write', trustedServer: true }, expected: { status: 200, resultType: 'input_required' } },
    local: { state: { ...base, transport: 'stdio', method: 'tools/list', trustedServer: true, secondsSinceList: 420 }, expected: { status: null, resultType: 'complete', fromCache: false } },
  },
  initialPreset: 'start',
  simulate: simulateMcp,
  outputs: [
    { kind: 'code', label: 'Request', value: (r) => r.request },
    { kind: 'code', label: 'Response', value: (r) => (r.status ? `HTTP ${r.status}\n` : '') + r.response },
    { kind: 'value', label: 'resultType', value: (r) => (r.fromCache ? 'cached' : r.resultType ?? 'none (HTTP error)') },
    { kind: 'check', label: 'Host must ask the user first', value: (r) => r.askUser },
  ],
  verdict: (r, s) => {
    if (r.outcome === 'deny') return r.status === 403
      ? { tone: 'no', headline: 'Authenticated, but not allowed.', detail: 'Step up: ask the user to grant folio:write, then retry.' }
      : { tone: 'no', headline: 'Not authenticated.', detail: s.token === 'none' ? 'The 401 points to the protected resource metadata, where the client finds the authorization server.' : 'A token for another audience must be rejected, never accepted or forwarded.' };
    if (r.fromCache) return { tone: 'ok', headline: 'Served from cache.', detail: `The last list is ${s.secondsSinceList} s old, within its 300 s ttlMs.` };
    if (r.resultType === 'input_required') return { tone: 'mid', headline: 'The server needs input.', detail: 'Ask the user, then retry the same request with inputResponses and the requestState echoed back.' };
    return { tone: 'ok', headline: 'Complete.', detail: s.transport === 'stdio' ? 'stdio: the server runs locally with credentials from its environment.' : 'The token was issued for this server and carries the needed scope.' };
  },
  narrate: (r, s) => [
    `The ${s.transport === 'http' ? 'client POSTs a JSON-RPC request over Streamable HTTP' : 'host writes a JSON-RPC request to the local server’s stdin'}, with the protocol version in _meta and no session or handshake.`,
    r.fromCache ? `The previous tools/list said ttlMs 300000, and it is only ${s.secondsSinceList} s old, so the client reuses it and sends nothing.`
      : r.outcome === 'deny' ? (r.status === 403 ? 'The token is valid but lacks folio:write, so the server answers 403 insufficient_scope; the client can ask for more consent and retry.' : s.token === 'aud' ? 'The token was issued for another server, so this server must reject it; accepting it would let any service replay tokens here.' : 'There is no token, so the server answers 401 and points to its protected resource metadata.')
        : r.resultType === 'input_required' ? 'The write needs the user’s confirmation, so the server returns input_required with an elicitation and an opaque requestState, keeping no state itself.'
          : s.method === 'tools/call' && s.tool === 'write' ? 'The retry carries the user’s answer and the echoed requestState, so the server completes the change.' : 'The request succeeds.',
    r.askUser ? 'The host asks the user before running this call.' : '',
  ].filter(Boolean).join(' '),
  missions: {
    stepup: ({ state, result }) => state.transport === 'http' && state.method === 'tools/call' && state.tool === 'write' && state.token === 'write' && result.status === 200,
    mrtr: ({ state, result }) => state.method === 'tools/call' && state.tool === 'write' && state.withInputResponses && result.resultType === 'complete',
    cache: ({ state, result }) => state.method === 'tools/list' && result.fromCache,
  },
});
