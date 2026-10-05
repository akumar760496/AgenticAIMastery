/**
 * RAG pipelines feature module (Module 18): document parsing, chunking, query rewriting, re-ranking,
 * grounded citations, query planning and GraphRAG.
 */
import { buildFeatureModule, type PlaygroundMap } from '@/application/FeatureModuleFactory';
import type { FeatureModule } from '@/domain/technique/FeatureModule';
import moduleJson from './content/module.json';
import { chunkingPlayground } from './playgrounds/chunking.playground';
import { documentParsingPlayground } from './playgrounds/documentParsing.playground';
import { graphRagPlayground } from './playgrounds/graphRag.playground';
import { groundedCitationsPlayground } from './playgrounds/groundedCitations.playground';
import { queryPlanningPlayground } from './playgrounds/queryPlanning.playground';
import { queryRewritingPlayground } from './playgrounds/queryRewriting.playground';
import { rerankingPlayground } from './playgrounds/reranking.playground';

export const RAG_PLAYGROUNDS: PlaygroundMap = {
  parse: documentParsingPlayground,
  chunk: chunkingPlayground,
  llm: queryRewritingPlayground,
  rerank: rerankingPlayground,
  cite: groundedCitationsPlayground,
  qoa: queryPlanningPlayground,
  graphrag: graphRagPlayground,
};

export const createRagModule = (): FeatureModule => buildFeatureModule({
  title: 'RAG Pipelines',
  moduleJson,
  contentFiles: import.meta.glob<{ default: unknown }>('./content/*.json', { eager: true }),
  diagramFiles: import.meta.glob<string>('./content/diagrams/*.svg', { eager: true, query: '?raw', import: 'default' }),
  playgrounds: RAG_PLAYGROUNDS,
});
