/** Triage handoffs across 20 telecom chats: description overlap, what context travels, hand-backs and max_turns. */
export type HandoffContext = 'none' | 'summary' | 'typed' | 'full';
const CONTEXT_TOKENS_K: Readonly<Record<HandoffContext, number>> = { none: 0, summary: 0.8, typed: 0.2, full: 5.6 };
const CHATS = 20;
const TURN_K = 1.5;

export interface HandoffState { readonly overlapPct: number; readonly context: HandoffContext; readonly handBack: boolean; readonly maxTurns: number }
export interface ChatOutcome { readonly turns: number; readonly misrouted: boolean; readonly repeated: boolean; readonly resolved: boolean; readonly note: string }
export interface HandoffResult { readonly chats: readonly ChatOutcome[]; readonly routedCorrectly: number; readonly accuracy: number; readonly bounces: number; readonly handoffsPerChat: number; readonly repeats: number; readonly resolved: number; readonly exceeded: number; readonly stuck: number; readonly tokensPerResolvedK: number }

export function simulateHandoffs(s: HandoffState): HandoffResult {
  const routedCorrectly = Math.round(CHATS * (1 - (0.5 * s.overlapPct) / 100));
  const bounces = Math.min(4, 1 + Math.floor((s.overlapPct / 100) * 4));
  let handoffs = 0; let tokens = 0;
  const chats: ChatOutcome[] = [];
  for (let i = 0; i < CHATS; i++) {
    const misrouted = i >= routedCorrectly;
    // A cold start makes every user repeat; a free-text summary drops details in one chat in five.
    const repeated = s.context === 'none' || (s.context === 'summary' && i % 5 === 0);
    let turns = 3 + (repeated ? 3 : 0); let h = 1; let resolved = true; let note = 'resolved';
    if (misrouted) { if (s.handBack) { h = 1 + 2 * bounces; turns += 2 * bounces; note = 'bounced back'; } else { resolved = false; note = 'stuck with the wrong agent'; } }
    if (resolved && turns > s.maxTurns) { resolved = false; note = 'MaxTurnsExceeded'; }
    handoffs += h; tokens += turns * TURN_K + h * CONTEXT_TOKENS_K[s.context];
    chats.push({ turns, misrouted, repeated, resolved, note });
  }
  const resolved = chats.filter((c) => c.resolved).length;
  return {
    chats, routedCorrectly, accuracy: routedCorrectly / CHATS, bounces, handoffsPerChat: handoffs / CHATS,
    repeats: chats.filter((c) => c.repeated).length, resolved,
    exceeded: chats.filter((c) => c.note === 'MaxTurnsExceeded').length, stuck: chats.filter((c) => c.note.startsWith('stuck')).length,
    tokensPerResolvedK: resolved ? tokens / resolved : Infinity,
  };
}
