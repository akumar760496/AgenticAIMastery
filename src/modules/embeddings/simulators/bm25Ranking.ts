/** BM25 over four documents: IDF of rare terms, k1 saturation and b length normalisation. */
export type QueryTerm = 'e1045' | 'login' | 'error';
export const QUERY_TERMS: readonly QueryTerm[] = ['e1045', 'login', 'error'];
export const CORPUS_SIZE = 1000;
export const AVERAGE_LENGTH = 150;
export const DOCUMENT_FREQUENCY: Readonly<Record<QueryTerm, number>> = { e1045: 3, login: 120, error: 300 };

export interface Bm25Document { readonly id: string; readonly name: string; readonly length: number; readonly tf: Readonly<Record<QueryTerm, number>> }
export const DOCUMENTS: readonly Bm25Document[] = [
  { id: 'A', name: 'kb/E1045-fix.md', length: 40, tf: { e1045: 2, login: 1, error: 1 } },
  { id: 'B', name: 'blog/login-errors.md', length: 420, tf: { e1045: 0, login: 10, error: 12 } },
  { id: 'C', name: 'kb/login-help.md', length: 90, tf: { e1045: 0, login: 4, error: 1 } },
  { id: 'D', name: 'release-notes-v5.md', length: 300, tf: { e1045: 1, login: 0, error: 3 } },
];

export const idf = (t: QueryTerm) => Math.log(1 + (CORPUS_SIZE - DOCUMENT_FREQUENCY[t] + 0.5) / (DOCUMENT_FREQUENCY[t] + 0.5));

export interface Bm25State { readonly terms: Readonly<Record<QueryTerm, boolean>>; readonly k1: number; readonly b: number }
export interface ScoredDocument { readonly doc: Bm25Document; readonly score: number; readonly contributions: readonly { readonly term: QueryTerm; readonly score: number }[] }
export interface Bm25Result {
  readonly ranking: readonly ScoredDocument[];
  readonly activeTerms: readonly QueryTerm[];
  readonly top: string | null;
  readonly second: string | null;
  readonly ties: number;
}

export function simulateBm25(s: Bm25State): Bm25Result {
  const activeTerms = QUERY_TERMS.filter((t) => s.terms[t]);
  const ranking = DOCUMENTS.map((doc): ScoredDocument => {
    const norm = s.k1 * (1 - s.b + (s.b * doc.length) / AVERAGE_LENGTH);
    const contributions = activeTerms.filter((t) => doc.tf[t] > 0).map((term) => {
      const f = doc.tf[term];
      return { term, score: (idf(term) * f * (s.k1 + 1)) / (f + norm) };
    });
    return { doc, score: Math.round(contributions.reduce((a, c) => a + c.score, 0) * 1000) / 1000, contributions };
  }).sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id));
  const first = ranking[0];
  return {
    ranking, activeTerms,
    top: first && first.score > 0 ? first.doc.id : null,
    second: ranking[1] && ranking[1].score > 0 ? ranking[1].doc.id : null,
    ties: first ? ranking.filter((r) => r.score > 0 && Math.abs(r.score - first.score) < 1e-6).length : 0,
  };
}
