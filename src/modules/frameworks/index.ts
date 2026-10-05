/**
 * Frameworks feature module (Module 16): one shared framework chooser, highlighted per lesson —
 * plain SDK loop, Pydantic AI, LangGraph, OpenAI Agents SDK, Claude Agent SDK, Google ADK, CrewAI, TypeScript stacks and LlamaIndex.
 */
import { buildFeatureModule, type PlaygroundMap } from '@/application/FeatureModuleFactory';
import type { FeatureModule } from '@/domain/technique/FeatureModule';
import moduleJson from './content/module.json';
import {
  claudeAgentPlayground, crewPlayground, googleAdkPlayground, langGraphPlayground, llamaIndexPlayground,
  openAiAgentsPlayground, plainPlayground, pydanticPlayground, typeScriptAgentsPlayground,
} from './playgrounds/frameworkPlaygrounds';

export const FRAMEWORKS_PLAYGROUNDS: PlaygroundMap = {
  plain: plainPlayground,
  pydantic: pydanticPlayground,
  langgraph: langGraphPlayground,
  openai: openAiAgentsPlayground,
  claude: claudeAgentPlayground,
  adk: googleAdkPlayground,
  crew: crewPlayground,
  tsagents: typeScriptAgentsPlayground,
  llamaindex: llamaIndexPlayground,
};

export const createFrameworksModule = (): FeatureModule => buildFeatureModule({
  title: 'Agent Frameworks',
  moduleJson,
  contentFiles: import.meta.glob<{ default: unknown }>('./content/*.json', { eager: true }),
  diagramFiles: import.meta.glob<string>('./content/diagrams/*.svg', { eager: true, query: '?raw', import: 'default' }),
  playgrounds: FRAMEWORKS_PLAYGROUNDS,
});
