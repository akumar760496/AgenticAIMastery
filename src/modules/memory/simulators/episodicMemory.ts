/** Episodic retrieval scored by recency, importance and relevance (each min-max normalised), with optional reflection. */
export const EPISODES: readonly { readonly name: string; readonly ageHours: number; readonly importance: number; readonly relevance: number; readonly target?: boolean }[] = [
  { name: 'PAN lookup timed out at month-end', ageHours: 504, importance: 8, relevance: 0.92, target: true },
  { name: 'Customer said thanks', ageHours: 1, importance: 1, relevance: 0.1 }, { name: 'Balance enquiry answered', ageHours: 2, importance: 2, relevance: 0.2 },
  { name: 'PAN verified on first try', ageHours: 120, importance: 3, relevance: 0.8 }, { name: 'Address change completed', ageHours: 30, importance: 4, relevance: 0.25 },
  { name: 'UPI mandate failed: bank down', ageHours: 200, importance: 7, relevance: 0.35 }, { name: 'KYC photo blurred, asked re-upload', ageHours: 72, importance: 5, relevance: 0.45 },
  { name: 'Bureau pull timed out', ageHours: 336, importance: 6, relevance: 0.7 }, { name: 'Password reset', ageHours: 6, importance: 2, relevance: 0.12 },
  { name: 'SIP date changed', ageHours: 48, importance: 3, relevance: 0.18 }, { name: 'Nominee added', ageHours: 400, importance: 3, relevance: 0.15 },
  { name: 'Aadhaar OTP not received', ageHours: 150, importance: 6, relevance: 0.55 },
];
const RECENCY_DECAY_PER_HOUR = 0.995;
const TRANSCRIPT_TOKENS = 350;
const LESSON_TOKENS = 60;

export interface EpisodicState { readonly recencyWeight: number; readonly importanceWeight: number; readonly relevanceWeight: number; readonly topK: number; readonly reflection: boolean }
export interface RankedEpisode { readonly name: string; readonly recency: number; readonly importance: number; readonly relevance: number; readonly score: number; readonly target: boolean; readonly trivial: boolean }
export interface EpisodicResult { readonly ranking: readonly RankedEpisode[]; readonly retrieved: boolean; readonly targetRank: number; readonly tokens: number; readonly startTokens: number; readonly firstTrivial: boolean; readonly first: string }

const minMax = (a: readonly number[]) => { const lo = Math.min(...a); const hi = Math.max(...a); return a.map((v) => (v - lo) / (hi - lo)); };
const RECENCY = minMax(EPISODES.map((e) => Math.pow(RECENCY_DECAY_PER_HOUR, e.ageHours)));
const IMPORTANCE = minMax(EPISODES.map((e) => e.importance));
const RELEVANCE = minMax(EPISODES.map((e) => e.relevance));
const tokensFor = (k: number, reflection: boolean) => (reflection ? LESSON_TOKENS : TRANSCRIPT_TOKENS) * k;
export const EPISODIC_START: EpisodicState = { recencyWeight: 3, importanceWeight: 1, relevanceWeight: 1, topK: 3, reflection: false };

export function simulateEpisodic(s: EpisodicState): EpisodicResult {
  const rows = EPISODES.map((e, i) => ({ i, name: e.name, recency: RECENCY[i]!, importance: IMPORTANCE[i]!, relevance: RELEVANCE[i]!, score: s.recencyWeight * RECENCY[i]! + s.importanceWeight * IMPORTANCE[i]! + s.relevanceWeight * RELEVANCE[i]!, target: Boolean(e.target), trivial: e.importance <= 2 }));
  const ranking = rows.sort((a, b) => b.score - a.score || a.i - b.i);
  const targetRank = ranking.findIndex((r) => r.target) + 1;
  return {
    ranking, retrieved: targetRank <= s.topK, targetRank,
    tokens: tokensFor(s.topK, s.reflection), startTokens: tokensFor(EPISODIC_START.topK, EPISODIC_START.reflection),
    firstTrivial: ranking[0]!.trivial, first: ranking[0]!.name,
  };
}
