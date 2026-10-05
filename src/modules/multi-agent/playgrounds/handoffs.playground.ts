import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { simulateHandoffs, type HandoffResult, type HandoffState } from '../simulators/handoffs';

export const handoffsPlayground = definePlayground<HandoffState, HandoffResult>({
  techniqueId: 'handoffs',
  title: 'Tarang Telecom triage (fictional)',
  intro: '20 sample chats go to recharge, porting or roaming. Each turn costs about 1.5k tokens; a chat needs 3 turns when it reaches the right specialist.',
  controls: [
    { kind: 'steps', key: 'overlapPct', label: 'Overlap between specialist descriptions', values: Array.from({ length: 11 }, (_, i) => i * 10), format: (v) => `${v}%` },
    { kind: 'select', key: 'context', label: 'What travels with the handoff', options: [{ value: 'none', label: 'Nothing: the specialist starts cold' }, { value: 'summary', label: 'A short free-text summary' }, { value: 'typed', label: 'A typed payload (input_type)' }, { value: 'full', label: 'The full history (14 messages)' }] },
    { kind: 'toggle', key: 'handBack', label: 'Specialists may hand back to triage' },
    { kind: 'steps', key: 'maxTurns', label: 'max_turns', values: Array.from({ length: 17 }, (_, i) => i + 4), format: String },
  ],
  presets: {
    start: { state: { overlapPct: 60, context: 'none', handBack: false, maxTurns: 10 }, expected: { routedCorrectly: 14, stuck: 6, repeats: 20, resolved: 14 } },
    clear: { state: { overlapPct: 10, context: 'none', handBack: false, maxTurns: 10 }, expected: { routedCorrectly: 19, repeats: 20, resolved: 19 } },
    full: { state: { overlapPct: 10, context: 'full', handBack: false, maxTurns: 10 }, expected: { repeats: 0, resolved: 19 } },
    pingpong: { state: { overlapPct: 80, context: 'summary', handBack: true, maxTurns: 20 }, expected: { resolved: 20, bounces: 4, handoffsPerChat: 4.2, repeats: 4 } },
  },
  initialPreset: 'start',
  simulate: simulateHandoffs,
  outputs: [
    { kind: 'badges', items: (r) => r.chats.map((c, i) => ({ text: `#${i + 1} ${c.misrouted ? '↺' : ''}${c.turns}t`, emphasis: !c.resolved || c.misrouted || c.repeated ? 'warn' as const : 'normal' as const })) },
    { kind: 'meter', label: 'Routing accuracy', value: (r) => r.accuracy, detail: (r) => `= ${r.routedCorrectly} of 20 sent to the right specialist first`, emphasis: (r) => (r.accuracy < 0.9 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Handoffs per chat', value: (r) => r.handoffsPerChat.toFixed(2) },
    { kind: 'value', label: 'Users asked to repeat details', value: (r) => String(r.repeats), emphasis: (r) => (r.repeats ? 'warn' : 'normal') },
    { kind: 'value', label: 'Chats resolved', value: (r) => `${r.resolved} of 20`, detail: (r) => [r.stuck ? `${r.stuck} stuck with the wrong agent` : '', r.exceeded ? `${r.exceeded} hit max_turns` : ''].filter(Boolean).join(' · ') || 'none stuck, none over the cap' },
    { kind: 'value', label: 'Tokens per resolved chat', value: (r) => (Number.isFinite(r.tokensPerResolvedK) ? `${r.tokensPerResolvedK.toFixed(1)}k` : 'n/a') },
  ],
  verdict: (r, s) => ({
    tone: r.resolved === 20 && r.repeats === 0 && r.handoffsPerChat <= 2 ? 'ok' : r.resolved < 17 ? 'no' : 'mid',
    headline: r.resolved === 20 ? 'Every chat resolved.' : `${20 - r.resolved} chats unresolved.`,
    detail: r.accuracy < 0.9 ? 'Overlapping descriptions misroute chats.' : r.repeats ? 'Users are repeating themselves.' : s.context === 'full' ? 'Full history works but carries 5.6k tokens per handoff.' : 'Routing and context are in good shape.',
  }),
  narrate: (r, s) => [
    `With ${s.overlapPct}% overlap between descriptions, triage routes ${r.routedCorrectly} of 20 chats correctly.`,
    r.routedCorrectly < 20 ? (s.handBack ? `The misrouted chats bounce ${r.bounces} times each before landing, raising handoffs to ${r.handoffsPerChat.toFixed(2)} per chat.` : 'The misrouted chats stay with the wrong specialist, because hand-backs are off.') : '',
    s.context === 'none' ? 'The specialist starts cold, so every user repeats their details.' : s.context === 'summary' ? `A free-text summary drops details in ${r.repeats} chats.` : s.context === 'typed' ? 'A typed payload carries the number, circle and issue, so nobody repeats anything.' : 'The full history avoids repeats but sends 14 messages with every handoff.',
    r.exceeded ? `${r.exceeded} chats ran past max_turns = ${s.maxTurns}.` : '',
    `${r.resolved} of 20 resolved.`,
  ].filter(Boolean).join(' '),
  missions: {
    route: ({ result }) => result.accuracy >= 0.9,
    norepeat: ({ state, result }) => result.repeats === 0 && state.context !== 'full',
    back: ({ state, result }) => state.handBack && result.handoffsPerChat <= 2 && result.resolved === 20,
  },
});
