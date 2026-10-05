/** One MCP request to a folio-lookup server: transport, method, token, multi-round input and list caching. */
export type Transport = 'http' | 'stdio';
export type McpMethod = 'server/discover' | 'tools/list' | 'tools/call' | 'resources/read';
export type FolioTool = 'read' | 'write';
export type AccessToken = 'none' | 'aud' | 'read' | 'write';
export type Outcome = 'ok' | 'cache' | 'deny';
const LIST_TTL_S = 300;
const RESOURCE_METADATA = 'https://mcp.example-rta.in/.well-known/oauth-protected-resource';

export interface McpState { readonly transport: Transport; readonly method: McpMethod; readonly tool: FolioTool; readonly token: AccessToken; readonly withInputResponses: boolean; readonly clientCache: boolean; readonly trustedServer: boolean; readonly secondsSinceList: number }
export interface McpResult { readonly status: number | null; readonly outcome: Outcome; readonly resultType: string | null; readonly header: string; readonly request: string; readonly response: string; readonly askUser: boolean; readonly fromCache: boolean }

const json = (o: unknown) => JSON.stringify(o, null, 1);

export function simulateMcp(s: McpState): McpResult {
  const http = s.transport === 'http';
  const call = s.method === 'tools/call';
  const write = call && s.tool === 'write';
  const meta = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientInfo': { name: 'support-assistant', version: '3.2' } };
  const params: Record<string, unknown> = call
    ? { name: write ? 'update_nominee' : 'get_folio_summary', arguments: write ? { folio: '12345678/90', nominee: 'R. Iyer' } : { folio: '12345678/90' } }
    : s.method === 'resources/read' ? { uri: 'folio://schemes/EQ-FLEXI' } : {};
  if (write && s.withInputResponses) Object.assign(params, { inputResponses: { confirm: { action: 'accept', content: { confirm: true } } }, requestState: 'eyJ…signed' });
  params._meta = meta;
  const req = { jsonrpc: '2.0', id: s.withInputResponses && write ? 8 : 7, method: s.method, params };

  let status: number | null = http ? 200 : null;
  let outcome: Outcome = 'ok';
  let header = '';
  let result: Record<string, unknown> | null = null;
  const fromCache = s.method === 'tools/list' && s.clientCache && s.secondsSinceList < LIST_TTL_S;
  if (fromCache) { outcome = 'cache'; status = null; }
  else if (http && s.token === 'none') { status = 401; outcome = 'deny'; header = `WWW-Authenticate: Bearer resource_metadata="${RESOURCE_METADATA}"`; }
  else if (http && s.token === 'aud') { status = 401; outcome = 'deny'; header = 'WWW-Authenticate: Bearer error="invalid_token" (audience is not this server)'; }
  else if (http && write && s.token === 'read') { status = 403; outcome = 'deny'; header = 'WWW-Authenticate: Bearer error="insufficient_scope", scope="folio:write"'; }
  if (outcome === 'ok') {
    if (s.method === 'server/discover') result = { resultType: 'complete', capabilities: { tools: {}, resources: {}, prompts: {} }, _meta: { 'io.modelcontextprotocol/serverInfo': { name: 'folio-lookup', version: '1.4.0' } } };
    else if (s.method === 'tools/list') result = { resultType: 'complete', tools: [{ name: 'get_folio_summary', annotations: { readOnlyHint: true } }, { name: 'update_nominee', annotations: { destructiveHint: true } }], ttlMs: LIST_TTL_S * 1000, cacheScope: 'private' };
    else if (s.method === 'resources/read') result = { resultType: 'complete', contents: [{ uri: 'folio://schemes/EQ-FLEXI', mimeType: 'text/plain', text: 'Flexi-cap equity scheme · expense ratio 0.72%' }], ttlMs: 3600000, cacheScope: 'private' };
    else if (!write) result = { resultType: 'complete', structuredContent: { folio: '12345678/90', schemes: ['EQ-FLEXI', 'DEBT-ST'], units: 1843.216, nav_date: '2026-09-25' }, isError: false };
    // The server keeps no state: a retry that echoes requestState with the user's answer completes the write.
    else if (s.withInputResponses) result = { resultType: 'complete', content: [{ type: 'text', text: 'Nominee for folio 12345678/90 updated to R. Iyer.' }], isError: false };
    else result = { resultType: 'input_required', inputRequests: { confirm: { method: 'elicitation/create', params: { mode: 'form', message: 'Change the nominee on folio 12345678/90 to R. Iyer?', requestedSchema: { type: 'object', properties: { confirm: { type: 'boolean' } }, required: ['confirm'] } } } }, requestState: 'eyJ…signed' };
  }
  return {
    status, outcome, header, fromCache,
    resultType: result ? String(result.resultType) : null,
    request: fromCache ? '(none: served from the client cache)' : json(req),
    response: fromCache ? '(no request sent)' : result ? json({ jsonrpc: '2.0', id: req.id, result }) : header,
    askUser: call && (write || !s.trustedServer) && outcome === 'ok',
  };
}
