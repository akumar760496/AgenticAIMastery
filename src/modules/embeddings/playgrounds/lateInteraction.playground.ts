import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatWholePercent } from '@/shared/format';
import { VISUAL_SHARES, simulateLateInteraction, type LateInteractionResult, type LateInteractionState } from '../simulators/lateInteraction';

const meetsTarget = (r: LateInteractionResult) => r.recall >= 0.85 && r.sizeGb <= 50 && r.latencyMs <= 100;
const STORY: Readonly<Record<LateInteractionState['retriever'], string>> = {
  dense: 'One vector per passage blurs details, and OCR text of scanned bills loses the table layout.',
  colbert: 'ColBERT matches every query token against every passage token, so exact terms are found, but OCR still garbles the scans.',
  colpali: 'ColPali reads each page image as patches, so bill totals and form boxes are matched where they sit.',
};

export const lateInteractionPlayground = definePlayground<LateInteractionState, LateInteractionResult>({
  techniqueId: 'lateint',
  title: 'Search Anand Bima’s claim pages (fictional insurer)',
  controls: [
    { kind: 'select', key: 'retriever', label: 'Retriever', options: [{ value: 'dense', label: 'Single vector per passage (OCR text)' }, { value: 'colbert', label: 'ColBERT late interaction (OCR text)' }, { value: 'colpali', label: 'ColPali late interaction (page images)' }] },
    { kind: 'steps', key: 'visualShare', label: 'Scanned or visual pages', values: VISUAL_SHARES, format: formatWholePercent },
    { kind: 'toggle', key: 'compress', label: 'Compress token vectors (pooling, residual or binary)', isEnabled: (s) => s.retriever !== 'dense' },
  ],
  presets: {
    start: { state: { retriever: 'dense', visualShare: 0.5, compress: false }, expected: { recall: 0.69, sizeGb: 4, latencyMs: 20 } },
    colbert: { state: { retriever: 'colbert', visualShare: 0.5, compress: true }, expected: { recall: 0.77, sizeGb: 6, latencyMs: 45 } },
    raw: { state: { retriever: 'colpali', visualShare: 0.5, compress: false }, expected: { recall: 0.85, sizeGb: 260, latencyMs: 120 } },
    colpali: { state: { retriever: 'colpali', visualShare: 0.5, compress: true }, expected: { recall: 0.85, sizeGb: 40, latencyMs: 90 } },
  },
  initialPreset: 'start',
  simulate: simulateLateInteraction,
  outputs: [
    { kind: 'meter', label: 'Recall at 5', value: (r) => r.recall, emphasis: (r) => (r.recall < 0.8 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Text pages', value: (r) => r.textRecall },
    { kind: 'meter', label: 'Scanned and visual pages', value: (r) => r.visualRecall, emphasis: (r) => (r.visualRecall < 0.7 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Index size', value: (r) => `${r.sizeGb} GB`, emphasis: (r) => (r.sizeGb > 100 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Query latency', value: (r) => `${r.latencyMs} ms` },
  ],
  verdict: (r) => {
    if (meetsTarget(r)) return { tone: 'ok', headline: 'Finds the detail, fits the budget.', detail: 'Late interaction on page images, compressed.' };
    const tone = r.recall < 0.75 ? 'no' : 'mid';
    if (r.sizeGb > 100) return { tone, headline: 'Accurate, but the index is huge.', detail: 'Compress the token vectors.' };
    if (r.visualRecall < 0.7) return { tone, headline: 'Scans defeat the text pipeline.', detail: 'OCR loses tables and layout; try ColPali.' };
    return { tone, headline: 'Close, but not there yet.', detail: 'Check the scan share and the retriever.' };
  },
  narrate: (r, s) => `${STORY[s.retriever]} ${s.retriever === 'dense' ? '' : s.compress ? 'Compressed token vectors keep the index affordable. ' : 'Uncompressed, one vector per token makes the index many times larger. '}Recall at 5 is ${formatWholePercent(r.recall)} with a ${r.sizeGb} GB index.`,
  missions: {
    best: ({ result }) => meetsTarget(result),
    visual: ({ state, result }) => state.visualShare === 0.8 && state.retriever === 'colpali' && result.recall >= 0.85,
    storage: ({ result }) => result.sizeGb >= 200,
  },
});
