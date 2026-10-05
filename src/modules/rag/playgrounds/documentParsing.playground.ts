import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatFixed } from '@/shared/format';
import { simulateDocumentParsing, type DocumentParsingResult, type DocumentParsingState } from '../simulators/documentParsing';

export const documentParsingPlayground = definePlayground<DocumentParsingState, DocumentParsingResult>({
  techniqueId: 'parse',
  title: 'Ingest Kosh Finance’s loan files',
  intro: 'Kosh Finance is a fictional NBFC. 2,000 pages: 1,500 digital, 500 scanned (150 of them in Hindi); 300 pages hold tables and 400 are laid out in two columns. 100 test questions: 40 answered in plain prose, 25 on scans (8 in Hindi), 20 in tables and 15 on two-column pages.',
  controls: [
    { kind: 'select', key: 'scans', label: 'Scanned pages', options: [{ value: 'skip', label: 'Text layer only (skip scans)' }, { value: 'ocr-en', label: 'OCR in English' }, { value: 'ocr-hi', label: 'OCR in English + Hindi' }] },
    { kind: 'toggle', key: 'layout', label: 'Layout model: reading order for two-column pages' },
    { kind: 'toggle', key: 'tables', label: 'Keep tables as Markdown rows with headers' },
    { kind: 'toggle', key: 'dropHeaders', label: 'Drop running headers and footers' },
    { kind: 'note', text: 'Illustrative timings on one machine: OCR about 1.5 s a page, the layout model about 0.4 s a page.' },
  ],
  presets: {
    start: { state: { scans: 'skip', layout: false, tables: false, dropHeaders: false }, expected: { answerable: 47 } },
    ocr: { state: { scans: 'ocr-hi', layout: false, tables: false, dropHeaders: false }, expected: { answerable: 68 } },
    full: { state: { scans: 'ocr-hi', layout: true, tables: true, dropHeaders: true }, expected: { answerable: 89, minutes: 31 } },
    lean: { state: { scans: 'ocr-hi', layout: false, tables: true, dropHeaders: true }, expected: { answerable: 82 } },
  },
  initialPreset: 'start',
  simulate: simulateDocumentParsing,
  outputs: [
    { kind: 'meter', label: 'Questions answerable', value: (r) => r.answerable / 100, detail: (r) => `= ${r.answerable} of 100`, emphasis: (r) => (r.answerable < 85 ? 'warn' : 'normal') },
    { kind: 'table', columns: ['Where the answer is', 'Answerable'], rows: (r) => [['Prose', `${r.prose} of 40`], ['Scans', `${r.scanned} of 25`], ['Tables', `${r.tables} of 20`], ['Two columns', `${r.columns} of 15`]] },
    { kind: 'value', label: 'Ingestion time', value: (r) => `${formatFixed(r.minutes, 1)} min` },
  ],
  verdict: (r, s) => {
    if (r.answerable >= 85) return { tone: 'ok', headline: 'The corpus is readable.', detail: 'Scans, tables and columns all survive ingestion.' };
    const tone = r.answerable < 60 ? 'no' : 'mid';
    if (s.scans === 'skip') return { tone, headline: 'A quarter of the answers are invisible.', detail: 'Scanned pages have no text layer, so they are indexed as blanks.' };
    if (s.scans === 'ocr-en') return { tone, headline: 'The Hindi pages are noise.', detail: 'Add Hindi to the OCR languages.' };
    if (!s.tables) return { tone, headline: 'The tables are word soup.', detail: 'Keep tables as rows with headers.' };
    if (!s.layout) return { tone, headline: 'Two-column pages are scrambled.', detail: 'Use a layout model to restore reading order.' };
    return { tone, headline: 'Close, but not there yet.', detail: 'Drop running headers so every chunk is not polluted.' };
  },
  narrate: (r, s) => [
    s.scans === 'skip' ? 'Scanned pages have no text layer, so all 500 are indexed as empty and none of the 25 questions answered on them can be found.'
      : s.scans === 'ocr-en' ? 'OCR recovers the English scans, but the 150 Hindi pages come back as noise, so 8 questions stay unanswerable.' : 'OCR in English and Hindi recovers 435 of the 500 scanned pages.',
    s.tables ? 'Tables become rows with headers, so “rate for 24 months” matches the right cell.' : 'Tables are flattened into streams of numbers, so only 7 of 20 table questions can be matched.',
    s.layout ? 'The layout model reads each column in order.' : 'Two-column pages are read straight across, mixing two paragraphs line by line.',
    s.dropHeaders ? 'Running headers are removed.' : 'The repeated header in every chunk pulls unrelated pages into results.',
    `${r.answerable} of 100 questions are answerable after ${formatFixed(r.minutes, 1)} minutes of ingestion.`,
  ].join(' '),
  missions: {
    all: ({ result }) => result.answerable >= 85,
    fast: ({ result }) => result.answerable >= 80 && result.minutes <= 20,
    hindi: ({ state }) => state.scans === 'ocr-en',
  },
});
