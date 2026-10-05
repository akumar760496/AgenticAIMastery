import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatFixed, formatRupees, formatWholePercent } from '@/shared/format';
import { simulateDocumentReading, type DocumentReadingResult, type DocumentReadingState } from '../simulators/documentReading';

const READER = { ocr: 'OCR feeding a text model', vision: 'A vision model', both: 'A vision model cross-checked by OCR' } as const;

export const documentReadingPlayground = definePlayground<DocumentReadingState, DocumentReadingResult>({
  techniqueId: 'multimodal',
  title: 'Read claim documents from phone photos',
  intro: 'Key fields: total amount, bill date, patient name. Accuracy and costs are illustrative.',
  controls: [
    { kind: 'select', key: 'reader', label: 'Reader', options: [{ value: 'ocr', label: 'OCR, then a text model' }, { value: 'vision', label: 'Vision model' }, { value: 'both', label: 'Vision model, cross-checked by OCR' }] },
    { kind: 'select', key: 'size', label: 'Image size', options: [{ value: 'low', label: 'Small (512 px)' }, { value: 'fit', label: 'Resized to the model’s limit' }, { value: 'tiles', label: 'Split into tiles' }] },
    { kind: 'select', key: 'documents', label: 'Documents', options: [{ value: 'printed', label: 'Printed bills' }, { value: 'hand', label: 'Handwritten, Hindi or Marathi' }] },
    { kind: 'toggle', key: 'preprocess', label: 'Deskew and crop first' },
  ],
  presets: {
    start: { state: { reader: 'ocr', preprocess: false, size: 'low', documents: 'printed' }, expected: { accuracy: 0.85, wrongThrough: 0.15 } },
    vision: { state: { reader: 'vision', preprocess: false, size: 'fit', documents: 'printed' }, expected: { accuracy: 0.95, wrongThrough: 0.05 } },
    hand: { state: { reader: 'vision', preprocess: true, size: 'fit', documents: 'hand' }, expected: { accuracy: 0.84, wrongThrough: 0.16 } },
    both: { state: { reader: 'both', preprocess: false, size: 'low', documents: 'hand' }, expected: { accuracy: 0.78, wrongThrough: 0.066, toReview: 0.184 } },
  },
  initialPreset: 'start',
  simulate: simulateDocumentReading,
  outputs: [
    { kind: 'meter', label: 'Fields read correctly', value: (r) => r.accuracy },
    { kind: 'meter', label: 'Wrong values reaching the system', value: (r) => r.wrongThrough, emphasis: (r) => (r.wrongThrough > 0.01 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Sent to an assessor', value: (r) => formatWholePercent(r.toReview) },
    { kind: 'value', label: 'Cost per page', value: (r) => formatRupees(r.rupees, 2) },
  ],
  verdict: (r) => (r.wrongThrough <= 0.01
    ? { tone: 'ok', headline: 'Safe to automate.', detail: 'Disagreements go to a person; almost nothing wrong gets through.' }
    : r.wrongThrough > 0.1 ? { tone: 'no', headline: 'Too many misreads.', detail: 'Wrong amounts would reach the claims system.' }
      : { tone: 'mid', headline: 'Needs a second reader.', detail: 'A cross-check would catch most of these errors.' }),
  narrate: (r, s) => [
    `${READER[s.reader]} reads ${formatWholePercent(r.accuracy)} of fields correctly on ${s.documents === 'printed' ? 'printed bills' : 'handwritten documents'}${s.size === 'low' ? ', held back by 512 px images' : ''}.`,
    s.reader === 'both' ? `Where the two readers disagree the page goes to an assessor (${formatWholePercent(r.toReview)}), so only ${formatFixed(r.wrongThrough * 100, 1)}% of values arrive wrong.` : `${formatFixed(r.wrongThrough * 100, 1)}% of values arrive in the claims system wrong.`,
    `Each page costs ${formatRupees(r.rupees, 2)}.`,
  ].join(' '),
  missions: {
    printed: ({ state, result }) => state.documents === 'printed' && result.wrongThrough <= 0.01,
    hand: ({ state, result }) => state.documents === 'hand' && result.wrongThrough <= 0.05,
    cheap: ({ state, result }) => state.documents === 'printed' && result.accuracy >= 0.96 && result.rupees <= 0.4,
  },
});
