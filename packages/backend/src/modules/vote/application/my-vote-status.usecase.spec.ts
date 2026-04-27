import { GetMyVoteStatusUseCase } from './my-vote-status.usecase';
import type { RoundRecord, RoundRepository } from '../../audition/application/interfaces';
import type {
  VoteRuleRecord,
  VoteRuleRepository,
} from '../../audition/application/vote-rule-interfaces';
import type { VoteCounterRepository } from './interfaces';

/** T-084 — my-vote-status: 라운드 일별 heart 사용량 + 한도 + 다음 reset. */
describe('GetMyVoteStatusUseCase', () => {
  const NOW = new Date('2026-04-28T00:00:00Z');
  const PLUS_DAY = new Date(NOW.getTime() + 86_400_000);

  const makeRound = (overrides: Partial<RoundRecord> = {}): RoundRecord => ({
    id: 'r-1',
    auditionId: 'a-1',
    name: 'R1',
    orderIndex: 1,
    status: 'ACTIVE',
    startAt: NOW,
    endAt: PLUS_DAY,
    maxAdvancers: null,
    ...overrides,
  });

  const makeRule = (dailyHeartLimit: number): VoteRuleRecord => ({
    roundId: 'r-1',
    heartWeight: 1,
    smsWeight: 0,
    ticketWeight: 10,
    dailyHeartLimit,
    updatedAt: NOW,
  });

  const makeDeps = (opts: {
    round?: RoundRecord | null;
    rule?: VoteRuleRecord | null;
    dailyUsed?: number;
  }) => {
    const rounds: RoundRepository = {
      create: jest.fn(),
      findById: jest.fn(async () => opts.round ?? null),
      listByAudition: jest.fn(),
      update: jest.fn(),
      setStatus: jest.fn(),
      delete: jest.fn(),
    };
    const rules: VoteRuleRepository = {
      findByRound: jest.fn(async () => opts.rule ?? null),
      upsert: jest.fn(),
      delete: jest.fn(),
    };
    const counters: VoteCounterRepository = {
      incrDaily: jest.fn(),
      decrDaily: jest.fn(),
      incrIdolScore: jest.fn(),
      decrIdolScore: jest.fn(),
      topForRound: jest.fn(),
      readDaily: jest.fn(async () => opts.dailyUsed ?? 0),
    };
    return { rounds, rules, counters };
  };

  it('TC-MVS-001 — round 미존재 → ROUND_NOT_FOUND', async () => {
    const { rounds, rules, counters } = makeDeps({ round: null });
    const uc = new GetMyVoteStatusUseCase(rounds, rules, counters);
    await expect(uc.execute({ userId: 'u-1', roundId: 'missing' })).rejects.toMatchObject({
      code: 'ROUND_NOT_FOUND',
    });
  });

  it('TC-MVS-002 — rule 없으면 dailyLimit=0 (vote 막힘)', async () => {
    const { rounds, rules, counters } = makeDeps({ round: makeRound(), rule: null });
    const uc = new GetMyVoteStatusUseCase(rounds, rules, counters);
    const out = await uc.execute({ userId: 'u-1', roundId: 'r-1' });
    expect(out.dailyLimit).toBe(0);
    expect(out.dailyUsed).toBe(0);
    expect(out.roundId).toBe('r-1');
  });

  it('TC-MVS-003 — rule 있으면 dailyHeartLimit 노출 + dailyUsed counter 반영', async () => {
    const { rounds, rules, counters } = makeDeps({
      round: makeRound(),
      rule: makeRule(5),
      dailyUsed: 2,
    });
    const uc = new GetMyVoteStatusUseCase(rounds, rules, counters);
    const out = await uc.execute({ userId: 'u-1', roundId: 'r-1' });
    expect(out.dailyLimit).toBe(5);
    expect(out.dailyUsed).toBe(2);
  });

  it('TC-MVS-004 — counter 가 HEART method 로 호출됨', async () => {
    const { rounds, rules, counters } = makeDeps({
      round: makeRound(),
      rule: makeRule(5),
    });
    const uc = new GetMyVoteStatusUseCase(rounds, rules, counters);
    await uc.execute({ userId: 'u-1', roundId: 'r-1' });
    expect(counters.readDaily).toHaveBeenCalledWith({
      userId: 'u-1',
      roundId: 'r-1',
      method: 'HEART',
    });
  });

  it('TC-MVS-005 — resetAt 은 KST 자정 (UTC+9)', async () => {
    const { rounds, rules, counters } = makeDeps({
      round: makeRound(),
      rule: makeRule(5),
    });
    const uc = new GetMyVoteStatusUseCase(rounds, rules, counters);
    const out = await uc.execute({ userId: 'u-1', roundId: 'r-1' });
    // KST 자정 = UTC 15:00 → resetAt 의 UTC hour 가 15
    expect(out.resetAt.getUTCHours()).toBe(15);
    expect(out.resetAt.getUTCMinutes()).toBe(0);
  });
});
