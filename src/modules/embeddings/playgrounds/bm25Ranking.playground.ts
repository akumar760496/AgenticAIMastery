import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { joinWithAnd } from '@/shared/format';
import { AVERAGE_LENGTH, DOCUMENT_FREQUENCY, DOCUMENTS, QUERY_TERMS, idf, simulateBm25, type Bm25Result, type Bm25State } from '../simulators/bm25Ranking';

const terms = (e1045: boolean) => ({ e1045, login: true, error: true });

export const bm25Playground = definePlayground<Bm25State, Bm25Result>({
  techniqueId: 'bm25',
  title: 'Query terms',
  controls: [
    { kind: 'flagSet', key: 'terms', label: 'Terms in the query', options: QUERY_TERMS.map((t) => ({ value: t, label: `${t} (in ${DOCUMENT_FREQUENCY[t]} of 1,000 docs · IDF ${idf(t).toFixed(2)})` })) },
    { kind: 'steps', key: 'k1', label: 'k1, term-frequency saturation', values: Array.from({ length: 31 }, (_, i) => i / 10), format: (v) => v.toFixed(1) },
    { kind: 'steps', key: 'b', label: 'b, length normalisation', values: Array.from({ length: 21 }, (_, i) => i / 20), format: (v) => v.toFixed(2) },
    { kind: 'note', text: `Documents: ${DOCUMENTS.map((d) => `${d.id} ${d.name} (${d.length} words; e1045 ×${d.tf.e1045}, login ×${d.tf.login}, error ×${d.tf.error})`).join(' · ')}. Average length ${AVERAGE_LENGTH} words.` },
  ],
  presets: {
    start: { state: { terms: terms(false), k1: 1.2, b: 0.75 }, expected: { top: 'B' } },
    code: { state: { terms: terms(true), k1: 1.2, b: 0.75 }, expected: { top: 'A', second: 'B' } },
    nolen: { state: { terms: terms(false), k1: 1.2, b: 0 }, expected: { top: 'B', second: 'C' } },
    flat: { state: { terms: terms(true), k1: 3, b: 0.75 }, expected: { top: 'A', second: 'B' } },
  },
  initialPreset: 'start',
  simulate: simulateBm25,
  outputs: [
    { kind: 'itemList', title: 'BM25 ranking', items: (r) => r.ranking.map((d, i) => ({ label: `${i + 1}`, text: `${d.doc.id} · ${d.doc.name}`, status: d.score.toFixed(2), tone: i === 0 && d.score > 0 ? 'ok' : 'human', detail: d.contributions.length ? `= ${d.contributions.map((c) => `${c.term} ${c.score.toFixed(2)}`).join(' + ')}` : 'no query term matches' })) },
    { kind: 'value', label: 'Top document', value: (r) => r.top ?? 'none' },
  ],
  verdict: (r, s) => {
    const top = r.ranking[0];
    const detail = s.k1 === 0 ? 'With k1 = 0, a term counts once no matter how often it appears.' : s.b === 0 ? 'With b = 0, long documents are not penalised.' : 'Rare terms and short, focused documents score highest.';
    if (!r.activeTerms.length) return { tone: 'mid', headline: 'No query terms.', detail };
    if (r.top === 'A') return { tone: 'ok', headline: 'The runbook with the exact code ranks first.', detail };
    return { tone: 'mid', headline: r.ties > 1 ? `${r.ties} documents tie.` : `${top?.doc.name} ranks first.`, detail };
  },
  narrate: (r, s) => {
    const top = r.ranking[0];
    return [
      r.activeTerms.length ? `The query has ${r.activeTerms.length} term${r.activeTerms.length > 1 ? 's' : ''}: ${joinWithAnd(r.activeTerms)}.` : 'Pick at least one query term.',
      s.terms.e1045 ? `e1045 appears in only 3 of 1,000 documents, so its IDF of ${idf('e1045').toFixed(2)} dwarfs error (${idf('error').toFixed(2)}): any document containing the code jumps up.` : 'Without the error code, only the common words login and error count, and the documents that repeat them most do best.',
      s.k1 === 0 ? 'k1 = 0 turns term frequency off: one occurrence scores the same as twelve.' : s.k1 >= 2 ? `k1 = ${s.k1.toFixed(1)} saturates slowly, so repeated words keep adding score.` : `k1 = ${s.k1.toFixed(1)} saturates quickly, so repeats add less and less.`,
      s.b === 0 ? 'b = 0 switches off length normalisation, which helps the long blog post and release notes.' : `b = ${s.b.toFixed(2)} penalises documents longer than the ${AVERAGE_LENGTH}-word average.`,
      top && top.score > 0 ? `${top.doc.id} (${top.doc.name}) ranks first with ${top.score.toFixed(2)}.` : '',
    ].filter(Boolean).join(' ');
  },
  missions: {
    focus: ({ result }) => result.top === 'C' && !result.activeTerms.includes('e1045') && result.activeTerms.length === 2,
    tie: ({ state, result }) => state.k1 === 0 && result.ties >= 3,
    notes: ({ result }) => result.activeTerms.length === 3 && result.second === 'D',
  },
});
