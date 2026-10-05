/**
 * Composition root: wires the course content, the playground registry and the site front end.
 * Everything else depends on interfaces, so any piece can be swapped or tested in isolation.
 */
import type { PlaygroundDefinition } from './domain/playground/PlaygroundDefinition';
import { ARCHITECTURES_PLAYGROUNDS } from './modules/architectures';
import { ARCHITECTURE_SCENES } from './modules/architectures/scenes/sxScenes';
import type { SxScene } from './presentation/site/sx/SxPlayer';
import { COMPUTER_USE_PLAYGROUNDS } from './modules/computer-use';
import { COST_OPTIMISATION_PLAYGROUNDS } from './modules/cost-optimisation';
import { EMBEDDINGS_PLAYGROUNDS } from './modules/embeddings';
import { EVALUATION_PLAYGROUNDS } from './modules/evaluation';
import { FINE_TUNING_PLAYGROUNDS } from './modules/fine-tuning';
import { FRAMEWORKS_PLAYGROUNDS } from './modules/frameworks';
import { GOVERNANCE_PLAYGROUNDS } from './modules/governance';
import { GUARDRAILS_PLAYGROUNDS } from './modules/guardrails';
import { MEMORY_PLAYGROUNDS } from './modules/memory';
import { MULTI_AGENT_PLAYGROUNDS } from './modules/multi-agent';
import { OPERATIONS_PLAYGROUNDS } from './modules/operations';
import { PERFORMANCE_PLAYGROUNDS } from './modules/performance';
import { PROMPTING_PLAYGROUNDS } from './modules/prompting';
import { RAG_PLAYGROUNDS } from './modules/rag';
import { SECURITY_PLAYGROUNDS } from './modules/security';
import { TOOL_USE_PLAYGROUNDS } from './modules/tool-use';
import { VECTOR_DATABASES_PLAYGROUNDS } from './modules/vector-databases';
import hubData from './content/site/hub.json';
import type { HubData } from './presentation/site/content';
import { SiteApp } from './presentation/site/SiteApp';
import navCss from './content/site/nav.css?raw';

type PlaygroundMap = Readonly<Record<string, PlaygroundDefinition<any, any>>>;

/** Site URL slug → feature module playgrounds. */
const PLAYGROUNDS_BY_SLUG: Readonly<Record<string, PlaygroundMap>> = {
  eval: EVALUATION_PLAYGROUNDS, guard: GUARDRAILS_PLAYGROUNDS, cost: COST_OPTIMISATION_PLAYGROUNDS, embed: EMBEDDINGS_PLAYGROUNDS,
  vectordb: VECTOR_DATABASES_PLAYGROUNDS, perf: PERFORMANCE_PLAYGROUNDS, arch: ARCHITECTURES_PLAYGROUNDS, tools: TOOL_USE_PLAYGROUNDS,
  memory: MEMORY_PLAYGROUNDS, multi: MULTI_AGENT_PLAYGROUNDS, ops: OPERATIONS_PLAYGROUNDS, security: SECURITY_PLAYGROUNDS,
  prompting: PROMPTING_PLAYGROUNDS, finetune: FINE_TUNING_PLAYGROUNDS, governance: GOVERNANCE_PLAYGROUNDS, frameworks: FRAMEWORKS_PLAYGROUNDS,
  computeruse: COMPUTER_USE_PLAYGROUNDS, rag: RAG_PLAYGROUNDS,
};

/** Techniques that moved between modules: their playground lives in the module that now teaches them. */
const ALL_PLAYGROUNDS: PlaygroundMap = Object.assign({}, ...Object.values(PLAYGROUNDS_BY_SLUG));

function playgroundsFor(slug: string): PlaygroundMap {
  return { ...ALL_PLAYGROUNDS, ...(PLAYGROUNDS_BY_SLUG[slug] ?? {}) };
}

const style = (document.getElementById('navcss') as HTMLStyleElement | null) ?? document.createElement('style');
style.id = 'navcss'; style.textContent = navCss; if (!style.isConnected) document.head.prepend(style);
const root = document.getElementById('app');
if (!root) throw new Error('Missing #app root element');
const SCENES_BY_SLUG: Readonly<Record<string, Readonly<Record<string, SxScene>>>> = { arch: ARCHITECTURE_SCENES };
const app = new SiteApp(root, hubData as unknown as HubData, playgroundsFor, (slug) => SCENES_BY_SLUG[slug] ?? {});
const started = app.start();

/**
 * Dev-only hot reload for the whole app. Everything the site renders is reachable from this module —
 * the site code statically, and every module's JSON and CSS through the globs in SiteApp — so accepting
 * updates here replaces the running app in place instead of reloading the page. The route lives in the
 * hash and the learner's work in localStorage, so only the scroll position needs carrying over.
 */
if (import.meta.hot) {
  const data = import.meta.hot.data as { scrollY?: number };
  void started.then(() => {
    if (typeof data.scrollY !== 'number') return;
    const y = data.scrollY; delete data.scrollY;
    requestAnimationFrame(() => requestAnimationFrame(() => scrollTo(0, y)));
  });
  import.meta.hot.dispose(() => { data.scrollY = scrollY; app.destroy(); });
  import.meta.hot.accept();
}
