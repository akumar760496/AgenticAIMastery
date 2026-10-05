/** A real IVF index: k-means lists over 800 clustered 2-D vectors, scored on 40 queries against exact search. */
import { gaussian, seededRandom } from '@/shared/random';
import { exactTopK, recallAt, squaredDistance, type Vector } from './vectorMath';

const CENTRES: readonly Vector[] = [[0.16, 0.2], [0.5, 0.14], [0.84, 0.22], [0.2, 0.52], [0.54, 0.48], [0.86, 0.58], [0.3, 0.84], [0.72, 0.84]];
const EARLY_ROWS = 80;
const KMEANS_ITERATIONS = 12;
export const LIST_OPTIONS = [4, 8, 16, 32, 64] as const;
export type ListCount = (typeof LIST_OPTIONS)[number];

export const IVF_DATA = (() => {
  const r = seededRandom(97);
  const points: Vector[] = [];
  for (const c of CENTRES) for (let i = 0; i < 100; i++) points.push([(c[0] ?? 0) + gaussian(r) * 0.1, (c[1] ?? 0) + gaussian(r) * 0.1]);
  const queries: Vector[] = [];
  for (let i = 0; i < 40; i++) { const c = CENTRES[Math.floor(r() * 8)]!; queries.push([(c[0] ?? 0) + gaussian(r) * 0.13, (c[1] ?? 0) + gaussian(r) * 0.13]); }
  return { points, queries, truth: queries.map((q) => exactTopK(points, q, 10)) };
})();

const nearest = (p: Vector, centroids: readonly Vector[]) => {
  let best = 0;
  let bestD = 1e9;
  centroids.forEach((c, j) => { const d = squaredDistance(p, c); if (d < bestD) { bestD = d; best = j; } });
  return best;
};

function kMeans(training: readonly Vector[], k: number): Vector[] {
  let centroids: Vector[] = Array.from({ length: k }, (_, i) => [...training[Math.floor(((i + 0.5) * training.length) / k)]!]);
  for (let it = 0; it < KMEANS_ITERATIONS; it++) {
    const sums = centroids.map(() => [0, 0, 0]);
    for (const p of training) { const s = sums[nearest(p, centroids)]!; s[0]! += p[0] ?? 0; s[1]! += p[1] ?? 0; s[2]! += 1; }
    centroids = centroids.map((c, j) => { const s = sums[j]!; return s[2] ? [s[0]! / s[2], s[1]! / s[2]] : c; });
  }
  return centroids;
}

const buildCache = new Map<string, { centroids: Vector[]; lists: number[][] }>();
function build(lists: number, early: boolean) {
  const key = `${lists}-${early}`;
  const cached = buildCache.get(key);
  if (cached) return cached;
  const centroids = kMeans(early ? IVF_DATA.points.slice(0, EARLY_ROWS) : IVF_DATA.points, lists);
  const inverted: number[][] = centroids.map(() => []);
  IVF_DATA.points.forEach((p, i) => inverted[nearest(p, centroids)]!.push(i));
  const built = { centroids, lists: inverted };
  buildCache.set(key, built);
  return built;
}

export interface IvfState { readonly lists: ListCount; readonly probes: number; readonly earlyTraining: boolean }
export interface IvfResult {
  readonly recall: number;
  readonly scanned: number;
  readonly largestListShare: number;
  readonly probes: number;
  /** First query, its probed lists and the vectors in them, for display. */
  readonly sample: { readonly probedLists: readonly number[]; readonly probedVectors: number };
}

export function simulateIvf(s: IvfState): IvfResult {
  const probes = Math.min(s.probes, s.lists);
  const { centroids, lists } = build(s.lists, s.earlyTraining);
  const { points, queries, truth } = IVF_DATA;
  let recall = 0;
  let scanned = 0;
  let sample = { probedLists: [] as number[], probedVectors: 0 };
  queries.forEach((q, qi) => {
    const order = centroids.map((c, j): [number, number] => [squaredDistance(c, q), j]).sort((a, b) => a[0] - b[0]).slice(0, probes).map(([, j]) => j);
    const candidates = order.flatMap((j) => lists[j] ?? []);
    const got = candidates.map((i): [number, number] => [squaredDistance(points[i]!, q), i]).sort((a, b) => a[0] - b[0]).slice(0, 10).map(([, i]) => i);
    recall += recallAt(got, truth[qi] ?? []);
    scanned += candidates.length / points.length;
    if (qi === 0) sample = { probedLists: order, probedVectors: candidates.length };
  });
  return {
    recall: recall / queries.length,
    scanned: scanned / queries.length,
    largestListShare: Math.max(...lists.map((l) => l.length)) / points.length,
    probes, sample,
  };
}
