/** tool_choice and argument validity in a UPI support loop with a 6-turn step cap. */
export type UserMessage = 'none' | 'one' | 'two';
export type ToolChoice = 'auto' | 'any' | 'tool' | 'none';
export type ForcingScope = 'first' | 'every';
export type ModelBehaviour = 'careful' | 'sloppy';
export type EndState = 'answered' | 'guessed' | 'stuck';
export const STEP_CAP = 6;
const FORCED_TOOL = 'get_transaction_status';
export const MESSAGES: Readonly<Record<UserMessage, { readonly text: string; readonly needs: readonly string[] }>> = {
  none: { text: '“Thanks, that’s all!”', needs: [] },
  one: { text: '“Did UTR 412345678901 go through?”', needs: ['get_transaction_status'] },
  two: { text: '“Was the refund for my failed payment sent?”', needs: ['get_transaction_status', 'get_refund_status'] },
};

export interface FunctionCallingState { readonly message: UserMessage; readonly toolChoice: ToolChoice; readonly scope: ForcingScope; readonly model: ModelBehaviour; readonly strict: boolean }
export interface TurnStep { readonly text: string; readonly tone: 'ok' | 'mid' | 'no' }
export interface FunctionCallingResult { readonly turns: number; readonly calls: number; readonly validShare: number; readonly wasted: number; readonly end: EndState; readonly trace: readonly TurnStep[]; readonly needed: number }

export function simulateFunctionCalling(s: FunctionCallingState): FunctionCallingResult {
  const need = MESSAGES[s.message].needs;
  const forced = s.toolChoice === 'any' || s.toolChoice === 'tool';
  const malformedFirst = s.model === 'sloppy' && !s.strict;
  const trace: TurnStep[] = [];
  const tried = new Set<string>();
  let calls = 0; let valid = 0; let wasted = 0; let done = 0; let turn = 0;
  let end: EndState = 'answered';
  while (turn < STEP_CAP) {
    turn++;
    const force = forced && (s.scope === 'every' || turn === 1);
    if (s.toolChoice === 'none') { trace.push({ text: `T${turn} → answer${need.length ? ' without data' : ''}`, tone: need.length ? 'no' : 'ok' }); end = need.length ? 'guessed' : 'answered'; break; }
    if (done < need.length) {
      const name = s.toolChoice === 'tool' && force ? FORCED_TOOL : need[done]!;
      if (s.toolChoice === 'tool' && force && name !== need[done]) { calls++; valid++; wasted++; trace.push({ text: `T${turn} → ${name} again`, tone: 'mid' }); continue; }
      calls++;
      if (malformedFirst && !tried.has(name)) { tried.add(name); trace.push({ text: `T${turn} → ${name} ✗ args`, tone: 'no' }); continue; }
      valid++; done++; trace.push({ text: `T${turn} → ${name} ✓`, tone: 'ok' }); continue;
    }
    if (force) {
      const name = s.toolChoice === 'tool' ? FORCED_TOOL : need[0] ?? FORCED_TOOL;
      calls++; wasted++;
      if (malformedFirst && !tried.has(name)) { tried.add(name); trace.push({ text: `T${turn} → ${name} ✗ args`, tone: 'no' }); }
      else { valid++; trace.push({ text: `T${turn} → ${name}${need.length ? ' again' : ' (no UTR)'}`, tone: 'mid' }); }
      continue;
    }
    trace.push({ text: `T${turn} → answer`, tone: 'ok' }); end = 'answered'; break;
  }
  if (turn >= STEP_CAP && !/answer/.test(trace[trace.length - 1]?.text ?? '')) end = 'stuck';
  return { turns: turn, calls, validShare: calls ? valid / calls : 1, wasted, end, trace, needed: need.length };
}
