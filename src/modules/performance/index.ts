/**
 * Performance feature module (Module 6): AST-aware code context, speculative decoding, prefix caching,
 * disaggregated serving, execution graphs, latency budgets, LLM serving and quantisation.
 */
import { buildFeatureModule, type PlaygroundMap } from '@/application/FeatureModuleFactory';
import type { FeatureModule } from '@/domain/technique/FeatureModule';
import moduleJson from './content/module.json';
import { astContextPlayground } from './playgrounds/astContext.playground';
import { disaggregatedServingPlayground } from './playgrounds/disaggregatedServing.playground';
import { executionGraphPlayground } from './playgrounds/executionGraph.playground';
import { latencyBudgetPlayground } from './playgrounds/latencyBudget.playground';
import { llmServingPlayground } from './playgrounds/llmServing.playground';
import { prefixCachingPlayground } from './playgrounds/prefixCaching.playground';
import { quantisationPlayground } from './playgrounds/quantisation.playground';
import { speculativeDecodingPlayground } from './playgrounds/speculativeDecoding.playground';

export const PERFORMANCE_PLAYGROUNDS: PlaygroundMap = {
  ast: astContextPlayground,
  specdec: speculativeDecodingPlayground,
  prefix: prefixCachingPlayground,
  disagg: disaggregatedServingPlayground,
  graphs: executionGraphPlayground,
  latbudget: latencyBudgetPlayground,
  serving: llmServingPlayground,
  quant: quantisationPlayground,
};

export const createPerformanceModule = (): FeatureModule => buildFeatureModule({
  title: 'Performance',
  moduleJson,
  contentFiles: import.meta.glob<{ default: unknown }>('./content/*.json', { eager: true }),
  diagramFiles: import.meta.glob<string>('./content/diagrams/*.svg', { eager: true, query: '?raw', import: 'default' }),
  playgrounds: PERFORMANCE_PLAYGROUNDS,
});
