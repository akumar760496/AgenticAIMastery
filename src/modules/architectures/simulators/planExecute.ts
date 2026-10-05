/** ReAct vs plan-and-execute vs ReWOO for a five-step flight rebooking, with an optional failed step and replanning. */
export type Architecture = 'react' | 'pe' | 'rewoo';
export type ModelSize = 'large' | 'small';
export type CallKind = 'large' | 'small';

export interface PlanExecuteState { readonly architecture: Architecture; readonly planner: ModelSize; readonly executor: ModelSize; readonly stepFails: boolean; readonly replan: boolean }
export interface PlanExecuteResult { readonly calls: readonly CallKind[]; readonly largeCalls: number; readonly smallCalls: number; readonly tokens: number; readonly latencyS: number; readonly ok: boolean; readonly failure: string; readonly reactTokens: number; readonly ratio: number }

export function simulatePlanExecute(s: PlanExecuteState): PlanExecuteResult {
  const bigPlanner = s.planner === 'large';
  const fail = s.stepFails;
  const calls: CallKind[] = [];
  let tokens = 0; let latencyS = 0; let ok = true; let failure = '';
  const reactTokens = fail ? 27200 : 17400;
  if (s.architecture === 'react') {
    const n = fail ? 8 : 6;
    for (let i = 1; i <= n; i++) tokens += 1500 + 500 * (i - 1) + 150;
    for (let i = 0; i < n; i++) calls.push(bigPlanner ? 'large' : 'small');
    latencyS = n * (bigPlanner ? 2.5 : 0.9) + (fail ? 6 : 5) * 0.5;
    if (!bigPlanner) { ok = false; failure = 'The small model loses track of the fare difference and reissues the wrong ticket.'; }
  } else {
    calls.push(bigPlanner ? 'large' : 'small'); tokens += 2500; latencyS += bigPlanner ? 3 : 1.2;
    const executor: CallKind | 'tool' = s.architecture === 'pe' ? s.executor : 'tool';
    const steps = fail && s.replan ? 6 : fail ? 3 : 5;
    for (let i = 0; i < steps; i++) {
      if (executor !== 'tool') { calls.push(executor); tokens += 1200; latencyS += executor === 'large' ? 2.5 : 0.8; }
      latencyS += 0.5;
      if (fail && i === 2) {
        if (!s.replan) { ok = false; failure = 'Step 3 fails and nothing replans, so the run stops with no seat held.'; break; }
        calls.push(bigPlanner ? 'large' : 'small'); tokens += 3000; latencyS += bigPlanner ? 3 : 1.2;
      }
    }
    if (ok) { calls.push(bigPlanner ? 'large' : 'small'); tokens += s.architecture === 'pe' ? 2000 : 2500; latencyS += bigPlanner ? 2.5 : 0.9; }
    if (ok && !bigPlanner) { ok = false; failure = 'The small planner leaves out the fare-difference step, so the reissue is rejected.'; }
  }
  const largeCalls = calls.filter((c) => c === 'large').length;
  return { calls, largeCalls, smallCalls: calls.length - largeCalls, tokens, latencyS, ok, failure, reactTokens, ratio: tokens / reactTokens };
}
