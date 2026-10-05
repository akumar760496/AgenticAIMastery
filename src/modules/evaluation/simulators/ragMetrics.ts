/** RAG grounding metrics: faithfulness, context recall and context precision for one NEFT answer. */
export interface Chunk { readonly id: string; readonly text: string; readonly relevant: boolean }

export const CHUNKS: readonly Chunk[] = [
  { id: 'C1', text: 'NEFT settles in half-hourly batches', relevant: true },
  { id: 'C2', text: 'NEFT is available 24x7, all year', relevant: true },
  { id: 'C3', text: 'Batches continue on bank holidays', relevant: true },
  { id: 'C4', text: 'RTGS minimum amount is INR 2 lakh', relevant: false },
];

/** Claims in the answer and the chunk that supports each. */
const ANSWER_CLAIMS: readonly { readonly claim: string; readonly supportedBy: string }[] = [
  { claim: 'settles every 30 minutes', supportedBy: 'C1' },
  { claim: 'available 24x7', supportedBy: 'C2' },
  { claim: 'runs on bank holidays too', supportedBy: 'C3' },
];
export const HALLUCINATED_CLAIM = 'instant under INR 2 lakh';
const REFERENCE_FACTS = ['C1', 'C2', 'C3'] as const;

export interface RagMetricsState {
  readonly retrieved: Readonly<Record<string, boolean>>;
  readonly includeHallucination: boolean;
}

export interface ClaimCheck { readonly claim: string; readonly supported: boolean }

export interface RagMetricsResult {
  readonly claims: readonly ClaimCheck[];
  readonly faithfulness: number;
  readonly contextRecall: number;
  readonly contextPrecision: number;
  readonly retrievedCount: number;
  readonly relevantRetrieved: number;
  readonly missingFacts: readonly string[];
}

export function simulateRagMetrics({ retrieved, includeHallucination }: RagMetricsState): RagMetricsResult {
  const claims: ClaimCheck[] = ANSWER_CLAIMS.map(({ claim, supportedBy }) => ({ claim, supported: Boolean(retrieved[supportedBy]) }));
  if (includeHallucination) claims.push({ claim: HALLUCINATED_CLAIM, supported: false });
  const got = CHUNKS.filter((chunk) => retrieved[chunk.id]);
  const relevantRetrieved = got.filter((chunk) => chunk.relevant).length;
  const missingFacts = REFERENCE_FACTS.filter((id) => !retrieved[id]);
  return {
    claims,
    faithfulness: claims.filter((c) => c.supported).length / claims.length,
    contextRecall: (REFERENCE_FACTS.length - missingFacts.length) / REFERENCE_FACTS.length,
    contextPrecision: got.length ? relevantRetrieved / got.length : 0,
    retrievedCount: got.length,
    relevantRetrieved,
    missingFacts,
  };
}
