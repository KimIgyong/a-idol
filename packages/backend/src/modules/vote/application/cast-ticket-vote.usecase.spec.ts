import { ErrorCodes, DomainError } from '@a-idol/shared';
import { CastTicketVoteUseCase } from './cast-ticket-vote.usecase';
import type {
  VoteAuditRepository,
  VoteCounterRepository,
} from './interfaces';
import type {
  RoundVoteTicketBalanceRecord,
  VoteTicketBalanceRecord,
  VoteTicketLedgerEntry,
  VoteTicketRepository,
} from './ticket-interfaces';
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
  global?: number;
  round_?: number;
  scoreIncrFails?: boolean;
}) {
  const state = {
    global: opts.global ?? 0,
    round: opts.round_ ?? 0,
    score: 0,
    lastSource: null as 'ROUND' | 'GLOBAL' | null,
  };
  const entry = (delta: number, balanceAfter: number): VoteTicketLedgerEntry => ({
    delta,
    reason: delta < 0 ? 'VOTE_CAST' : 'REFUND',
    balanceAfter,
    memo: null,
    createdAt: new Date(),
  });
  const globalBalance = (): VoteTicketBalanceRecord => ({
    userId: 'u1',
    balance: state.global,
    updatedAt: new Date(),
  });
  const roundBalance = (): RoundVoteTicketBalanceRecord => ({
    userId: 'u1',
    roundId: 'round-1',
    balance: state.round,
    updatedAt: new Date(),
  });

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
    incrDaily: jest.fn(),
    decrDaily: jest.fn(),
    incrIdolScore: jest.fn(async ({ weight }) => {
      if (opts.scoreIncrFails) throw new Error('redis down');
      state.score += weight;
      return state.score;
    }),
    decrIdolScore: jest.fn(),
    topForRound: jest.fn(async () => []),
    readDaily: jest.fn(),
  };
  const audit: VoteAuditRepository = {
    append: jest.fn(async () => undefined),
    listMyVotes: jest.fn(async () => ({ items: [], total: 0 })),
  };
  const tickets: VoteTicketRepository = {
    getOrInitBalance: jest.fn(async () => globalBalance()),
    listRoundBalances: jest.fn(async () => (state.round > 0 ? [roundBalance()] : [])),
    grant: jest.fn(async ({ amount }) => {
      state.global += amount;
      return { balance: globalBalance(), entry: entry(amount, state.global) };
    }),
    grantRound: jest.fn(async ({ amount }) => {
      state.round += amount;
      return { balance: roundBalance(), entry: entry(amount, state.round) };
    }),
    consumeOne: jest.fn(async (_userId, _roundId) => {
      if (state.round > 0) {
        state.round -= 1;
        state.lastSource = 'ROUND';
        return {
          source: 'ROUND' as const,
          global: globalBalance(),
          round: roundBalance(),
          entry: entry(-1, state.round),
        };
      }
      if (state.global > 0) {
        state.global -= 1;
        state.lastSource = 'GLOBAL';
        return {
          source: 'GLOBAL' as const,
          global: globalBalance(),
          round: null,
          entry: entry(-1, state.global),
        };
      }
      throw new DomainError(ErrorCodes.NOT_ENOUGH_TICKETS, 'none');
    }),
    refundOne: jest.fn(async (_userId, _roundId, source) => {
      if (source === 'ROUND') state.round += 1;
      else state.global += 1;
    }),
  };

  const entryValue = 'entry' in opts ? opts.entry : { eliminatedAtRoundId: null };
  const prisma = {
    auditionEntry: {
      findFirst: jest.fn(async () => entryValue),
    },
  } as unknown as import('../../../shared/prisma/prisma.service').PrismaService;

  return { rounds, rules, counters, audit, tickets, prisma, state };
}

