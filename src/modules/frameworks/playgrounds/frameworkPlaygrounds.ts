/** The nine framework lessons, each a chooser highlighting one framework with its own presets and missions. */
import { BASE_NEEDS as B } from '../simulators/frameworkChooser';
import { SCENARIOS as S } from './chooserPresets';
import { createChooserPlayground } from './createChooserPlayground';

export const plainPlayground = createChooserPlayground({
  id: 'plain',
  presets: { start: { state: B, expected: { top: 'pydantic', rank: 7 } }, simple: { state: S.simple, expected: { top: 'plain' } }, bank: { state: S.bank, expected: { top: 'langgraph', rank: 5 } }, dotnet: { state: S.dotnet, expected: { top: 'crew', rank: 2 } } },
  missions: {
    top: ({ result }) => result.top === 'plain',
    lose: ({ state, result }) => state.durable === 2 && state.multi === 2 && (result.rank ?? 99) >= 4,
    lang: ({ state, result }) => result.top === 'plain' && state.lang !== 'python',
  },
});

export const pydanticPlayground = createChooserPlayground({
  id: 'pydantic',
  presets: { start: { state: S.claudeCommit, expected: { top: 'claude', rank: 2 } }, typed: { state: S.typed, expected: { top: 'pydantic' } }, bank: { state: S.bank, expected: { top: 'langgraph', rank: 2 } }, java: { state: S.java, expected: { top: 'adk', ruledOut: true } } },
  missions: {
    top: ({ result }) => result.top === 'pydantic',
    typed: ({ state, result }) => result.top === 'pydantic' && state.typed === 2 && state.model === 'any',
    out: ({ result }) => result.ruledOut,
  },
});

export const langGraphPlayground = createChooserPlayground({
  id: 'langgraph',
  presets: { start: { state: B, expected: { top: 'pydantic', rank: 2 } }, bank: { state: S.bank, expected: { top: 'langgraph' } }, proto: { state: S.proto, expected: { top: 'openai', rank: 6 } }, simple: { state: S.simple, expected: { top: 'plain', rank: 3 } } },
  missions: {
    top: ({ result }) => result.top === 'langgraph',
    durable: ({ state, result }) => result.top === 'langgraph' && state.durable === 2 && state.control === 2,
    drop: ({ state, result }) => state.speed === 2 && state.durable === 0 && (result.rank ?? 99) >= 4,
  },
});

export const openAiAgentsPlayground = createChooserPlayground({
  id: 'openai',
  presets: { start: { state: B, expected: { top: 'pydantic', rank: 6 } }, proto: { state: S.proto, expected: { top: 'openai' } }, typed: { state: S.typed, expected: { top: 'pydantic', rank: 7 } }, dotnet: { state: S.dotnet, expected: { top: 'crew', ruledOut: true } } },
  missions: {
    top: ({ result }) => result.top === 'openai',
    model: ({ state, result }) => result.top === 'openai' && state.model === 'openai',
    out: ({ result }) => result.ruledOut,
  },
});

export const claudeAgentPlayground = createChooserPlayground({
  id: 'claude',
  presets: { start: { state: { ...B, model: 'claude', durable: 2, control: 2, builtin: 0, speed: 0 }, expected: { top: 'langgraph', rank: 4 } }, ops: { state: S.ops, expected: { top: 'claude' } }, claudecommit: { state: S.claudeCommit, expected: { top: 'claude' } }, proto: { state: S.proto, expected: { top: 'openai', ruledOut: true } } },
  missions: {
    top: ({ result }) => result.top === 'claude',
    builtin: ({ state, result }) => result.top === 'claude' && state.builtin === 2,
    out: ({ result }) => result.ruledOut,
  },
});

export const googleAdkPlayground = createChooserPlayground({
  id: 'adk',
  presets: { start: { state: B, expected: { top: 'pydantic', rank: 5 } }, java: { state: S.java, expected: { top: 'adk' } }, bank: { state: S.bank, expected: { top: 'langgraph', rank: 4 } }, dotnet: { state: S.dotnet, expected: { top: 'crew', ruledOut: true } } },
  missions: {
    top: ({ result }) => result.top === 'adk',
    jvm: ({ state, result }) => result.top === 'adk' && state.lang === 'jvm',
    gcp: ({ state, result }) => result.top === 'adk' && state.lang === 'python' && state.cloud === 'gcp',
  },
});

export const crewPlayground = createChooserPlayground({
  id: 'crew',
  presets: { start: { state: B, expected: { top: 'pydantic', rank: 4 } }, dotnet: { state: S.dotnet, expected: { top: 'crew' } }, typed: { state: S.typed, expected: { top: 'pydantic', rank: 4 } }, java: { state: S.java, expected: { top: 'adk', ruledOut: true } } },
  missions: {
    top: ({ result }) => result.top === 'crew',
    dotnet: ({ state, result }) => result.top === 'crew' && state.lang === 'dotnet',
    single: ({ state, result }) => state.multi === 2 && state.durable === 2 && state.control === 2 && result.top !== 'crew',
  },
});

export const typeScriptAgentsPlayground = createChooserPlayground({
  id: 'tsagents',
  presets: {
    start: { state: { ...B, lang: 'ts', model: 'claude' }, expected: { top: 'claude', rank: 2 } },
    web: { state: { ...B, lang: 'ts', typed: 2, speed: 2, lean: 1 }, expected: { top: 'tsagents' } },
    tsdurable: { state: { ...B, lang: 'ts', durable: 2, control: 2, speed: 0, typed: 0 }, expected: { top: 'langgraph', rank: 2 } },
    python: { state: B, expected: { top: 'pydantic', ruledOut: true } },
  },
  missions: {
    top: ({ result }) => result.top === 'tsagents',
    any: ({ state, result }) => result.top === 'tsagents' && state.model === 'any' && state.typed === 2,
    out: ({ result }) => result.ruledOut,
  },
});

export const llamaIndexPlayground = createChooserPlayground({
  id: 'llamaindex',
  presets: { start: { state: B, expected: { top: 'pydantic', rank: 3 } }, rag: { state: { ...B, data: 2 }, expected: { top: 'llamaindex' } }, ragts: { state: { ...B, lang: 'ts', data: 2 }, expected: { top: 'llamaindex' } }, bank: { state: S.bank, expected: { top: 'langgraph', rank: 3 } } },
  missions: {
    top: ({ result }) => result.top === 'llamaindex',
    data: ({ state, result }) => result.top === 'llamaindex' && state.data === 2 && state.lang === 'ts',
    drop: ({ state, result }) => state.data === 0 && (result.rank ?? 0) >= 5,
  },
});
