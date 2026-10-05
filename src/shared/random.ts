/** Deterministic random numbers, so simulators that sample data stay reproducible and testable. */
export type Random = () => number;

/** Park–Miller minimal standard generator; same sequence as the legacy SEED helper. */
export const seededRandom = (seed: number): Random => {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
};

/** Standard normal sample via Box–Muller. */
export const gaussian = (random: Random): number => {
  let u = 0;
  while (u === 0) u = random();
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * v);
};