describe('CastTicketVoteUseCase', () => {
  it('TC-CV101 — happy path (global only): spend from global, weight applied', async () => {
    const d = makeDeps({ global: 3 });
    const uc = new CastTicketVoteUseCase(
      d.rounds, d.rules, d.counters, d.audit, d.tickets, d.prisma,
    );
    const res = await uc.execute({ userId: 'u1', roundId: 'round-1', idolId: 'idol-1' });
    expect(res.source).toBe('GLOBAL');
    expect(res.weightApplied).toBe(10);
    expect(res.scoreAfter).toBe(10);
    expect(res.ticketBalanceAfter).toBe(2); // global 3→2, round 0
    expect(d.state.global).toBe(2);
    expect(d.state.round).toBe(0);
  });

  it('TC-CV102 — zero tickets both buckets → NOT_ENOUGH_TICKETS', async () => {
    const d = makeDeps({ global: 0, round_: 0 });
    const uc = new CastTicketVoteUseCase(
      d.rounds, d.rules, d.counters, d.audit, d.tickets, d.prisma,
    );
    await expect(
      uc.execute({ userId: 'u1', roundId: 'round-1', idolId: 'idol-1' }),
    ).rejects.toMatchObject({ code: ErrorCodes.NOT_ENOUGH_TICKETS });
    expect(d.counters.incrIdolScore).not.toHaveBeenCalled();
  });

  it('TC-CV103 — ticketWeight=0 → VOTE_METHOD_NOT_ALLOWED (no ticket spent from either bucket)', async () => {
    const d = makeDeps({ rule: { ...RULE, ticketWeight: 0 }, global: 3, round_: 3 });
    const uc = new CastTicketVoteUseCase(
      d.rounds, d.rules, d.counters, d.audit, d.tickets, d.prisma,
    );
    await expect(
      uc.execute({ userId: 'u1', roundId: 'round-1', idolId: 'idol-1' }),
    ).rejects.toMatchObject({ code: ErrorCodes.VOTE_METHOD_NOT_ALLOWED });
    expect(d.tickets.consumeOne).not.toHaveBeenCalled();
  });

  it('TC-CV104 — ZINCRBY failure after consume refunds to the drained bucket', async () => {
    const d = makeDeps({ global: 3, scoreIncrFails: true });
    const uc = new CastTicketVoteUseCase(
      d.rounds, d.rules, d.counters, d.audit, d.tickets, d.prisma,
    );
    await expect(
      uc.execute({ userId: 'u1', roundId: 'round-1', idolId: 'idol-1' }),
    ).rejects.toThrow('redis down');
    expect(d.tickets.refundOne).toHaveBeenCalledWith(
      'u1', 'round-1', 'GLOBAL', expect.any(String),
    );
    expect(d.state.global).toBe(3); // -1 then +1
  });

  it('TC-CV105 — round bucket drains first when both populated (T-062b)', async () => {
    const d = makeDeps({ global: 10, round_: 2 });
    const uc = new CastTicketVoteUseCase(
      d.rounds, d.rules, d.counters, d.audit, d.tickets, d.prisma,
    );
    const res = await uc.execute({ userId: 'u1', roundId: 'round-1', idolId: 'idol-1' });
    expect(res.source).toBe('ROUND');
    expect(d.state.round).toBe(1); // round 2→1
    expect(d.state.global).toBe(10); // global untouched
    expect(res.ticketBalanceAfter).toBe(11); // 10 global + 1 round
  });

  it('TC-CV106 — fall back to global after round bucket exhausted', async () => {
    const d = makeDeps({ global: 2, round_: 1 });
    const uc = new CastTicketVoteUseCase(
      d.rounds, d.rules, d.counters, d.audit, d.tickets, d.prisma,
    );
    // First spend drains ROUND (source=ROUND, round: 1→0).
    const a = await uc.execute({ userId: 'u1', roundId: 'round-1', idolId: 'idol-1' });
    expect(a.source).toBe('ROUND');
    expect(d.state.round).toBe(0);

    // Second spend falls through to GLOBAL.
    const b = await uc.execute({ userId: 'u1', roundId: 'round-1', idolId: 'idol-1' });
    expect(b.source).toBe('GLOBAL');
    expect(d.state.global).toBe(1); // global 2→1
  });

  it('TC-CV107 — refund after round-bucket spend returns to round, not global', async () => {
    const d = makeDeps({ global: 10, round_: 3, scoreIncrFails: true });
    const uc = new CastTicketVoteUseCase(
      d.rounds, d.rules, d.counters, d.audit, d.tickets, d.prisma,
    );
    await expect(
      uc.execute({ userId: 'u1', roundId: 'round-1', idolId: 'idol-1' }),
    ).rejects.toThrow('redis down');
    expect(d.tickets.refundOne).toHaveBeenCalledWith(
      'u1', 'round-1', 'ROUND', expect.any(String),
    );
    expect(d.state.round).toBe(3); // -1 then +1 to ROUND
    expect(d.state.global).toBe(10); // untouched
  });

  it('TC-CV108 — eliminated idol → no ticket consumed from either bucket', async () => {
    const d = makeDeps({
      entry: { eliminatedAtRoundId: 'prev' },
      global: 3, round_: 3,
    });
    const uc = new CastTicketVoteUseCase(
      d.rounds, d.rules, d.counters, d.audit, d.tickets, d.prisma,
    );
    await expect(
      uc.execute({ userId: 'u1', roundId: 'round-1', idolId: 'idol-1' }),
    ).rejects.toMatchObject({ code: ErrorCodes.IDOL_ELIMINATED });
    expect(d.tickets.consumeOne).not.toHaveBeenCalled();
  });
});
