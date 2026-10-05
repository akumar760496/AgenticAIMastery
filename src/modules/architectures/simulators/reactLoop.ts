/** A ReAct loop diagnosing a failed SIM swap: step cap, error handling and tool-result size. */
export type ResultVerbosity = 'full' | 'compact';
const SYSTEM_TOKENS = 1200;
const TURN_OUTPUT = 100;
const STEPS: readonly [string, string][] = [
  ['get_swap_request(98xxxxxx21)', 'req 55120 · provisioning failed'], ['get_kyc_status(55120)', 're-KYC passed'],
  ['get_provisioning_log(55120)', 'HLR update rejected: IMSI active'], ['raise_ticket(NOC, IMSI clash)', 'ticket NOC-8812'],
];

export interface ReactState { readonly cap: number; readonly errorsAsObservations: boolean; readonly verbosity: ResultVerbosity; readonly flakyTool: boolean }
export type TraceKind = 'ok' | 'error' | 'crash' | 'answer';
export interface TraceRow { readonly action: string; readonly observation: string; readonly kind: TraceKind; readonly tokens: number }
export interface ReactResult { readonly calls: number; readonly needed: number; readonly tokens: number; readonly trace: readonly TraceRow[]; readonly success: boolean; readonly crashed: boolean; readonly capped: boolean; readonly latencyS: number }

export function simulateReact(s: ReactState): ReactResult {
  const resultTokens = s.verbosity === 'compact' ? 120 : 1500;
  const plan: [string, string][] = [STEPS[0]!, STEPS[1]!];
  if (s.flakyTool) plan.push([STEPS[2]![0], 'error: timeout']);
  plan.push(STEPS[2]!, STEPS[3]!, ['answer', 'final reply to the customer']);
  const trace: TraceRow[] = [];
  let crashed = false; let calls = 0; let tokens = 0; let history = 0;
  for (let i = 0; i < plan.length && calls < s.cap; i++) {
    const [action, observation] = plan[i]!;
    calls++;
    const sent = SYSTEM_TOKENS + history + TURN_OUTPUT;
    tokens += sent;
    const isError = observation.startsWith('error');
    if (isError && !s.errorsAsObservations) { crashed = true; trace.push({ action, observation: 'exception raised: run aborted', kind: 'crash', tokens: sent }); break; }
    trace.push({ action, observation, kind: isError ? 'error' : action === 'answer' ? 'answer' : 'ok', tokens: sent });
    if (action !== 'answer') history += TURN_OUTPUT + (isError ? 40 : resultTokens);
  }
  const success = !crashed && calls === plan.length;
  return { calls, needed: plan.length, tokens, trace, success, crashed, capped: !crashed && !success, latencyS: calls * 1.5 + trace.filter((r) => r.action !== 'answer').length * 0.4 };
}
