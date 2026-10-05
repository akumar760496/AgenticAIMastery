import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatFixed, formatWholePercent } from '@/shared/format';
import { simulateLongContext, type LongContextResult, type LongContextState } from '../simulators/longContext';

const isBest = (r: LongContextResult) => r.accuracy >= 0.88 && r.costPerQuestion <= 10 && r.citeRate >= 0.85;

export const longContextPlayground = definePlayground<LongContextState, LongContextResult>({
  techniqueId: 'longctx',
  title: 'Question Kosh Finance’s loan bundle',
  intro: '400 pages, about 2,50,000 tokens. 50 test questions: 30 single facts and 20 that need clauses from two or more documents. Input costs about ₹0.25 per 1,000 tokens; cached reads cost a tenth.',
  controls: [
    { kind: 'select', key: 'approach', label: 'Approach', options: [{ value: 'stuff', label: 'Put the whole bundle in the prompt' }, { value: 'retrieve', label: 'Retrieve the top 20 chunks' }, { value: 'quote', label: 'Whole bundle + quote first, then answer' }] },
    { kind: 'select', key: 'placement', label: 'Question goes', options: [{ value: 'after', label: 'After the documents' }, { value: 'before', label: 'Before the documents' }] },
    { kind: 'toggle', key: 'cache', label: 'Cache the document prefix' },
    { kind: 'toggle', key: 'tags', label: 'Wrap each document in tags with source and pages' },
  ],
  presets: {
    start: { state: { approach: 'stuff', placement: 'after', cache: false, tags: false }, expected: { accuracy: 0.796, costPerQuestion: 62.5, latencyS: 20 } },
    retrieve: { state: { approach: 'retrieve', placement: 'after', cache: false, tags: true }, expected: { accuracy: 0.764, multiHop: 0.56, costPerQuestion: 2.5 } },
    quote: { state: { approach: 'quote', placement: 'after', cache: true, tags: true }, expected: { accuracy: 0.892, multiHop: 0.85, costPerQuestion: 8.375, latencyS: 8 } },
    cached: { state: { approach: 'stuff', placement: 'after', cache: true, tags: false }, expected: { accuracy: 0.796, costPerQuestion: 7.375, latencyS: 6 } },
  },
  initialPreset: 'start',
  simulate: simulateLongContext,
  outputs: [
    { kind: 'meter', label: 'Accuracy on 50 questions', value: (r) => r.accuracy, emphasis: (r) => (r.accuracy < 0.85 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Single facts', value: (r) => r.single, detail: () => '30 questions' },
    { kind: 'meter', label: 'Multi-hop', value: (r) => r.multiHop, detail: () => '20 questions', emphasis: (r) => (r.multiHop < 0.65 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Cost per question', value: (r) => `₹${formatFixed(r.costPerQuestion, 1)}`, detail: () => 'averaged over the 50 questions', emphasis: (r) => (r.costPerQuestion > 20 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Time to answer', value: (r) => `${r.latencyS} s` },
    { kind: 'value', label: 'Correct answers citing the right clause', value: (r) => formatWholePercent(r.citeRate) },
  ],
  verdict: (r) => {
    if (isBest(r)) return { tone: 'ok', headline: 'Accurate, checkable and affordable.', detail: 'Quotes carry the multi-hop questions; the cache carries the cost.' };
    const tone = r.accuracy < 0.75 ? 'no' : 'mid';
    if (r.costPerQuestion > 20) return { tone, headline: 'Right idea, wrong bill.', detail: 'Cache the document prefix.' };
    if (r.multiHop < 0.65) return { tone, headline: 'Multi-hop questions fail.', detail: 'Twenty chunks rarely hold both clauses a multi-hop question needs.' };
    if (r.citeRate < 0.85) return { tone, headline: 'Answers are hard to check.', detail: 'Tag documents with source and pages.' };
    return { tone, headline: 'Close, but not there yet.', detail: 'Ask for quotes before the answer.' };
  },
  narrate: (r, s) => [
    s.approach === 'retrieve' ? 'Retrieving the top 20 chunks is cheap and quick, and single facts do well, but multi-hop questions often need a clause that did not make the top 20.'
      : s.approach === 'quote' ? 'The whole bundle goes in and the model quotes the relevant clauses before answering, which lifts multi-hop questions the most.'
        : 'The whole bundle goes in, so every clause is available, but the model must find it among 2,50,000 tokens.',
    s.placement === 'before' ? 'With the question at the top, the model reads the documents without knowing what to look for, and accuracy drops.' : '',
    s.approach !== 'retrieve' ? (s.cache ? 'The cached prefix makes later questions cost about a tenth.' : 'Without caching, every question pays about ₹62.5 for the same documents.') : '',
    s.tags ? 'Tags let answers cite the right document and page.' : 'Without tags, answers rarely say where a clause came from.',
    `Overall accuracy is ${formatWholePercent(r.accuracy)} at ₹${formatFixed(r.costPerQuestion, 1)} a question.`,
  ].filter(Boolean).join(' '),
  missions: {
    best: ({ result }) => isBest(result),
    order: ({ state }) => state.placement === 'before' && state.approach !== 'retrieve',
    multi: ({ state, result }) => state.approach === 'retrieve' && result.multiHop < 0.6,
  },
});
