/** Reading claim documents from phone photos: amount, bill date, patient name. Illustrative accuracy and ₹ cost per page. */
export type Reader = 'ocr' | 'vision' | 'both';
export type ImageSize = 'low' | 'fit' | 'tiles';
export type DocumentKind = 'printed' | 'hand';
export interface DocumentReadingState { readonly reader: Reader; readonly preprocess: boolean; readonly size: ImageSize; readonly documents: DocumentKind }
export interface DocumentReadingResult { readonly accuracy: number; readonly wrongThrough: number; readonly toReview: number; readonly rupees: number }

const ACCURACY: Readonly<Record<DocumentKind, Readonly<Record<Reader, number>>>> = {
  printed: { ocr: 0.93, vision: 0.95, both: 0.975 },
  hand: { ocr: 0.7, vision: 0.82, both: 0.86 },
};

export function simulateDocumentReading(s: DocumentReadingState): DocumentReadingResult {
  let accuracy = ACCURACY[s.documents][s.reader];
  if (s.preprocess) accuracy += 0.02;
  if (s.size === 'low') accuracy -= 0.08;
  if (s.size === 'tiles') accuracy += 0.01;
  accuracy = Math.min(0.99, accuracy);
  const crossChecked = s.reader === 'both';
  const visionCost = s.size === 'tiles' ? 1 : 0.4;
  return {
    accuracy,
    wrongThrough: (1 - accuracy) * (crossChecked ? 0.3 : 1),
    toReview: crossChecked ? (1 - accuracy) * 0.7 + 0.03 : 0,
    rupees: s.reader === 'ocr' ? 0.25 : s.reader === 'vision' ? visionCost : visionCost + 0.25,
  };
}
