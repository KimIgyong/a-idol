import { ErrorCodes } from '@a-idol/shared';
import { GetLeaderboardUseCase } from './leaderboard.usecase';
import type { IdolMeta } from '../../catalog/application/idol-meta-cache.interface';

function makeMeta(overrides: Partial<IdolMeta> & { id: string }): IdolMeta {
  return {
    id: overrides.id,
    name: overrides.name ?? `Idol-${overrides.id}`,
    stageName: overrides.stageName ?? null,
    heroImageUrl: overrides.heroImageUrl ?? null,
  };
}

function makeDeps(opts: {
  round?: { id: string; status: 'ACTIVE' | 'CLOSED' } | null;
  top?: Array<{ idolId: string; score: number }>;
  cacheContents?: Map<string, IdolMeta>;
}) {
  const rounds = { findById: jest.fn(async () => opts.round ?? null) };
  const counters = { topForRound: jest.fn(async () => opts.top ?? []) };
  const cache = {
    getMany: jest.fn(async (ids: string[]) => {
      const out = new Map<string, IdolMeta>();
      if (opts.cacheContents) {
        for (const id of ids) {
          const entry = opts.cacheContents.get(id);
          if (entry) out.set(id, entry);
        }
      }
      return out;
    }),
    invalidate: jest.fn(async () => undefined),
  };
  return {
    uc: new GetLeaderboardUseCase(
      rounds as never,
      counters as never,
      cache as never,
    ),
    rounds,
    counters,
    cache,
  };
}

describe('GetLeaderboardUseCase — IdolMetaCache hydration', () => {
  it('TC-LB-001 — returns empty entries for an active round with no votes without hitting the cache', async () => {
    const { uc, cache } = makeDeps({
      round: { id: 'round-1', status: 'ACTIVE' },
      top: [],
    });

    const view = await uc.execute('round-1');

    expect(view).toEqual({ roundId: 'round-1', status: 'ACTIVE', entries: [] });
    expect(cache.getMany).not.toHaveBeenCalled();
  });

  it('TC-LB-002 — hydrates top entries from cache in rank order', async () => {
    const cacheContents = new Map<string, IdolMeta>([
      ['idol-a', makeMeta({ id: 'idol-a', name: 'Alice', stageName: 'A-lice' })],
      ['idol-b', makeMeta({ id: 'idol-b', name: 'Bob' })],
    ]);
    const { uc, cache, counters } = makeDeps({
      round: { id: 'round-1', status: 'ACTIVE' },
      top: [
        { idolId: 'idol-a', score: 100 },
        { idolId: 'idol-b', score: 40 },
      ],
      cacheContents,
    });

    const view = await uc.execute('round-1');

    expect(counters.topForRound).toHaveBeenCalledWith('round-1', 50);
    expect(cache.getMany).toHaveBeenCalledWith(['idol-a', 'idol-b']);
    expect(view.entries).toEqual([
      { rank: 1, idolId: 'idol-a', idolName: 'Alice', stageName: 'A-lice', heroImageUrl: null, score: 100 },
      { rank: 2, idolId: 'idol-b', idolName: 'Bob', stageName: null, heroImageUrl: null, score: 40 },
    ]);
  });

  it('TC-LB-003 — entries not present in cache fall back to "(deleted)" rather than 500', async () => {
    // Simulates a soft-deleted idol that still holds a ZSET score from when
    // it was active. The cache returns nothing and Prisma fallback (stubbed
    // empty here) also returns nothing — the view should degrade gracefully.
    const { uc } = makeDeps({
      round: { id: 'round-1', status: 'ACTIVE' },
      top: [{ idolId: 'ghost', score: 7 }],
      cacheContents: new Map(),
    });

    const view = await uc.execute('round-1');

    expect(view.entries).toEqual([
      { rank: 1, idolId: 'ghost', idolName: '(deleted)', stageName: null, heroImageUrl: null, score: 7 },
    ]);
  });

  it('TC-LB-004 — throws ROUND_NOT_FOUND for unknown round', async () => {
    const { uc } = makeDeps({ round: null });
    await expect(uc.execute('nope')).rejects.toMatchObject({
      code: ErrorCodes.ROUND_NOT_FOUND,
    });
  });
});
