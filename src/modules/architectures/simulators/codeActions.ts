/** JSON tool calls vs code actions for reconciling 200 orders, and where model-written code runs. */
export type ActionFormat = 'json' | 'code';
export type Sandbox = 'none' | 'container' | 'strict';
export type Incident = 'none' | 'data sent out' | '1 unintended write';

export interface CodeActionState { readonly format: ActionFormat; readonly sandbox: Sandbox }
export interface CodeActionResult { readonly turns: number; readonly tokens: number; readonly minutes: number; readonly success: number; readonly incident: Incident; readonly costInr: number }

export function simulateCodeActions(s: CodeActionState): CodeActionResult {
  const code = s.format === 'code';
  const tokens = code ? 60000 : 3600000;
  const incident: Incident = !code ? 'none' : s.sandbox === 'none' ? 'data sent out' : s.sandbox === 'container' ? '1 unintended write' : 'none';
  return { turns: code ? 6 : 600, tokens, minutes: code ? 2 : 20, success: code ? 0.96 : 0.88, incident, costInr: (tokens / 1000) * 0.25 + (code && s.sandbox !== 'none' ? 2 : 0) };
}
