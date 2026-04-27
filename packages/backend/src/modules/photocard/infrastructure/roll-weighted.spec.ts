import { ErrorCodes } from '@a-idol/shared';
import { rollWeighted } from './prisma-photocard.repository';

type T = { id: string; name: string; dropWeight: number };

const SET: T[] = [
  { id: 'c1', name: 'common-A', dropWeight: 40 },
  { id: 'c2', name: 'common-B', dropWeight: 40 },
  { id: 'r1', name: 'rare', dropWeight: 15 },
  { id: 'l1', name: 'legendary', dropWeight: 5 },
];

/**
 * Xorshift-style deterministic PRNG seeded from a single uint32.
 * Produces the same sequence on every run so rate-of-occurrence assertions
 * are reproducible.
 */
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

describe('rollWeighted', () => {
  it('returns exactly `count` picks', () => {
    const picks = rollWeighted(SET, 7, seededRng(1));
    expect(picks).toHaveLength(7);
  });

  it('distribution roughly matches weights over many trials', () => {
    const rng = seededRng(42);
    const trials = 20_000;
    const picks = rollWeighted(SET, trials, rng);
    const counts = picks.reduce<Record<string, number>>((acc, p) => {
      acc[p.id] = (acc[p.id] ?? 0) + 1;
      return acc;
    }, {});
    // Weights sum to 100 → expected frequency = weight / 100.
    // Allow ±2.5pp slop for 20k trials.
    expect(counts.c1 / trials).toBeGreaterThan(0.375);
    expect(counts.c1 / trials).toBeLessThan(0.425);
    expect(counts.c2 / trials).toBeGreaterThan(0.375);
    expect(counts.c2 / trials).toBeLessThan(0.425);
    expect(counts.r1 / trials).toBeGreaterThan(0.125);
    expect(counts.r1 / trials).toBeLessThan(0.175);
    expect(counts.l1 / trials).toBeGreaterThan(0.025);
    expect(counts.l1 / trials).toBeLessThan(0.075);
  });

  it('zero-weight templates never pick', () => {
    const mixed = [
      ...SET,
      { id: 'dead', name: 'disabled', dropWeight: 0 },
    ];
    const picks = rollWeighted(mixed, 2_000, seededRng(7));
    expect(picks.some((p) => p.id === 'dead')).toBe(false);
  });

  it('all-zero weights throws PHOTOCARD_SET_EMPTY', () => {
    const allZero = [{ id: 'x', name: 'x', dropWeight: 0 }];
    try {
      rollWeighted(allZero, 1, seededRng(1));
      throw new Error('expected throw');
    } catch (e) {
      expect((e as { code: string }).code).toBe(ErrorCodes.PHOTOCARD_SET_EMPTY);
    }
  });

  it('deterministic with fixed seed (same input → same output)', () => {
    const a = rollWeighted(SET, 10, seededRng(123));
    const b = rollWeighted(SET, 10, seededRng(123));
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
  });
});
