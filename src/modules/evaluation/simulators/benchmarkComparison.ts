/** Benchmark suites: public scores versus your own eval, ranked by resolve rate or cost per resolved task. */
export interface ModelScores { readonly name: string; readonly publicRate: number; readonly internalRate: number; readonly costPerTask: number }

export const MODELS: readonly ModelScores[] = [
  { name: 'Alpha', publicRate: 0.64, internalRate: 0.41, costPerTask: 0.6 },
  { name: 'Beta', publicRate: 0.58, internalRate: 0.47, costPerTask: 0.15 },
  { name: 'Gamma', publicRate: 0.52, internalRate: 0.44, costPerTask: 0.05 },
];

export interface BenchmarkState {
  readonly scoreSource: 'public' | 'internal';
  readonly rankBy: 'resolveRate' | 'costPerResolved';
  readonly tasksPerMonth: number;
}

export interface RankedModel {
  readonly name: string;
  readonly resolveRate: number;
  readonly costPerTask: number;
  readonly costPerResolved: number;
  readonly monthlyCost: number;
  readonly resolvedPerMonth: number;
}

export interface BenchmarkResult { readonly ranking: readonly RankedModel[]; readonly topModel: string; readonly betaMonthlyCost: number }

export function simulateBenchmark({ scoreSource, rankBy, tasksPerMonth }: BenchmarkState): BenchmarkResult {
  const ranking = MODELS.map((model): RankedModel => {
    const resolveRate = scoreSource === 'public' ? model.publicRate : model.internalRate;
    return {
      name: model.name,
      resolveRate,
      costPerTask: model.costPerTask,
      costPerResolved: model.costPerTask / resolveRate,
      monthlyCost: model.costPerTask * tasksPerMonth,
      resolvedPerMonth: Math.round(resolveRate * tasksPerMonth),
    };
  }).sort((x, y) => (rankBy === 'resolveRate' ? y.resolveRate - x.resolveRate : x.costPerResolved - y.costPerResolved));
  const beta = ranking.find((model) => model.name === 'Beta');
  return { ranking, topModel: ranking[0]?.name ?? '', betaMonthlyCost: beta?.monthlyCost ?? 0 };
}
