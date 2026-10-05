/**
 * Embeddings feature module (Module 4): dense and sparse retrieval, multimodal search,
 * contrastive training, compression, multilingual search and late interaction.
 */
import { buildFeatureModule, type PlaygroundMap } from '@/application/FeatureModuleFactory';
import type { FeatureModule } from '@/domain/technique/FeatureModule';
import moduleJson from './content/module.json';
import { bm25Playground } from './playgrounds/bm25Ranking.playground';
import { contrastivePlayground } from './playgrounds/contrastiveTraining.playground';
import { lateInteractionPlayground } from './playgrounds/lateInteraction.playground';
import { multilingualPlayground } from './playgrounds/multilingualSearch.playground';
import { multimodalPlayground } from './playgrounds/multimodalSearch.playground';
import { semanticSearchPlayground } from './playgrounds/semanticSearch.playground';
import { vectorCompressionPlayground } from './playgrounds/vectorCompression.playground';

export const EMBEDDINGS_PLAYGROUNDS: PlaygroundMap = {
  semantic: semanticSearchPlayground,
  bm25: bm25Playground,
  multimodal: multimodalPlayground,
  contrastive: contrastivePlayground,
  dimred: vectorCompressionPlayground,
  multiling: multilingualPlayground,
  lateint: lateInteractionPlayground,
};

export const createEmbeddingsModule = (): FeatureModule => buildFeatureModule({
  title: 'Embeddings',
  moduleJson,
  contentFiles: import.meta.glob<{ default: unknown }>('./content/*.json', { eager: true }),
  diagramFiles: import.meta.glob<string>('./content/diagrams/*.svg', { eager: true, query: '?raw', import: 'default' }),
  playgrounds: EMBEDDINGS_PLAYGROUNDS,
});
