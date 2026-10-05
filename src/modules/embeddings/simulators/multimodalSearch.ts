/** Text and image search over six products with text-only or CLIP-style embeddings. */
export type ProductQuery = 'red' | 'photo' | 'air';
export type EmbeddingModel = 'text' | 'clip';
export interface Product { readonly id: string; readonly name: string; readonly description: string }

export const PRODUCTS: readonly Product[] = [
  { id: 'P1', name: 'Red running shoe', description: '“Red running shoe, white sole”' },
  { id: 'P2', name: 'Red running shoe', description: '“New arrival · SKU 4471”' },
  { id: 'P3', name: 'Blue running shoe, AIR on heel', description: '“Blue runner, AIR print on heel”' },
  { id: 'P4', name: 'Red handbag', description: '“Red leather handbag”' },
  { id: 'P5', name: 'White sneaker', description: '“White canvas sneaker”' },
  { id: 'P6', name: 'Red T-shirt', description: '“Red cotton T-shirt”' },
];

interface QueryData { readonly text: string; readonly isImage: boolean; readonly relevant: readonly string[]; readonly description: readonly number[]; readonly photo: readonly number[] }
export const PRODUCT_QUERIES: Readonly<Record<ProductQuery, QueryData>> = {
  red: { text: 'Text: “red running shoe”', isImage: false, relevant: ['P1', 'P2'], description: [0.78, 0.05, 0.45, 0.38, 0.3, 0.41], photo: [0.31, 0.3, 0.22, 0.23, 0.19, 0.24] },
  photo: { text: 'Photo: a customer’s picture of a red running shoe', isImage: true, relevant: ['P1', 'P2'], description: [0.3, 0.06, 0.24, 0.17, 0.2, 0.18], photo: [0.91, 0.89, 0.72, 0.38, 0.64, 0.41] },
  air: { text: 'Text: “shoe with AIR printed on the heel”', isImage: false, relevant: ['P3'], description: [0.25, 0.04, 0.62, 0.06, 0.28, 0.05], photo: [0.24, 0.235, 0.21, 0.12, 0.23, 0.11] },
};
const TOP_K = 3;

export interface MultimodalState { readonly query: ProductQuery; readonly model: EmbeddingModel; readonly indexDescriptions: boolean; readonly indexPhotos: boolean }
export interface ProductHit { readonly product: Product; readonly via: 'description' | 'photo'; readonly raw: number; readonly normalised: number; readonly relevant: boolean }
export interface MultimodalResult {
  readonly hits: readonly ProductHit[];
  readonly recall: number;
  readonly photosSearchable: boolean;
  readonly canQuery: boolean;
  readonly vectors: number;
  readonly foundPoorlyDescribed: boolean;
  readonly missed: readonly string[];
}

export function simulateMultimodal(s: MultimodalState): MultimodalResult {
  const q = PRODUCT_QUERIES[s.query];
  const clip = s.model === 'clip';
  const photosSearchable = s.indexPhotos && clip;
  const canQuery = !q.isImage || clip;
  const lists: ['description' | 'photo', readonly number[]][] = [];
  if (canQuery && s.indexDescriptions) lists.push(['description', q.description]);
  if (canQuery && photosSearchable) lists.push(['photo', q.photo]);
  // Each list is divided by its best score before merging: text–text and text–image scores sit on different scales.
  const best = new Map<number, { via: 'description' | 'photo'; raw: number; normalised: number }>();
  for (const [via, scores] of lists) {
    const max = Math.max(...scores);
    scores.forEach((raw, i) => { const normalised = raw / max; const cur = best.get(i); if (!cur || normalised > cur.normalised) best.set(i, { via, raw, normalised }); });
  }
  const hits = [...best.entries()].sort((a, b) => b[1].normalised - a[1].normalised || a[0] - b[0]).slice(0, TOP_K)
    .map(([i, h]) => { const product = PRODUCTS[i]!; return { product, ...h, relevant: q.relevant.includes(product.id) }; });
  const found = hits.filter((h) => h.relevant).length;
  return {
    hits, recall: found / q.relevant.length, photosSearchable, canQuery,
    vectors: (s.indexDescriptions ? PRODUCTS.length : 0) + (photosSearchable ? PRODUCTS.length : 0),
    foundPoorlyDescribed: hits.some((h) => h.product.id === 'P2'),
    missed: q.relevant.filter((id) => !hits.some((h) => h.product.id === id)),
  };
}
