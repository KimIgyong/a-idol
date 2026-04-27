import {
  DeleteVoteRuleUseCase,
  GetVoteRuleUseCase,
  UpsertVoteRuleUseCase,
} from './vote-rule.usecases';
import type { RoundRecord, RoundRepository } from './interfaces';
import type { VoteRuleRecord, VoteRuleRepository } from './vote-rule-interfaces';

/** T-084 — vote-rule usecases. SCHEDULED 라운드만 변경 가능 + weight validation. */
describe('vote-rule usecases', () => {
  const NOW = new Date('2026-04-27T00:00:00Z');

  const makeRound = (overrides: Partial<RoundRecord> = {}): RoundRecord => ({
    id: 'r-1',
    auditionId: 'a-1',
    name: 'R1',
    orderIndex: 1,
    status: 'SCHEDULED',
    startAt: NOW,
    endAt: new Date(NOW.getTime() + 86_400_000),
    maxAdvancers: null,
    ...overrides,
  });

  const makeRule = (overrides: Partial<VoteRuleRecord> = {}): VoteRuleRecord => ({
    roundId: 'r-1',
    heartWeight: 1,
    smsWeight: 0,
    ticketWeight: 10,
    dailyHeartLimit: 1,
    updatedAt: NOW,
    ...overrides,
  });

  const makeDeps = (round: RoundRecord | null, rule: VoteRuleRecord | null = null) => {
    const upserted: VoteRuleRecord[] = [];
    const deletedIds: string[] = [];
    const repo: VoteRuleRepository = {
      upsert: jest.fn(async (input) => {
        const r = makeRule({ ...input });
        upserted.push(r);
        return r;
      }),
      findByRound: jest.fn(async () => rule),
      delete: jest.fn(async (id) => {
        deletedIds.push(id);
      }),
    };
    const rounds: RoundRepository = {
      create: jest.fn(),
      findById: jest.fn(async () => round),
      listByAudition: jest.fn(),
      update: jest.fn(),
      setStatus: jest.fn(),
      delete: jest.fn(),
    };
    return { repo, rounds, upserted, deletedIds };
  };

  // ===== Upsert =====

  it('TC-VR-001 — round 미존재 → ROUND_NOT_FOUND', async () => {
    const { repo, rounds } = makeDeps(null);
    const uc = new UpsertVoteRuleUseCase(repo, rounds);
    await expect(
      uc.execute('missing', { heartWeight: 1, smsWeight: 0, ticketWeight: 10 }),
    ).rejects.toMatchObject({ code: 'ROUND_NOT_FOUND' });
  });

  it('TC-VR-002 — ACTIVE round → ROUND_INVALID_TRANSITION', async () => {
    const { repo, rounds } = makeDeps(makeRound({ status: 'ACTIVE' }));
    const uc = new UpsertVoteRuleUseCase(repo, rounds);
    await expect(
      uc.execute('r-1', { heartWeight: 1, smsWeight: 0, ticketWeight: 10 }),
    ).rejects.toMatchObject({ code: 'ROUND_INVALID_TRANSITION' });
  });

  it('TC-VR-003 — CLOSED round → ROUND_INVALID_TRANSITION', async () => {
    const { repo, rounds } = makeDeps(makeRound({ status: 'CLOSED' }));
    const uc = new UpsertVoteRuleUseCase(repo, rounds);
    await expect(
      uc.execute('r-1', { heartWeight: 1, smsWeight: 0, ticketWeight: 10 }),
    ).rejects.toMatchObject({ code: 'ROUND_INVALID_TRANSITION' });
  });

  it('TC-VR-004 — negative weight → VOTE_RULE_INVALID_WEIGHTS', async () => {
    const { repo, rounds } = makeDeps(makeRound());
    const uc = new UpsertVoteRuleUseCase(repo, rounds);
    await expect(
      uc.execute('r-1', { heartWeight: -1, smsWeight: 0, ticketWeight: 10 }),
    ).rejects.toMatchObject({ code: 'VOTE_RULE_INVALID_WEIGHTS' });
  });

  it('TC-VR-005 — all-zero weights → VOTE_RULE_INVALID_WEIGHTS (round unvotable)', async () => {
    const { repo, rounds } = makeDeps(makeRound());
    const uc = new UpsertVoteRuleUseCase(repo, rounds);
    await expect(
      uc.execute('r-1', { heartWeight: 0, smsWeight: 0, ticketWeight: 0 }),
    ).rejects.toMatchObject({ code: 'VOTE_RULE_INVALID_WEIGHTS' });
  });

  it('TC-VR-006 — SCHEDULED + 정상 weights → upsert 호출', async () => {
    const { repo, rounds, upserted } = makeDeps(makeRound());
    const uc = new UpsertVoteRuleUseCase(repo, rounds);
    const out = await uc.execute('r-1', { heartWeight: 1, smsWeight: 0, ticketWeight: 10 });
    expect(out.roundId).toBe('r-1');
    expect(upserted).toHaveLength(1);
  });

  it('TC-VR-007 — dailyHeartLimit 미지정 시 기본값 1', async () => {
    const { repo, rounds, upserted } = makeDeps(makeRound());
    const uc = new UpsertVoteRuleUseCase(repo, rounds);
    await uc.execute('r-1', { heartWeight: 1, smsWeight: 0, ticketWeight: 10 });
    expect(upserted[0].dailyHeartLimit).toBe(1);
  });

  // ===== Get =====

  it('TC-VR-008 — Get: round 미존재 → ROUND_NOT_FOUND', async () => {
    const { repo, rounds } = makeDeps(null);
    const uc = new GetVoteRuleUseCase(repo, rounds);
    await expect(uc.execute('missing')).rejects.toMatchObject({ code: 'ROUND_NOT_FOUND' });
  });

  it('TC-VR-009 — Get: rule 미존재 → VOTE_RULE_NOT_FOUND', async () => {
    const { repo, rounds } = makeDeps(makeRound(), null);
    const uc = new GetVoteRuleUseCase(repo, rounds);
    await expect(uc.execute('r-1')).rejects.toMatchObject({ code: 'VOTE_RULE_NOT_FOUND' });
  });

  it('TC-VR-010 — Get: 정상 반환', async () => {
    const { repo, rounds } = makeDeps(makeRound(), makeRule());
    const uc = new GetVoteRuleUseCase(repo, rounds);
    const out = await uc.execute('r-1');
    expect(out.roundId).toBe('r-1');
  });

  // ===== Delete =====

  it('TC-VR-011 — Delete: round 미존재 → ROUND_NOT_FOUND', async () => {
    const { repo, rounds } = makeDeps(null);
    const uc = new DeleteVoteRuleUseCase(repo, rounds);
    await expect(uc.execute('missing')).rejects.toMatchObject({ code: 'ROUND_NOT_FOUND' });
  });

  it('TC-VR-012 — Delete: ACTIVE round → ROUND_INVALID_TRANSITION', async () => {
    const { repo, rounds } = makeDeps(makeRound({ status: 'ACTIVE' }));
    const uc = new DeleteVoteRuleUseCase(repo, rounds);
    await expect(uc.execute('r-1')).rejects.toMatchObject({ code: 'ROUND_INVALID_TRANSITION' });
  });

  it('TC-VR-013 — Delete: SCHEDULED → repo.delete 호출', async () => {
    const { repo, rounds, deletedIds } = makeDeps(makeRound());
    const uc = new DeleteVoteRuleUseCase(repo, rounds);
    await uc.execute('r-1');
    expect(deletedIds).toEqual(['r-1']);
  });
});
