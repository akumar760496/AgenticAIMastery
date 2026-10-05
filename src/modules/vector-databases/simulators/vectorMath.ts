/** Small exact-search helpers shared by the IVF and HNSW simulators. */
export type Vector = readonly number[];
/** A (distance, id) pair, kept sorted by distance. */
export type Scored = [number, number];

export const squaredDistance = (a: Vector, b: Vector): number => {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const t = (a[i] ?? 0) - (b[i] ?? 0); s += t * t; }
  return s;
};

/** Exact top-k by squared distance, optionally restricted to allowed ids. */
export const exactTopK = (points: readonly Vector[], query: Vector, k: number, allowed?: (id: number) => boolean): number[] =>
  points.map((p, i): Scored => [squaredDistance(p, query), i]).filter(([, i]) => !allowed || allowed(i)).sort((a, b) => a[0] - b[0]).slice(0, k).map(([, i]) => i);

/** Insert into a distance-sorted list, before any equal distances. */
export const insertSorted = (list: Scored[], item: Scored): void => {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if ((list[mid]?.[0] ?? 0) < item[0]) lo = mid + 1; else hi = mid; }
  list.splice(lo, 0, item);
};

export const recallAt = (got: readonly number[], truth: readonly number[], k = 10): number => {
  const t = new Set(truth);
  return got.filter((i) => t.has(i)).length / k;
};
