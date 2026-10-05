/** Delegating to a garage chain's agent over A2A: Agent Card trust, task states and delivery mode. */
export type A2aTask = 'quick' | 'input' | 'long';
export type Delivery = 'poll' | 'stream' | 'push';
export type InputHandling = 'terminal' | 'answer';
export type TaskEnd = 'COMPLETED' | 'failed by client' | 'rejected';
const POLL_S = 5;
const QUESTION_AT_S = 6;
const AFTER_ANSWER_S = 8;
const DURATION_S: Readonly<Record<A2aTask, number>> = { quick: 2, input: 0, long: 42 };

export interface A2aState { readonly task: A2aTask; readonly delivery: Delivery; readonly onInput: InputHandling; readonly signed: boolean; readonly verify: boolean; readonly streaming: boolean; readonly push: boolean }
export interface A2aResult { readonly states: readonly string[]; readonly end: TaskEnd; readonly polls: number; readonly messages: number; readonly seenAtS: number; readonly delivery: Delivery; readonly fellBack: boolean; readonly passedInput: boolean }

export function simulateA2a(s: A2aState): A2aResult {
  const delivery: Delivery = (s.delivery === 'stream' && !s.streaming) || (s.delivery === 'push' && !s.push) ? 'poll' : s.delivery;
  const pollsTo = (from: number, t: number) => Math.ceil((t - from) / POLL_S);
  const states: string[] = [];
  let polls = 0; let messages = 0; let time = 0; let seen = 0;
  let end: TaskEnd | null = null;
  if (s.verify && !s.signed) end = 'rejected';
  else {
    messages = 1; states.push('WORKING');
    if (s.task !== 'input') time = DURATION_S[s.task];
    else {
      states.push('INPUT_REQUIRED');
      const questionSeen = delivery === 'poll' ? pollsTo(0, QUESTION_AT_S) * POLL_S : QUESTION_AT_S;
      if (delivery === 'poll') polls += pollsTo(0, QUESTION_AT_S);
      if (s.onInput === 'terminal') { end = 'failed by client'; time = questionSeen; }
      else { messages++; states.push('WORKING'); time = questionSeen + AFTER_ANSWER_S; seen = questionSeen; }
    }
    if (!end) { if (delivery === 'poll') polls += pollsTo(seen, time); states.push('COMPLETED'); end = 'COMPLETED'; }
    else states.push('FAILED');
  }
  const seenAtS = end === 'COMPLETED' && delivery === 'poll' ? seen + pollsTo(seen, time) * POLL_S : time;
  return { states, end, polls, messages, seenAtS, delivery, fellBack: delivery !== s.delivery, passedInput: states.includes('INPUT_REQUIRED') };
}
