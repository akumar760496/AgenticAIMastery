/**
 * Tool use and MCP feature module (Module 8): function calling, tool design, parallel calls,
 * idempotent retries, MCP, A2A, tool search, tool authorisation and agent skills.
 */
import { buildFeatureModule, type PlaygroundMap } from '@/application/FeatureModuleFactory';
import type { FeatureModule } from '@/domain/technique/FeatureModule';
import moduleJson from './content/module.json';
import { agentSkillsPlayground } from './playgrounds/agentSkills.playground';
import { agentToAgentPlayground } from './playgrounds/agentToAgent.playground';
import { functionCallingPlayground } from './playgrounds/functionCalling.playground';
import { idempotentRetriesPlayground } from './playgrounds/idempotentRetries.playground';
import { mcpProtocolPlayground } from './playgrounds/mcpProtocol.playground';
import { parallelCallsPlayground } from './playgrounds/parallelCalls.playground';
import { toolAuthPlayground } from './playgrounds/toolAuth.playground';
import { toolDesignPlayground } from './playgrounds/toolDesign.playground';
import { toolSearchPlayground } from './playgrounds/toolSearch.playground';

export const TOOL_USE_PLAYGROUNDS: PlaygroundMap = {
  fcall: functionCallingPlayground,
  tooldesign: toolDesignPlayground,
  parallel: parallelCallsPlayground,
  idempotency: idempotentRetriesPlayground,
  mcp: mcpProtocolPlayground,
  a2a: agentToAgentPlayground,
  toolsearch: toolSearchPlayground,
  toolauth: toolAuthPlayground,
  skills: agentSkillsPlayground,
};

export const createToolUseModule = (): FeatureModule => buildFeatureModule({
  title: 'Tool use and MCP',
  moduleJson,
  contentFiles: import.meta.glob<{ default: unknown }>('./content/*.json', { eager: true }),
  diagramFiles: import.meta.glob<string>('./content/diagrams/*.svg', { eager: true, query: '?raw', import: 'default' }),
  playgrounds: TOOL_USE_PLAYGROUNDS,
});
