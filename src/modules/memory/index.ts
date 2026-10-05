/**
 * Memory feature module (Module 9): context budgets, short-term, semantic, episodic and procedural memory,
 * memory writing, memory tools and graph memory.
 */
import { buildFeatureModule, type PlaygroundMap } from '@/application/FeatureModuleFactory';
import type { FeatureModule } from '@/domain/technique/FeatureModule';
import moduleJson from './content/module.json';
import { contextBudgetPlayground } from './playgrounds/contextBudget.playground';
import { episodicMemoryPlayground } from './playgrounds/episodicMemory.playground';
import { graphMemoryPlayground } from './playgrounds/graphMemory.playground';
import { memoryToolsPlayground } from './playgrounds/memoryTools.playground';
import { memoryWritingPlayground } from './playgrounds/memoryWriting.playground';
import { proceduralMemoryPlayground } from './playgrounds/proceduralMemory.playground';
import { semanticMemoryPlayground } from './playgrounds/semanticMemory.playground';
import { shortTermMemoryPlayground } from './playgrounds/shortTermMemory.playground';

export const MEMORY_PLAYGROUNDS: PlaygroundMap = {
  ctxbudget: contextBudgetPlayground,
  stm: shortTermMemoryPlayground,
  semmem: semanticMemoryPlayground,
  epimem: episodicMemoryPlayground,
  memwrite: memoryWritingPlayground,
  memtools: memoryToolsPlayground,
  procmem: proceduralMemoryPlayground,
  graphmem: graphMemoryPlayground,
};

export const createMemoryModule = (): FeatureModule => buildFeatureModule({
  title: 'Memory',
  moduleJson,
  contentFiles: import.meta.glob<{ default: unknown }>('./content/*.json', { eager: true }),
  diagramFiles: import.meta.glob<string>('./content/diagrams/*.svg', { eager: true, query: '?raw', import: 'default' }),
  playgrounds: MEMORY_PLAYGROUNDS,
});
