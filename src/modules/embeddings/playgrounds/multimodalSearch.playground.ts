import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatWholePercent, joinWithAnd } from '@/shared/format';
import { PRODUCT_QUERIES, simulateMultimodal, type MultimodalResult, type MultimodalState, type ProductQuery } from '../simulators/multimodalSearch';

export const multimodalPlayground = definePlayground<MultimodalState, MultimodalResult>({
  techniqueId: 'multimodal',
  title: 'Shopping search, top 3 results',
  controls: [
    { kind: 'select', key: 'query', label: 'Query', options: (Object.keys(PRODUCT_QUERIES) as ProductQuery[]).map((k) => ({ value: k, label: PRODUCT_QUERIES[k].text })) },
    { kind: 'choice', key: 'model', label: 'Model', options: [{ value: 'text', label: 'Text-only embeddings' }, { value: 'clip', label: 'CLIP-style multimodal' }] },
    { kind: 'toggle', key: 'indexDescriptions', label: 'Index product descriptions' },
    { kind: 'toggle', key: 'indexPhotos', label: 'Index product photos' },
    { kind: 'note', text: 'When both are indexed, each list’s scores are divided by its best score before merging, because text–text and text–image scores sit on different scales.' },
  ],
  presets: {
    start: { state: { query: 'red', model: 'text', indexDescriptions: true, indexPhotos: false }, expected: { recall: 0.5 } },
    photos: { state: { query: 'air', model: 'clip', indexDescriptions: false, indexPhotos: true }, expected: { recall: 0 } },
    photoq: { state: { query: 'photo', model: 'text', indexDescriptions: true, indexPhotos: false }, expected: { recall: 0, canQuery: false } },
    descclip: { state: { query: 'photo', model: 'clip', indexDescriptions: true, indexPhotos: false }, expected: { recall: 0.5 } },
  },
  initialPreset: 'start',
  simulate: simulateMultimodal,
  outputs: [
    { kind: 'meter', label: 'Recall in top 3', value: (r) => r.recall, detail: (r) => `= ${r.hits.filter((h) => h.relevant).length} relevant found`, emphasis: (r) => (r.recall < 1 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Searchable vectors', value: (r) => String(r.vectors) },
    { kind: 'check', label: 'Poorly described shoe (P2) found', value: (r) => r.foundPoorlyDescribed },
    { kind: 'itemList', title: 'Results', items: (r) => r.hits.map((h, i) => ({ label: `${i + 1}`, text: `${h.product.id} · ${h.product.name}`, status: h.relevant ? 'relevant' : 'not relevant', tone: h.relevant ? 'ok' : 'mid', detail: `via ${h.via} ${h.raw.toFixed(2)} · ${h.product.description}` })) },
  ],
  verdict: (r, s) => ({
    tone: r.recall === 1 ? 'ok' : r.recall > 0 ? 'mid' : 'no',
    headline: r.recall === 1 ? 'All relevant products found.' : r.recall > 0 ? 'Some relevant products missed.' : 'No relevant product found.',
    detail: !r.canQuery ? 'A text-only model cannot embed a photo, so the query cannot run.' : s.indexPhotos && s.model === 'text' ? 'Photos are ticked, but a text-only model cannot embed them.' : 'Text and photos are compared with the same cosine similarity.',
  }),
  narrate: (r, s) => [
    `${PRODUCT_QUERIES[s.query].text}.`,
    r.hits.length ? `The top 3 are ${joinWithAnd(r.hits.map((h) => h.product.id))}, so recall is ${formatWholePercent(r.recall)}.` : 'Nothing comes back.',
    r.missed.includes('P2') && r.canQuery ? 'P2 is a red running shoe, but its seller wrote only “New arrival · SKU 4471”: text search cannot see it, while its photo would match.' : '',
    r.missed.includes('P3') && r.photosSearchable ? 'P3’s AIR print is tiny, and image embeddings lose small printed text, so only its description can find it.' : '',
    r.recall === 1 && s.indexDescriptions && r.photosSearchable ? 'Indexing both descriptions and photos covers each one’s blind spot.' : '',
  ].filter(Boolean).join(' '),
  missions: {
    photo: ({ state, result }) => state.query === 'photo' && result.recall === 1,
    hidden: ({ state, result }) => state.query === 'red' && result.recall === 1,
    detail: ({ state, result }) => state.query === 'air' && result.recall === 1 && result.photosSearchable,
  },
});
