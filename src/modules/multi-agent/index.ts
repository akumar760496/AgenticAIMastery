/**
 * Multi-agent systems feature module (Module 10): when to split, supervisors, handoffs, shared state,
 * debate and voting, failure modes and sub-agents.
 */
import { buildFeatureModule, type PlaygroundMap } from '@/application/FeatureModuleFactory';
import type { FeatureModule } from '@/domain/technique/FeatureModule';
import moduleJson from './content/module.json';
import { debateVotingPlayground } from './playgrounds/debateVoting.playground';
import { handoffsPlayground } from './playgrounds/handoffs.playground';
import { multiAgentFailuresPlayground } from './playgrounds/multiAgentFailures.playground';
import { sharedStatePlayground } from './playgrounds/sharedState.playground';
import { subAgentsPlayground } from './playgrounds/subAgents.playground';
import { supervisorPatternPlayground } from './playgrounds/supervisorPattern.playground';
import { whenMultiAgentPlayground } from './playgrounds/whenMultiAgent.playground';

export const MULTI_AGENT_PLAYGROUNDS: PlaygroundMap = {
  whenmulti: whenMultiAgentPlayground,
  supervisor: supervisorPatternPlayground,
  handoffs: handoffsPlayground,
  sharedstate: sharedStatePlayground,
  debate: debateVotingPlayground,
  mafail: multiAgentFailuresPlayground,
  subagents: subAgentsPlayground,
};

export const createMultiAgentModule = (): FeatureModule => buildFeatureModule({
  title: 'Multi-agent systems',
  moduleJson,
  contentFiles: import.meta.glob<{ default: unknown }>('./content/*.json', { eager: true }),
  diagramFiles: import.meta.glob<string>('./content/diagrams/*.svg', { eager: true, query: '?raw', import: 'default' }),
  playgrounds: MULTI_AGENT_PLAYGROUNDS,
});
