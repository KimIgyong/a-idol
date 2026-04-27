import { ErrorCodes } from '@a-idol/shared';
import { ReconcileLeaderboardUseCase } from './reconcile-leaderboard.usecase';

function makeDeps(opts: {
  roundExists?: boolean;
  groupRows?: Array<{ idolId: string; sum: number | null }>;
}) {
  const execMock = jest.fn(async () => [] as unknown);
  const multi = {
    del: jest.fn().mockReturnThis(),
    zadd: jest.fn().mockReturnThis(),
    exec: execMock,
  };
  const redis = {
    multi: jest.fn(() => multi),
    del: jest.fn(async () => 0),
  };
  const prisma = {
    round: {
      findUnique: jest.fn(async () =>
        opts.roundExists === false ? null : { id: 'round-1' },
      ),
    },
    vote: {
      groupBy: jest.fn(async () =>
        (opts.groupRows ?? []).map((r) => ({
          idolId: r.idolId,
          _sum: { weight: r.sum },
        })),
      ),
    },
  } as unknown as import('../../../shared/prisma/prisma.service').PrismaService;
  return { prisma, redis, multi, execMock };
}

describe('ReconcileLeaderboardUseCase', () => {
  it('TC-REC001 — empty audit table → DEL key, zero entries written', async () => {
    const d = makeDeps({ groupRows: [] });
    const uc = new ReconcileLeaderboardUseCase(d.prisma, d.redis as never);
    const res = await uc.execute('round-1');
    expect(res.sourceRows).toBe(0);
    expect(res.entriesWritten).toBe(0);
    expect(res.totalScore).toBe(0);
    expect(d.redis.del).toHaveBeenCalledWith('vote:leaderboard:r:round-1');
    expect(d.multi.zadd).not.toHaveBeenCalled();
  });

  it('TC-REC002 — audit rows → DEL + ZADD with summed weights', async () => {
    const d = makeDeps({
      groupRows: [
        { idolId: 'idol-a', sum: 15 },
        { idolId: 'idol-b', sum: 3 },
      ],
    });
    const uc = new ReconcileLeaderboardUseCase(d.prisma, d.redis as never);
    const res = await uc.execute('round-1');
    expect(res.sourceRows).toBe(2);
    expect(res.entriesWritten).toBe(2);
    expect(res.totalScore).toBe(18);
    expect(d.multi.del).toHaveBeenCalledWith('vote:leaderboard:r:round-1');
    expect(d.multi.zadd).toHaveBeenCalledWith(
      'vote:leaderboard:r:round-1',
      15,
      'idol-a',
      3,
      'idol-b',
    );
    expect(d.execMock).toHaveBeenCalledTimes(1);
  });

  it('TC-REC003 — skips idols with 0/null score', async () => {
    const d = makeDeps({
      groupRows: [
        { idolId: 'idol-a', sum: 10 },
        { idolId: 'idol-zero', sum: 0 },
        { idolId: 'idol-null', sum: null },
      ],
    });
    const uc = new ReconcileLeaderboardUseCase(d.prisma, d.redis as never);
    const res = await uc.execute('round-1');
    expect(res.sourceRows).toBe(3);
    expect(res.entriesWritten).toBe(1);
    expect(d.multi.zadd).toHaveBeenCalledWith(
      'vote:leaderboard:r:round-1',
      10,
      'idol-a',
    );
  });

  it('TC-REC004 — unknown round → ROUND_NOT_FOUND', async () => {
    const d = makeDeps({ roundExists: false });
    const uc = new ReconcileLeaderboardUseCase(d.prisma, d.redis as never);
    await expect(uc.execute('nope')).rejects.toMatchObject({
      code: ErrorCodes.ROUND_NOT_FOUND,
    });
  });
});
