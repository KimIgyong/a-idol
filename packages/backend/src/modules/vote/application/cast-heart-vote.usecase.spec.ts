import { ErrorCodes } from '@a-idol/shared';
import { CastHeartVoteUseCase } from './cast-heart-vote.usecase';
import type {
  VoteAuditRepository,
  VoteCounterRepository,
} from './interfaces';
import type {
  RoundRecord,
  RoundRepository,
} from '../../audition/application/interfaces';
import type {
  VoteRuleRecord,
  VoteRuleRepository,
} from '../../audition/application/vote-rule-interfaces';

const ROUND: RoundRecord = {
  id: 'round-1',
  auditionId: 'aud-1',
  name: 'R1',
  orderIndex: 1,
  status: 'ACTIVE',
  startAt: new Date(),
  endAt: new Date(Date.now() + 7 * 86400_000),
  maxAdvancers: 10,
};

const RULE: VoteRuleRecord = {
  roundId: 'round-1',
  heartWeight: 1,
  smsWeight: 0,
  ticketWeight: 10,
  dailyHeartLimit: 2,
  updatedAt: new Date(),
};

function makeDeps(opts: {
  round?: RoundRecord | null;
  rule?: VoteRuleRecord | null;
  entry?: { eliminatedAtRoundId: string | null } | null;
  initialDaily?: number;
}) {
  const state = {
    daily: opts.initialDaily ?? 0,
    score: 0,
  };

  const rounds: RoundRepository = {
    findById: jest.fn(async () => ('round' in opts ? opts.round : ROUND) ?? null),
    create: jest.fn(),
    listByAudition: jest.fn(),
    update: jest.fn(),
    setStatus: jest.fn(),
    delete: jest.fn(),
  };
  const rules: VoteRuleRepository = {
    findByRound: jest.fn(async () => ('rule' in opts ? opts.rule : RULE) ?? null),
    upsert: jest.fn(),
    delete: jest.fn(),
  };
  const counters: VoteCounterRepository = {
    incrDaily: jest.fn(async () => ++state.daily),
    decrDaily: jest.fn(async () => {
      state.daily -= 1;
    }),
    incrIdolScore: jest.fn(async ({ weight }) => {
      state.score += weight;
      return state.score;
    }),
    decrIdolScore: jest.fn(async ({ weight }) => {
      state.score -= weight;
    }),
    topForRound: jest.fn(async () => []),
    readDaily: jest.fn(async () => state.daily),
  };
  const audit: VoteAuditRepository = {
    append: jest.fn(async () => undefined),
    listMyVotes: jest.fn(async () => ({ items: [], total: 0 })),
  };

  // Stub the prisma dependency — the usecase only calls `.auditionEntry.findFirst`.
  const entryValue = 'entry' in opts ? opts.entry : { eliminatedAtRoundId: null };
  const prisma = {
    auditionEntry: {
      findFirst: jest.fn(async () => entryValue),
    },
  } as unknown as import('../../../shared/prisma/prisma.service').PrismaService;

  return { rounds, rules, counters, audit, prisma, state };
}

describe('CastHeartVoteUseCase', () => {
  it('TC-CV001 — happy path increments daily and leaderboard score by weight', async () => {
    const d = makeDeps({});
    const uc = new CastHeartVoteUseCase(d.rounds, d.rules, d.counters, d.audit, d.prisma);
    const res = await uc.execute({
      userId: 'u1',
      roundId: 'round-1',
      idolId: 'idol-1',
    });
    expect(res.dailyUsed).toBe(1);
    expect(res.weightApplied).toBe(1);
    expect(res.scoreAfter).toBe(1);
    expect(d.audit.append).toHaveBeenCalledTimes(1);
  });

  it('TC-CV002 — daily limit exceed rolls back the daily counter', async () => {
    const d = makeDeps({ initialDaily: 2 }); // already at limit
    const uc = new CastHeartVoteUseCase(d.rounds, d.rules, d.counters, d.audit, d.prisma);
    await expect(
      uc.execute({ userId: 'u1', roundId: 'round-1', idolId: 'idol-1' }),
    ).rejects.toMatchObject({ code: ErrorCodes.VOTE_DAILY_LIMIT_EXCEEDED });
    expect(d.counters.decrDaily).toHaveBeenCalledTimes(1);
    expect(d.counters.incrIdolScore).not.toHaveBeenCalled();
    expect(d.audit.append).not.toHaveBeenCalled();
  });

  it('TC-CV003 — round not ACTIVE → VOTE_ROUND_NOT_ACTIVE', async () => {
    const d = makeDeps({ round: { ...ROUND, status: 'SCHEDULED' } });
    const uc = new CastHeartVoteUseCase(d.rounds, d.rules, d.counters, d.audit, d.prisma);
    await expect(
      uc.execute({ userId: 'u1', roundId: 'round-1', idolId: 'idol-1' }),
    ).rejects.toMatchObject({ code: ErrorCodes.VOTE_ROUND_NOT_ACTIVE });
    expect(d.counters.incrDaily).not.toHaveBeenCalled();
  });

  it('TC-CV004 — idol not an entry in the parent audition', async () => {
    const d = makeDeps({ entry: null });
    const uc = new CastHeartVoteUseCase(d.rounds, d.rules, d.counters, d.audit, d.prisma);
    await expect(
      uc.execute({ userId: 'u1', roundId: 'round-1', idolId: 'idol-bad' }),
    ).rejects.toMatchObject({ code: ErrorCodes.IDOL_NOT_IN_AUDITION });
  });

  it('TC-CV005 — HEART disabled (heartWeight=0) → VOTE_METHOD_NOT_ALLOWED', async () => {
    const d = makeDeps({ rule: { ...RULE, heartWeight: 0 } });
    const uc = new CastHeartVoteUseCase(d.rounds, d.rules, d.counters, d.audit, d.prisma);
    await expect(
      uc.execute({ userId: 'u1', roundId: 'round-1', idolId: 'idol-1' }),
    ).rejects.toMatchObject({ code: ErrorCodes.VOTE_METHOD_NOT_ALLOWED });
  });
});
