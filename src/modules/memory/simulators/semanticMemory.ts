/** Semantic memory of an investor across five sessions: append-only vs reconciled, collection vs profile, top-k. */
export type StoreMode = 'append' | 'reconcile';
export type MemoryShape = 'collection' | 'profile';
export const STATEMENTS: readonly { readonly said: string; readonly key: string; readonly value: string }[] = [
  { said: 'I live in Pune', key: 'city', value: 'Pune' }, { said: 'Please reply in Hindi', key: 'lang', value: 'Hindi' },
  { said: 'My SIP is ₹5,000 a month', key: 'sip', value: '₹5,000' }, { said: 'Saving for my daughter’s college in 2034', key: 'goal', value: 'college 2034' },
  { said: 'I raised my SIP to ₹8,000', key: 'sip', value: '₹8,000' }, { said: 'My risk profile is moderate', key: 'risk', value: 'moderate' },
  { said: 'We moved to Bengaluru', key: 'city', value: 'Bengaluru' }, { said: 'English is fine now', key: 'lang', value: 'English' },
];
const QUESTIONS: readonly { readonly key: string; readonly text: string; readonly ranking: readonly number[]; readonly truth: string }[] = [
  { key: 'city', text: 'Where does the investor live?', ranking: [0, 6, 3, 5, 1, 7, 2, 4], truth: 'Bengaluru' },
  { key: 'lang', text: 'Which language should replies use?', ranking: [1, 7, 0, 6, 5, 3, 2, 4], truth: 'English' },
  { key: 'sip', text: 'What is the monthly SIP?', ranking: [3, 2, 4, 5, 0, 1, 6, 7], truth: '₹8,000' },
];
const TOKENS_PER_FACT = 60;
const PROFILE_HEADER = 40;

export interface SemanticMemoryState { readonly mode: StoreMode; readonly newestWins: boolean; readonly topK: number; readonly shape: MemoryShape }
export interface Answer { readonly question: string; readonly answer: string; readonly correct: boolean }
export interface SemanticMemoryResult { readonly stored: readonly number[]; readonly staleStored: number; readonly tokens: number; readonly answers: readonly Answer[]; readonly correct: number; readonly cityCorrect: boolean }

const isStale = (i: number) => STATEMENTS.slice(i + 1).some((x) => x.key === STATEMENTS[i]!.key);

export function simulateSemanticMemory(s: SemanticMemoryState): SemanticMemoryResult {
  const stored = s.mode === 'reconcile' ? [3, 4, 5, 6, 7] : [0, 1, 2, 3, 4, 5, 6, 7];
  const profile = s.shape === 'profile';
  const tokens = profile ? PROFILE_HEADER + TOKENS_PER_FACT * stored.length : TOKENS_PER_FACT * Math.min(s.topK, stored.length);
  const answers = QUESTIONS.map((q): Answer => {
    const candidates = profile ? stored : q.ranking.filter((i) => stored.includes(i)).slice(0, s.topK);
    const hits = candidates.filter((i) => STATEMENTS[i]!.key === q.key);
    if (!hits.length) return { question: q.text, answer: 'I don’t know', correct: false };
    if (hits.length === 1) { const a = STATEMENTS[hits[0]!]!.value; return { question: q.text, answer: a === q.truth ? a : `${a} (stale)`, correct: a === q.truth }; }
    if (s.newestWins) { const a = STATEMENTS[Math.max(...hits)]!.value; return { question: q.text, answer: a, correct: a === q.truth }; }
    return { question: q.text, answer: `${hits.map((i) => STATEMENTS[i]!.value).join(' or ')}?`, correct: false };
  });
  return { stored, staleStored: stored.filter(isStale).length, tokens, answers, correct: answers.filter((a) => a.correct).length, cityCorrect: answers[0]!.correct };
}
