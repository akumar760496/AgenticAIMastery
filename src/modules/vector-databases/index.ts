/**
 * Vector databases feature module (Module 5): IVF, HNSW, DiskANN, layered search, hybrid search,
 * metadata filtering, multi-tenancy, index compression and choosing a store.
 */
import { buildFeatureModule, type PlaygroundMap } from '@/application/FeatureModuleFactory';
import type { FeatureModule } from '@/domain/technique/FeatureModule';
import moduleJson from './content/module.json';
import { diskAnnPlayground } from './playgrounds/diskAnn.playground';
import { hnswPlayground } from './playgrounds/hnswIndex.playground';
import { hybridSearchPlayground } from './playgrounds/hybridSearch.playground';
import { indexCompressionPlayground } from './playgrounds/indexCompression.playground';
import { ivfPlayground } from './playgrounds/ivfIndex.playground';
import { layeredSearchPlayground } from './playgrounds/layeredSearch.playground';
import { metadataFilteringPlayground } from './playgrounds/metadataFiltering.playground';
import { multiTenancyPlayground } from './playgrounds/multiTenancy.playground';
import { storeSelectionPlayground } from './playgrounds/storeSelection.playground';

export const VECTOR_DATABASES_PLAYGROUNDS: PlaygroundMap = {
  ivf: ivfPlayground,
  hnsw: hnswPlayground,
  diskann: diskAnnPlayground,
  las: layeredSearchPlayground,
  hybrid: hybridSearchPlayground,
  metafilter: metadataFilteringPlayground,
  tenancy: multiTenancyPlayground,
  compress: indexCompressionPlayground,
  choosevs: storeSelectionPlayground,
};

export const createVectorDatabasesModule = (): FeatureModule => buildFeatureModule({
  title: 'Vector databases',
  moduleJson,
  contentFiles: import.meta.glob<{ default: unknown }>('./content/*.json', { eager: true }),
  diagramFiles: import.meta.glob<string>('./content/diagrams/*.svg', { eager: true, query: '?raw', import: 'default' }),
  playgrounds: VECTOR_DATABASES_PLAYGROUNDS,
});
