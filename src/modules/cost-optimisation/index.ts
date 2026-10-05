/**
 * Cost optimisation feature module (Module 3): routing, caching, agent cost controls,
 * context pruning, scheduling, batch processing, semantic caching and cost attribution.
 */
import { buildFeatureModule, type PlaygroundMap } from '@/application/FeatureModuleFactory';
import type { FeatureModule } from '@/domain/technique/FeatureModule';
import moduleJson from './content/module.json';
import { agentCostControlsPlayground } from './playgrounds/agentCostControls.playground';
import { batchProcessingPlayground } from './playgrounds/batchProcessing.playground';
import { contextPruningPlayground } from './playgrounds/contextPruning.playground';
import { costAttributionPlayground } from './playgrounds/costAttribution.playground';
import { modelRoutingPlayground } from './playgrounds/modelRouting.playground';
import { promptCachingPlayground } from './playgrounds/promptCaching.playground';
import { semanticCachePlayground } from './playgrounds/semanticCache.playground';
import { workloadSchedulingPlayground } from './playgrounds/workloadScheduling.playground';

export const COST_OPTIMISATION_PLAYGROUNDS: PlaygroundMap = {
  routing: modelRoutingPlayground,
  caching: promptCachingPlayground,
  controls: agentCostControlsPlayground,
  pruning: contextPruningPlayground,
  scheduling: workloadSchedulingPlayground,
  batch: batchProcessingPlayground,
  semcache: semanticCachePlayground,
  costattr: costAttributionPlayground,
};

export const createCostOptimisationModule = (): FeatureModule => buildFeatureModule({
  title: 'Cost optimisation',
  moduleJson,
  contentFiles: import.meta.glob<{ default: unknown }>('./content/*.json', { eager: true }),
  diagramFiles: import.meta.glob<string>('./content/diagrams/*.svg', { eager: true, query: '?raw', import: 'default' }),
  playgrounds: COST_OPTIMISATION_PLAYGROUNDS,
});
