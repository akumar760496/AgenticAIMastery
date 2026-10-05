/**
 * Pragati Insurance (fictional) policy wordings: 1.2 million tokens. 120 questions: 50 short facts, 40 rules with an exception
 * elsewhere in the clause, 30 that name a section the clause never repeats. Five chunks reach the prompt.
 */
export type ChunkStrategy = 'fixed' | 'recursive' | 'structure';
export interface ChunkingState { readonly strategy: ChunkStrategy; readonly size: number; readonly overlap: boolean; readonly sectionPath: boolean; readonly smallToBig: boolean }
export interface ChunkingResult { readonly facts: number; readonly exceptions: number; readonly sections: number; readonly recall: number; readonly promptTokens: number; readonly chunks: number }

const CORPUS_TOKENS = 1.2e6;
const FACT_RECALL: Readonly<Record<number, number>> = { 128: 0.92, 256: 0.9, 512: 0.84, 1024: 0.7 };
const EXCEPTION_RECALL: Readonly<Record<number, number>> = { 128: 0.35, 256: 0.55, 512: 0.75, 1024: 0.82 };
const clamp = (v: number) => Math.max(0, Math.min(0.97, v));

export function simulateChunking(s: ChunkingState): ChunkingResult {
  let facts = FACT_RECALL[s.size] ?? 0.8; let exceptions = EXCEPTION_RECALL[s.size] ?? 0.6; let sections = 0.55 + (s.size >= 512 ? 0.05 : 0);
  if (s.strategy === 'fixed') { facts -= 0.04; exceptions -= 0.1; }
  if (s.strategy === 'structure') { exceptions += 0.08; sections += 0.05; }
  if (s.overlap) exceptions += 0.05;
  if (s.sectionPath) sections += 0.3;
  if (s.smallToBig) exceptions = Math.max(exceptions, 0.9);
  facts = clamp(facts); exceptions = clamp(exceptions); sections = clamp(sections);
  return {
    facts, exceptions, sections,
    recall: (50 * facts + 40 * exceptions + 30 * sections) / 120,
    promptTokens: s.smallToBig ? 2100 : 5 * s.size,
    chunks: (CORPUS_TOKENS / s.size) * (s.overlap ? 1.15 : 1),
  };
}
