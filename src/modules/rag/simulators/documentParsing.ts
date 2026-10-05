/**
 * Kosh Finance (fictional NBFC) loan files: 2,000 pages (500 scanned, 150 of them Hindi; 300 with tables; 400 two-column).
 * 100 test questions: 40 prose, 25 on scans (8 Hindi), 20 in tables, 15 on two-column pages. Timings illustrative.
 */
export type ScanHandling = 'skip' | 'ocr-en' | 'ocr-hi';
export interface DocumentParsingState { readonly scans: ScanHandling; readonly layout: boolean; readonly tables: boolean; readonly dropHeaders: boolean }
export interface DocumentParsingResult { readonly prose: number; readonly scanned: number; readonly tables: number; readonly columns: number; readonly answerable: number; readonly pagesRecovered: number; readonly minutes: number }

export function simulateDocumentParsing(s: DocumentParsingState): DocumentParsingResult {
  const prose = s.dropHeaders ? 38 : 34;
  const scanned = s.scans === 'skip' ? 0 : s.scans === 'ocr-en' ? 15 : 21;
  const tables = s.tables ? 17 : 7;
  const columns = s.layout ? 13 : 6;
  const seconds = 100 + (s.scans === 'skip' ? 0 : s.scans === 'ocr-hi' ? 900 : 750) + (s.layout ? 800 : 0) + (s.tables ? 60 : 0);
  return { prose, scanned, tables, columns, answerable: prose + scanned + tables + columns, pagesRecovered: s.scans === 'skip' ? 0 : s.scans === 'ocr-en' ? 315 : 435, minutes: seconds / 60 };
}
