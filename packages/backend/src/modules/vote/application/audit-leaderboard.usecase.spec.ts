import { AuditLeaderboardUseCase } from './audit-leaderboard.usecase';

function makeDeps(opts: {
  zRangeResult?: string[];
  groupRows?: Array<{ idolId: string; sum: number | null }>;
  activeRounds?: string[];
}) {
  const redis = {
    zrange: jest.fn(async () => opts.zRangeResult ?? []),
  };
  const prisma = {
    vote: {
      groupBy: jest.fn(async () =>
        (opts.groupRows ?? []).map((r) => ({
          idolId: r.idolId,
          _sum: { weight: r.sum },
        })),
      ),
    },
    round: {
      findMany: jest.fn(async () =>
        (opts.activeRounds ?? []).map((id) => ({ id })),
      ),
    },
  } as unknown as import('../../../shared/prisma/prisma.service').PrismaService;
  return { prisma, redis };
}

describe('AuditLeaderboardUseCase', () => {
  it('TC-AUD001 — perfectly in sync → divergence 0', async () => {
    const d = makeDeps({
      zRangeResult: ['idol-a', '15', 'idol-b', '3'],
      groupRows: [
        { idolId: 'idol-a', sum: 15 },
        { idolId: 'idol-b', sum: 3 },
      ],
    });
    const uc = new AuditLeaderboardUseCase(d.prisma, d.redis as never);
    const r = await uc.execute('round-1');
    expect(r.redisSum).toBe(18);
    expect(r.auditSum).toBe(18);
    expect(r.divergenceAbs).toBe(0);
    expect(r.divergencePct).toBe(0);
    expect(r.zsetEntries).toBe(2);
  });

  it('TC-AUD002 — empty ZSET with audit votes → divergence = auditSum (100%)', async () => {
    const d = makeDeps({
      zRangeResult: [],
      groupRows: [{ idolId: 'idol-a', sum: 10 }],
    });
    const uc = new AuditLeaderboardUseCase(d.prisma, d.redis as never);
    const r = await uc.execute('round-1');
    expect(r.zsetEntries).toBe(0);
    expect(r.redisSum).toBe(0);
    expect(r.auditSum).toBe(10);
    expect(r.divergenceAbs).toBe(10);
    expect(r.divergencePct).toBe(100);
  });

  it('TC-AUD003 — partial drift (audit exceeds Redis) → positive divergence', async () => {
    const d = makeDeps({
      zRangeResult: ['idol-a', '10'],
      // audit has an extra vote that never landed in Redis
      groupRows: [{ idolId: 'idol-a', sum: 11 }],
    });
    const uc = new AuditLeaderboardUseCase(d.prisma, d.redis as never);
    const r = await uc.execute('round-1');
    expect(r.divergenceAbs).toBe(1);
    expect(r.divergencePct).toBeCloseTo(9.09, 1);
  });

  it('TC-AUD004 — zero-audit (empty round) → divergence 0 regardless of redisSum', async () => {
    const d = makeDeps({
      zRangeResult: [],
      groupRows: [],
    });
    const uc = new AuditLeaderboardUseCase(d.prisma, d.redis as never);
    const r = await uc.execute('round-1');
    expect(r.auditSum).toBe(0);
    expect(r.divergencePct).toBe(0);
  });

  it('TC-AUD005 — listActiveRoundIds returns only ACTIVE rounds via findMany filter', async () => {
    const d = makeDeps({ activeRounds: ['r1', 'r2'] });
    const uc = new AuditLeaderboardUseCase(d.prisma, d.redis as never);
    const ids = await uc.listActiveRoundIds();
    expect(ids).toEqual(['r1', 'r2']);
    expect(d.prisma.round.findMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
  });

  it('TC-AUD006 — null audit sums treated as 0', async () => {
    const d = makeDeps({
      zRangeResult: ['idol-x', '5'],
      groupRows: [{ idolId: 'idol-x', sum: null }],
    });
    const uc = new AuditLeaderboardUseCase(d.prisma, d.redis as never);
    const r = await uc.execute('round-1');
    expect(r.auditSum).toBe(0);
    expect(r.redisSum).toBe(5);
    expect(r.divergenceAbs).toBe(-5);
  });
});
