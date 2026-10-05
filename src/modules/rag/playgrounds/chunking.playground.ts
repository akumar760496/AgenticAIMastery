import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent } from '@/shared/format';
import { simulateChunking, type ChunkingResult, type ChunkingState } from '../simulators/chunking';

const isGood = (r: ChunkingResult) => r.recall >= 0.85 && r.promptTokens <= 2500;
const STRATEGY = { fixed: 'Fixed-size chunks cut through sentences and clauses', recursive: 'Recursive splitting respects paragraphs and sentences', structure: 'Splitting by clause keeps each rule where its author put it' } as const;

export const chunkingPlayground = definePlayground<ChunkingState, ChunkingResult>({
  techniqueId: 'chunk',
  title: 'Chunk Pragati Insurance’s policy wordings',
  intro: 'Pragati Insurance is fictional. 1.2 million tokens of policy text. 120 test questions: 50 short facts, 40 rules with an exception elsewhere in the clause, and 30 that name a section the clause text never repeats. Five chunks reach the prompt.',
  controls: [
    { kind: 'select', key: 'strategy', label: 'Strategy', options: [{ value: 'fixed', label: 'Fixed size' }, { value: 'recursive', label: 'Recursive (paragraph, then sentence)' }, { value: 'structure', label: 'Structure-aware (by clause)' }] },
    { kind: 'steps', key: 'size', label: 'Chunk size (tokens)', values: [128, 256, 512, 1024], format: (v) => String(v) },
    { kind: 'toggle', key: 'overlap', label: '15% overlap' },
    { kind: 'toggle', key: 'sectionPath', label: 'Prepend the section path to each chunk' },
    { kind: 'toggle', key: 'smallToBig', label: 'Small-to-big: search chunks, send the whole clause' },
  ],
  presets: {
    start: { state: { strategy: 'fixed', size: 1024, overlap: false, sectionPath: false, smallToBig: false }, expected: { recall: 0.665, promptTokens: 5120 } },
    tiny: { state: { strategy: 'recursive', size: 128, overlap: true, sectionPath: false, smallToBig: false }, expected: { recall: 0.65417, exceptions: 0.4 } },
    big: { state: { strategy: 'structure', size: 512, overlap: true, sectionPath: true, smallToBig: false }, expected: { recall: 0.88083, promptTokens: 2560 } },
    tuned: { state: { strategy: 'structure', size: 256, overlap: true, sectionPath: true, smallToBig: true }, expected: { recall: 0.9, promptTokens: 2100 } },
  },
  initialPreset: 'start',
  simulate: simulateChunking,
  outputs: [
    { kind: 'meter', label: 'Recall at 5, all questions', value: (r) => r.recall, emphasis: (r) => (r.recall < 0.85 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Short facts', value: (r) => r.facts, detail: () => '50 questions' },
    { kind: 'meter', label: 'Rules with their exception', value: (r) => r.exceptions, detail: () => '40 questions', emphasis: (r) => (r.exceptions < 0.6 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Questions naming a section', value: (r) => r.sections, detail: () => '30 questions', emphasis: (r) => (r.sections < 0.7 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Prompt tokens per answer', value: (r) => formatCount(r.promptTokens), emphasis: (r) => (r.promptTokens > 2500 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Chunks in the index', value: (r) => formatCount(Math.round(r.chunks)) },
  ],
  verdict: (r) => {
    if (isGood(r)) return { tone: 'ok', headline: 'Whole answers, lean prompts.', detail: 'Each question gets the full clause in about 2,100 tokens.' };
    const tone = r.recall < 0.7 ? 'no' : 'mid';
    if (r.promptTokens > 2500 && r.recall >= 0.85) return { tone, headline: 'Right answers, heavy prompts.', detail: 'Try smaller chunks with small-to-big.' };
    if (r.exceptions < 0.6) return { tone, headline: 'Exceptions are cut off.', detail: 'Keep clauses whole or return the parent clause.' };
    if (r.sections < 0.7) return { tone, headline: 'Chunks do not know their section.', detail: 'Prepend the section path.' };
    return { tone, headline: 'Close, but not there yet.', detail: 'Adjust the size or add small-to-big.' };
  },
  narrate: (r, s) => [
    `${STRATEGY[s.strategy]} at ${s.size} tokens.`,
    s.size <= 128 && !s.smallToBig ? 'Tiny chunks match short facts well but separate rules from their exceptions.' : s.size >= 1024 ? 'Large chunks hold whole clauses but blur the embedding, so short facts rank lower and prompts grow to 5,120 tokens.' : '',
    s.sectionPath ? 'The section path lets “What is excluded for maternity?” match a clause that never says “maternity exclusions”.' : 'Without the section path, 30 questions that name a section have little to match.',
    s.smallToBig ? 'Small-to-big searches precise chunks but sends the whole clause, so exceptions arrive with their rules.' : '',
    `Recall at 5 is ${formatWholePercent(r.recall)} for ${formatCount(r.promptTokens)} tokens per answer.`,
  ].filter(Boolean).join(' '),
  missions: {
    best: ({ result }) => isGood(result),
    tiny: ({ state, result }) => state.size === 128 && !state.smallToBig && result.exceptions < 0.5,
    headers: ({ result }) => result.sections >= 0.85,
  },
});
