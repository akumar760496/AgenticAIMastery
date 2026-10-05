/** A real (small) HNSW with the neighbour-selection heuristic, over 1,000 clustered 24-D vectors, scored on 40 queries. */
import { gaussian, seededRandom } from '@/shared/random';
import { exactTopK, insertSorted, recallAt, squaredDistance, type Scored, type Vector } from './vectorMath';

const DIM = 24;
const CLUSTERS = 10;
export const M_OPTIONS = [4, 8, 16, 32] as const;
export const EF_CONSTRUCTION_OPTIONS = [16, 64, 200] as const;

export const HNSW_DATA = (() => {
  const r = seededRandom(311);
  const centres = Array.from({ length: CLUSTERS }, () => Array.from({ length: DIM }, () => r() * 2 - 1));
  const points: Vector[] = [];
  for (let i = 0; i < 1000; i++) points.push(centres[i % CLUSTERS]!.map((v) => v + gaussian(r) * 0.7));
  const queries: Vector[] = [];
  for (let i = 0; i < 40; i++) queries.push(centres[Math.floor(r() * CLUSTERS)]!.map((v) => v + gaussian(r) * 0.7));
  /** The tenant filter: 10% of vectors. */
  const allowed = (i: number) => Math.floor(i / 10) % 10 === 3;
  return { points, queries, allowed, truth: queries.map((q) => exactTopK(points, q, 10)), truthFiltered: queries.map((q) => exactTopK(points, q, 10, allowed)) };
})();

type Graph = { neighbours: number[][][]; entry: number; top: number; work: number; layerCounts: number[] };

function searchLayer(points: readonly Vector[], neighbours: number[][][], q: Vector, entries: Scored[], ef: number, layer: number, count: () => void): Scored[] {
  const visited = new Set(entries.map(([, i]) => i));
  const candidates = [...entries].sort((a, b) => a[0] - b[0]);
  const found = candidates.slice(0, ef);
  while (candidates.length) {
    const c = candidates.shift()!;
    if (found.length >= ef && c[0] > found[found.length - 1]![0]) break;
    for (const e of neighbours[c[1]]![layer] ?? []) {
      if (visited.has(e)) continue;
      visited.add(e);
      count();
      const d = squaredDistance(q, points[e]!);
      if (found.length < ef || d < found[found.length - 1]![0]) {
        insertSorted(candidates, [d, e]);
        insertSorted(found, [d, e]);
        if (found.length > ef) found.pop();
      }
    }
  }
  return found;
}

const graphCache = new Map<string, Graph>();
function buildGraph(m: number, efConstruction: number): Graph {
  const key = `${m}-${efConstruction}`;
  const cached = graphCache.get(key);
  if (cached) return cached;
  const points = HNSW_DATA.points;
  const levelMultiplier = 1 / Math.log(m);
  const r = seededRandom(4242);
  const neighbours: number[][][] = [];
  const levels: number[] = [];
  let entry = -1;
  let top = -1;
  let work = 0;
  const dist = (a: number, b: number) => { work++; return squaredDistance(points[a]!, points[b]!); };
  // Heuristic: keep a candidate only if it is closer to the base than to every neighbour already kept.
  const select = (candidates: readonly Scored[], max: number) => {
    const kept: number[] = [];
    for (const [d, c] of candidates) { if (kept.length >= max) break; if (kept.every((o) => d < dist(c, o))) kept.push(c); }
    return kept;
  };
  for (let i = 0; i < points.length; i++) {
    const level = Math.floor(-Math.log(1 - r()) * levelMultiplier);
    levels.push(level);
    neighbours.push(Array.from({ length: level + 1 }, () => []));
    if (entry < 0) { entry = i; top = level; continue; }
    let entries: Scored[] = [[squaredDistance(points[i]!, points[entry]!), entry]];
    for (let l = top; l > level; l--) entries = searchLayer(points, neighbours, points[i]!, entries, 1, l, () => work++).slice(0, 1);
    for (let l = Math.min(top, level); l >= 0; l--) {
      const found = searchLayer(points, neighbours, points[i]!, entries, efConstruction, l, () => work++);
      const maxLinks = l === 0 ? 2 * m : m;
      const chosen = select(found, m);
      neighbours[i]![l] = chosen;
      for (const e of chosen) {
        const links = neighbours[e]![l]!;
        links.push(i);
        if (links.length > maxLinks) neighbours[e]![l] = select(links.map((x): Scored => [dist(e, x), x]).sort((a, b) => a[0] - b[0]), maxLinks);
      }
      entries = found;
    }
    if (level > top) { top = level; entry = i; }
  }
  const layerCounts: number[] = [];
  levels.forEach((level) => { for (let l = 0; l <= level; l++) layerCounts[l] = (layerCounts[l] ?? 0) + 1; });
  const graph = { neighbours, entry, top, work, layerCounts };
  graphCache.set(key, graph);
  return graph;
}

export interface HnswState { readonly m: number; readonly efConstruction: number; readonly efSearch: number; readonly postFilter: boolean }
export interface HnswResult {
  readonly recall: number;
  /** Distance computations per query as a share of the collection. */
  readonly comparedShare: number;
  readonly returned: number;
  readonly layerCounts: readonly number[];
  /** Build work relative to M 16, ef_construction 64. */
  readonly buildWork: number;
  readonly linkMbAt5M: number;
}

export function simulateHnsw(s: HnswState): HnswResult {
  const g = buildGraph(s.m, s.efConstruction);
  const { points, queries, allowed, truth, truthFiltered } = HNSW_DATA;
  let recall = 0;
  let compared = 0;
  let returned = 0;
  queries.forEach((q, qi) => {
    let n = 0;
    const count = () => { n++; };
    let entries: Scored[] = [[squaredDistance(q, points[g.entry]!), g.entry]];
    for (let l = g.top; l > 0; l--) entries = searchLayer(points, g.neighbours, q, entries, 1, l, count).slice(0, 1);
    let got = searchLayer(points, g.neighbours, q, entries, Math.max(s.efSearch, 10), 0, count).map(([, i]) => i);
    if (s.postFilter) got = got.filter(allowed);
    got = got.slice(0, 10);
    recall += recallAt(got, (s.postFilter ? truthFiltered : truth)[qi] ?? []);
    compared += n;
    returned += got.length;
  });
  const n = queries.length;
  return {
    recall: recall / n,
    comparedShare: compared / n / points.length,
    returned: returned / n,
    layerCounts: g.layerCounts,
    buildWork: g.work / buildGraph(16, 64).work,
    linkMbAt5M: (5e6 * 2 * s.m * 4) / 1e6,
  };
}
