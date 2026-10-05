/**
 * Agent framework chooser. Scores are editorial judgements as of Sep 2026 on a 0–3 scale per need;
 * the same UPI-dispute agent is written in each framework (lines of code shown for comparison).
 */
export type Language = 'python' | 'ts' | 'dotnet' | 'jvm';
export type ModelCommitment = 'any' | 'claude' | 'openai' | 'gemini';
export type CloudPreference = 'none' | 'gcp' | 'azure';
export type Need = 'durable' | 'multi' | 'typed' | 'control' | 'builtin' | 'speed' | 'lean' | 'data';
export type FrameworkId = 'plain' | 'pydantic' | 'langgraph' | 'openai' | 'claude' | 'adk' | 'crew' | 'tsagents' | 'llamaindex';
/** 0 = not needed, 1 = useful, 2 = essential. */
export type NeedWeight = 0 | 1 | 2;

export const NEEDS: readonly (readonly [Need, string])[] = [
  ['durable', 'Long runs: pause, resume, survive crashes'], ['multi', 'Several collaborating agents'], ['typed', 'Typed, validated outputs'],
  ['control', 'Precise control of every step'], ['builtin', 'Built-in file, shell and web tools'], ['speed', 'Fast first prototype'],
  ['lean', 'Few dependencies, little lock-in'], ['data', 'Document ingestion and RAG built in'],
];

interface FrameworkProfile extends Readonly<Record<Need, number>> { readonly name: string; readonly langs: readonly Language[]; readonly anyModel: number; readonly loc: number }
export const FRAMEWORKS: Readonly<Record<FrameworkId, FrameworkProfile>> = {
  plain: { name: 'Plain SDK loop', langs: ['python', 'ts', 'dotnet', 'jvm'], durable: 0, multi: 1, typed: 1, control: 3, builtin: 0, speed: 2, lean: 3, data: 0, anyModel: 2, loc: 30 },
  pydantic: { name: 'Pydantic AI', langs: ['python'], durable: 2, multi: 1, typed: 3, control: 2, builtin: 1, speed: 3, lean: 2, data: 1, anyModel: 3, loc: 25 },
  langgraph: { name: 'LangGraph', langs: ['python', 'ts'], durable: 3, multi: 2, typed: 2, control: 3, builtin: 1, speed: 1, lean: 1, data: 1, anyModel: 3, loc: 23 },
  openai: { name: 'OpenAI Agents SDK', langs: ['python', 'ts'], durable: 1, multi: 2, typed: 2, control: 1, builtin: 2, speed: 3, lean: 2, data: 1, anyModel: 1, loc: 26 },
  claude: { name: 'Claude Agent SDK', langs: ['python', 'ts'], durable: 2, multi: 2, typed: 1, control: 1, builtin: 3, speed: 3, lean: 1, data: 1, anyModel: 0, loc: 31 },
  adk: { name: 'Google ADK', langs: ['python', 'ts', 'jvm'], durable: 2, multi: 3, typed: 2, control: 2, builtin: 1, speed: 2, lean: 1, data: 1, anyModel: 2, loc: 23 },
  crew: { name: 'CrewAI / MS Agent Framework', langs: ['python', 'dotnet'], durable: 1, multi: 3, typed: 1, control: 1, builtin: 1, speed: 3, lean: 1, data: 1, anyModel: 3, loc: 24 },
  tsagents: { name: 'Vercel AI SDK / Mastra', langs: ['ts'], durable: 2, multi: 2, typed: 3, control: 2, builtin: 1, speed: 3, lean: 2, data: 1, anyModel: 3, loc: 24 },
  llamaindex: { name: 'LlamaIndex', langs: ['python', 'ts'], durable: 2, multi: 2, typed: 2, control: 2, builtin: 1, speed: 2, lean: 1, data: 3, anyModel: 3, loc: 27 },
};
const LANGUAGE_NAME: Readonly<Record<Language, string>> = { python: 'Python', ts: 'TypeScript', dotnet: '.NET', jvm: 'Java or Go' };
const COMMITTED_MATCH: Readonly<Partial<Record<ModelCommitment, FrameworkId>>> = { claude: 'claude', openai: 'openai', gemini: 'adk' };
const CLOUD_MATCH: Readonly<Partial<Record<CloudPreference, FrameworkId>>> = { gcp: 'adk', azure: 'crew' };

export type ChooserState = Readonly<Record<Need, NeedWeight>> & { readonly lang: Language; readonly model: ModelCommitment; readonly cloud: CloudPreference };
export interface RankedFramework { readonly id: FrameworkId; readonly name: string; readonly score: number; readonly fit: number; readonly strengths: readonly string[]; readonly loc: number }
export interface ExcludedFramework { readonly id: FrameworkId; readonly name: string; readonly reason: string }
export interface ChooserResult {
  readonly ranked: readonly RankedFramework[]; readonly excluded: readonly ExcludedFramework[]; readonly top: FrameworkId | null;
  /** Position of the highlighted framework (1-based), or null when it is ruled out. */
  readonly rank: number | null; readonly ruledOut: boolean;
}

export const BASE_NEEDS: ChooserState = { lang: 'python', model: 'any', cloud: 'none', durable: 1, multi: 1, typed: 1, control: 1, builtin: 1, speed: 1, lean: 1, data: 0 };

function exclusionReason(id: FrameworkId, s: ChooserState): string | null {
  if (id === 'claude' && s.model !== 'claude') return s.model === 'any' ? 'Claude models only' : 'needs Claude models';
  if (!FRAMEWORKS[id].langs.includes(s.lang)) return `no ${LANGUAGE_NAME[s.lang]} version`;
  return null;
}

export function rankFrameworks(s: ChooserState, highlight: FrameworkId): ChooserResult {
  const weightSum = NEEDS.reduce((a, [n]) => a + s[n], 0);
  const maxScore = 3 * weightSum + (s.model === 'any' ? 6 : 4) + (s.cloud !== 'none' ? 3 : 0);
  const ranked: RankedFramework[] = []; const excluded: ExcludedFramework[] = [];
  for (const id of Object.keys(FRAMEWORKS) as FrameworkId[]) {
    const f = FRAMEWORKS[id];
    const reason = exclusionReason(id, s);
    if (reason) { excluded.push({ id, name: f.name, reason }); continue; }
    let score = NEEDS.reduce((a, [n]) => a + s[n] * f[n], 0);
    if (s.model === 'any') score += 2 * f.anyModel;
    if (COMMITTED_MATCH[s.model] === id) score += 4;
    if (CLOUD_MATCH[s.cloud] === id) score += 3;
    const strengths = NEEDS.map(([n, label]) => [label.toLowerCase(), s[n] * f[n]] as const).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([l]) => l);
    ranked.push({ id, name: f.name, score, fit: maxScore ? score / maxScore : 0, strengths, loc: f.loc });
  }
  // Ties: the leaner framework first; otherwise keep the legacy comparator so published rankings stay identical.
  ranked.sort((a, b) => b.score - a.score || (FRAMEWORKS[a.id].lean < FRAMEWORKS[b.id].lean ? 1 : -1));
  const position = ranked.findIndex((r) => r.id === highlight);
  return { ranked, excluded, top: ranked[0]?.id ?? null, rank: position < 0 ? null : position + 1, ruledOut: position < 0 };
}
