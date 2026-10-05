/** Agent-as-a-judge: verified requirements with dependencies versus a self-reported summary. */
export interface Requirement { readonly id: string; readonly text: string; readonly dependsOn: readonly string[] }

export const REQUIREMENTS: readonly Requirement[] = [
  { id: 'R1', text: 'pipeline.py runs without errors', dependsOn: [] },
  { id: 'R2', text: 'writes output as Parquet', dependsOn: ['R1'] },
  { id: 'R3', text: 'drops rows with missing dates', dependsOn: ['R2'] },
  { id: 'R4', text: 'README explains how to run it', dependsOn: [] },
];

export interface AgentJudgeState { readonly verified: Readonly<Record<string, boolean>> }

export type RequirementStatus = 'pass' | 'blocked' | 'fail';

export interface AgentJudgeResult {
  readonly naiveScore: number;
  readonly dependencyAwareScore: number;
  readonly status: Readonly<Record<string, RequirementStatus>>;
  readonly failed: readonly string[];
  readonly blocked: readonly string[];
}

export function simulateAgentJudge({ verified }: AgentJudgeState): AgentJudgeResult {
  const effective: Record<string, boolean> = {};
  for (const requirement of REQUIREMENTS) {
    effective[requirement.id] = Boolean(verified[requirement.id]) && requirement.dependsOn.every((dep) => effective[dep]);
  }
  const status: Record<string, RequirementStatus> = {};
  for (const { id } of REQUIREMENTS) status[id] = effective[id] ? 'pass' : verified[id] ? 'blocked' : 'fail';
  const count = (predicate: (id: string) => boolean) => REQUIREMENTS.filter(({ id }) => predicate(id)).length;
  return {
    naiveScore: count((id) => Boolean(verified[id])) / REQUIREMENTS.length,
    dependencyAwareScore: count((id) => Boolean(effective[id])) / REQUIREMENTS.length,
    status,
    failed: REQUIREMENTS.filter(({ id }) => status[id] === 'fail').map(({ id }) => id),
    blocked: REQUIREMENTS.filter(({ id }) => status[id] === 'blocked').map(({ id }) => id),
  };
}
