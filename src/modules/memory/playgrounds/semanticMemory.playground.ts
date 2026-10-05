import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { STATEMENTS, simulateSemanticMemory, type SemanticMemoryResult, type SemanticMemoryState } from '../simulators/semanticMemory';

const st = (mode: SemanticMemoryState['mode'], topK: number, shape: SemanticMemoryState['shape']): SemanticMemoryState => ({ mode, newestWins: false, topK, shape });

export const semanticMemoryPlayground = definePlayground<SemanticMemoryState, SemanticMemoryResult>({
  techniqueId: 'semmem',
  title: 'What the investor said, sessions 1 to 5',
  intro: 'Each fact costs about 60 tokens in the prompt; a profile adds a 40-token header and is always injected whole.',
  controls: [
    { kind: 'select', key: 'mode', label: 'Store', options: [{ value: 'append', label: 'append-only' }, { value: 'reconcile', label: 'reconcile (ADD / UPDATE / DELETE)' }] },
    { kind: 'toggle', key: 'newestWins', label: 'Newest fact wins when retrieved facts conflict' },
    { kind: 'select', key: 'shape', label: 'Shape', options: [{ value: 'collection', label: 'collection of facts' }, { value: 'profile', label: 'one profile document' }] },
    { kind: 'steps', key: 'topK', label: 'Top-k facts per question', values: [1, 2, 3, 4, 5, 6, 7, 8], format: String },
  ],
  presets: {
    start: { state: st('append', 3, 'collection'), expected: { correct: 0, tokens: 180, staleStored: 3 } },
    profile: { state: st('append', 3, 'profile'), expected: { correct: 0, tokens: 520 } },
    reconcile: { state: st('reconcile', 1, 'collection'), expected: { correct: 2, tokens: 60, staleStored: 0 } },
    rprofile: { state: st('reconcile', 3, 'profile'), expected: { correct: 3, tokens: 340, staleStored: 0 } },
  },
  initialPreset: 'start',
  simulate: simulateSemanticMemory,
  outputs: [
    { kind: 'badges', items: (r) => r.stored.map((i) => ({ text: `${STATEMENTS[i]!.key} = ${STATEMENTS[i]!.value}`, emphasis: STATEMENTS.slice(i + 1).some((x) => x.key === STATEMENTS[i]!.key) ? 'warn' : 'normal' })) },
    { kind: 'itemList', title: 'Answers', items: (r) => r.answers.map((a) => ({ label: '?', text: a.question, status: a.answer, tone: a.correct ? 'ok' : 'no' })) },
    { kind: 'value', label: 'Stale facts stored', value: (r) => String(r.staleStored), emphasis: (r) => (r.staleStored ? 'warn' : 'normal') },
    { kind: 'value', label: 'Injected tokens per question', value: (r) => String(r.tokens) },
  ],
  verdict: (r) => ({ tone: r.correct === 3 && r.tokens < 300 ? 'ok' : r.correct === 3 ? 'mid' : 'no', headline: `${r.correct} of 3 answers right.`, detail: r.correct === 3 ? (r.tokens < 300 ? 'Current facts, few tokens.' : 'Right, but the prompt carries more than it needs.') : 'Stale, conflicting or missing facts reached the model.' }),
  narrate: (r, s) => [
    `The store holds ${r.stored.length} facts, ${r.staleStored} of them stale.`,
    s.mode === 'append' ? 'Append-only keeps both the old and the new city, language and SIP amount.' : 'Reconciliation turned the move, the SIP change and the language change into updates, so only current facts remain.',
    s.shape === 'profile' ? `The profile is injected whole: ${r.tokens} tokens.` : `Each question retrieves the top ${s.topK} facts, ${r.tokens} tokens.`,
    `The assistant says the investor lives in ${r.answers[0]!.answer.replace(' (stale)', '')}${r.cityCorrect ? ', which is right' : ', which is wrong'}.`,
    s.mode === 'append' && s.newestWins ? 'Newest-wins fixes answers when both facts are retrieved, but the stale facts are still stored.' : '',
  ].filter(Boolean).join(' '),
  missions: {
    city: ({ result }) => result.cityCorrect,
    stale: ({ result }) => result.staleStored === 0,
    lean: ({ result }) => result.correct === 3 && result.tokens < 300,
  },
});
