import { definePlayground, type Emphasis } from '@/domain/playground/PlaygroundDefinition';
import { formatWholePercent, joinWithAnd, pluralise } from '@/shared/format';
import { CHUNKS, simulateRagMetrics, type RagMetricsResult, type RagMetricsState } from '../simulators/ragMetrics';

const retrieved = (c1: boolean, c2: boolean, c3: boolean, c4: boolean, includeHallucination: boolean): RagMetricsState => ({
  retrieved: { C1: c1, C2: c2, C3: c3, C4: c4 }, includeHallucination,
});
const emphasisBelow = (threshold: number) => (value: number): Emphasis => (value < threshold ? 'warn' : 'normal');

export const ragMetricsPlayground = definePlayground<RagMetricsState, RagMetricsResult>({
  techniqueId: 'rag',
  title: 'Grade one NEFT answer',
  intro: '“NEFT settles every 30 minutes, is available 24x7 and runs on bank holidays too.”',
  controls: [
    { kind: 'flagSet', key: 'retrieved', label: 'Chunks the retriever returned', options: CHUNKS.map((c) => ({ value: c.id, label: `${c.id} ${c.text}${c.relevant ? '' : ' (off-topic)'}` })) },
    { kind: 'toggle', key: 'includeHallucination', label: 'Include the invented claim about INR 2 lakh' },
  ],
  presets: {
    start: { state: retrieved(true, true, false, true, true), expected: { faithfulness: 0.5, contextPrecision: 2 / 3 } },
    perfect: { state: retrieved(true, true, true, false, false), expected: { faithfulness: 1, contextRecall: 1, contextPrecision: 1 } },
    noisy: { state: retrieved(true, true, true, true, false), expected: { contextPrecision: 0.75 } },
    hallu: { state: retrieved(true, true, true, false, true), expected: { faithfulness: 0.75, contextRecall: 1 } },
  },
  initialPreset: 'start',
  simulate: simulateRagMetrics,
  outputs: [
    { kind: 'meter', label: 'Faithfulness', value: (r) => r.faithfulness, detail: (r) => `= ${r.claims.filter((c) => c.supported).length} supported claims ÷ ${r.claims.length} claims`, emphasis: (r) => emphasisBelow(0.8)(r.faithfulness) },
    { kind: 'meter', label: 'Context recall', value: (r) => r.contextRecall, detail: (r) => `= ${3 - r.missingFacts.length} reference facts found ÷ 3`, emphasis: (r) => emphasisBelow(0.8)(r.contextRecall) },
    { kind: 'meter', label: 'Context precision', value: (r) => r.contextPrecision, detail: (r) => `= ${r.relevantRetrieved} relevant chunks ÷ ${r.retrievedCount} retrieved`, emphasis: (r) => emphasisBelow(0.8)(r.contextPrecision) },
    { kind: 'badges', items: (r) => r.claims.map((c) => ({ text: `${c.supported ? '✓' : '✗'} ${c.claim}`, emphasis: c.supported ? 'normal' : 'warn' })) },
  ],
  verdict: (r) =>
    r.faithfulness === 1 && r.contextRecall === 1 && r.contextPrecision === 1 ? { tone: 'ok', headline: 'Everything is healthy.', detail: 'Retrieval found the facts and the answer stays within them.' }
      : r.contextRecall < 1 ? { tone: 'no', headline: 'Fix retrieval first.', detail: 'A model can’t cite what it was never given.' }
      : { tone: 'mid', headline: 'Retrieval is fine; fix generation or noise.', detail: 'Unsupported claims or off-topic chunks remain.' },
  narrate: (r, s) => {
    const parts = [`The retriever returned ${r.retrievedCount} ${pluralise(r.retrievedCount, 'chunk')}, ${r.relevantRetrieved} of them relevant (precision ${formatWholePercent(r.contextPrecision)}).`];
    parts.push(r.missingFacts.length ? `It missed ${joinWithAnd(r.missingFacts)}, so ${r.missingFacts.length} of 3 facts the reference answer needs aren’t in the context (recall ${formatWholePercent(r.contextRecall)}).` : 'It found every fact the reference answer needs (recall 100%).');
    parts.push(`${r.claims.filter((c) => c.supported).length} of ${r.claims.length} claims in the answer are backed by the retrieved chunks (faithfulness ${formatWholePercent(r.faithfulness)}).`);
    if (s.includeHallucination) parts.push('The INR 2 lakh claim isn’t supported by anything retrieved: that’s a hallucination to fix in generation.');
    if (r.contextPrecision < 1) parts.push('The off-topic chunk wastes context and can confuse the model.');
    return parts.join(' ');
  },
  missions: {
    all: ({ result: r }) => r.faithfulness === 1 && r.contextRecall === 1 && r.contextPrecision === 1,
    recallfaith: ({ result: r }) => r.contextRecall === 1 && r.faithfulness < 1,
    precrec: ({ result: r }) => r.contextPrecision === 1 && Math.abs(r.contextRecall - 1 / 3) < 1e-9,
  },
});
