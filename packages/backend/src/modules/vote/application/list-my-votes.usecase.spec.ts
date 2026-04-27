import { ListMyVotesUseCase } from './list-my-votes.usecase';
import type { MyVoteEntry, VoteAuditRepository } from './interfaces';

/** T-084 — list-my-votes: pagination + nextCursor 계산. */
describe('ListMyVotesUseCase', () => {
  const NOW = new Date('2026-04-28T00:00:00Z');

  const makeEntry = (id: string): MyVoteEntry => ({
    id,
    roundId: 'r-1',
    roundName: 'R1',
    auditionId: 'a-1',
    auditionName: 'A',
    idolId: 'i-1',
    idolName: 'lee',
    idolStageName: null,
    idolHeroImageUrl: null,
    method: 'HEART',
    weight: 1,
    createdAt: NOW,
  });

  const makeRepo = (totalRows: number, pageItems: MyVoteEntry[]) => {
    let lastOpts: { take: number; skip: number } | null = null;
    const audit: VoteAuditRepository = {
      append: jest.fn(),
      listMyVotes: jest.fn(async (_userId, opts) => {
        lastOpts = opts;
        return { items: pageItems, total: totalRows };
      }),
    };
    return { audit, getLastOpts: () => lastOpts };
  };

  it('TC-LMV-001 — page=1, size=20 → take=20, skip=0', async () => {
    const { audit, getLastOpts } = makeRepo(0, []);
    const uc = new ListMyVotesUseCase(audit);
    await uc.execute({ userId: 'u-1', page: 1, size: 20 });
    expect(getLastOpts()).toEqual({ take: 20, skip: 0 });
  });

  it('TC-LMV-002 — page=3, size=10 → skip=20', async () => {
    const { audit, getLastOpts } = makeRepo(0, []);
    const uc = new ListMyVotesUseCase(audit);
    await uc.execute({ userId: 'u-1', page: 3, size: 10 });
    expect(getLastOpts()).toEqual({ take: 10, skip: 20 });
  });

  it('TC-LMV-003 — page<1 클램프 → page=1, skip=0', async () => {
    const { audit, getLastOpts } = makeRepo(0, []);
    const uc = new ListMyVotesUseCase(audit);
    await uc.execute({ userId: 'u-1', page: 0, size: 10 });
    expect(getLastOpts()).toEqual({ take: 10, skip: 0 });
  });

  it('TC-LMV-004 — size>50 → 50 클램프', async () => {
    const { audit, getLastOpts } = makeRepo(0, []);
    const uc = new ListMyVotesUseCase(audit);
    await uc.execute({ userId: 'u-1', page: 1, size: 999 });
    expect(getLastOpts()?.take).toBe(50);
  });

  it('TC-LMV-005 — size<1 → 1 클램프', async () => {
    const { audit, getLastOpts } = makeRepo(0, []);
    const uc = new ListMyVotesUseCase(audit);
    await uc.execute({ userId: 'u-1', page: 1, size: 0 });
    expect(getLastOpts()?.take).toBe(1);
  });

  it('TC-LMV-006 — default page=1 size=20', async () => {
    const { audit, getLastOpts } = makeRepo(0, []);
    const uc = new ListMyVotesUseCase(audit);
    await uc.execute({ userId: 'u-1' });
    expect(getLastOpts()).toEqual({ take: 20, skip: 0 });
  });

  it('TC-LMV-007 — 더 있을 때 nextCursor=다음 페이지 번호', async () => {
    const items = Array.from({ length: 20 }, (_, i) => makeEntry(`v-${i}`));
    const { audit } = makeRepo(50, items);
    const uc = new ListMyVotesUseCase(audit);
    const out = await uc.execute({ userId: 'u-1', page: 1, size: 20 });
    expect(out.nextCursor).toBe('2');
    expect(out.total).toBe(50);
  });

  it('TC-LMV-008 — 마지막 페이지 → nextCursor=null', async () => {
    const items = Array.from({ length: 5 }, (_, i) => makeEntry(`v-${i}`));
    const { audit } = makeRepo(25, items); // page=2 size=20: skip=20, items=5 → consumed=25 == total
    const uc = new ListMyVotesUseCase(audit);
    const out = await uc.execute({ userId: 'u-1', page: 2, size: 20 });
    expect(out.nextCursor).toBeNull();
  });

  it('TC-LMV-009 — page float → floor 처리', async () => {
    const { audit, getLastOpts } = makeRepo(0, []);
    const uc = new ListMyVotesUseCase(audit);
    await uc.execute({ userId: 'u-1', page: 2.7, size: 10 });
    expect(getLastOpts()).toEqual({ take: 10, skip: 10 });
  });
});
