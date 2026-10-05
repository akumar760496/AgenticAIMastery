import { describe, expect, it } from 'vitest';
import { gaussian, seededRandom } from '@/shared/random';

describe('seededRandom', () => {
  it('is deterministic for a seed and stays in (0, 1)', () => {
    const a = seededRandom(97);
    const b = seededRandom(97);
    const xs = Array.from({ length: 100 }, () => a());
    expect(xs).toEqual(Array.from({ length: 100 }, () => b()));
    expect(xs.every((x) => x > 0 && x < 1)).toBe(true);
  });
  it('produces roughly standard normal samples', () => {
    const r = seededRandom(1);
    const xs = Array.from({ length: 5000 }, () => gaussian(r));
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.abs(variance - 1)).toBeLessThan(0.1);
  });
});

import { normalCdf } from '@/shared/statistics';

describe('normalCdf', () => {
  it('matches known values', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.645)).toBeCloseTo(0.95, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });
});
