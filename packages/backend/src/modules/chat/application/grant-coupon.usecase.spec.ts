import { GrantCouponUseCase } from './grant-coupon.usecase';
import type { ChatBillingRepository } from './coupon-interfaces';

/** T-084 — GrantCoupon use case. */
describe('GrantCouponUseCase', () => {
  const NOW = new Date('2026-04-27T00:00:00Z');

  const makeRepo = (): { repo: ChatBillingRepository; balance: { v: number } } => {
    const balance = { v: 0 };
    const repo: ChatBillingRepository = {
      getOrInitQuota: jest.fn(),
      getOrInitWallet: jest.fn(),
      consumeOne: jest.fn(),
      adjustWallet: jest.fn(async (input) => {
        balance.v += input.delta;
        return {
          wallet: { userId: input.userId, balance: balance.v },
          entry: {
            delta: input.delta,
            reason: input.reason,
            balanceAfter: balance.v,
            memo: input.memo ?? null,
            createdAt: NOW,
          },
        };
      }),
      listLedger: jest.fn(),
    };
    return { repo, balance };
  };

  it('TC-GC-001 — positive delta increments wallet + writes ADMIN_GRANT ledger', async () => {
    const { repo, balance } = makeRepo();
    const uc = new GrantCouponUseCase(repo);
    const out = await uc.execute({ userId: 'u-1', delta: 10 });
    expect(balance.v).toBe(10);
    expect(out.wallet.balance).toBe(10);
    expect(out.entry.reason).toBe('ADMIN_GRANT');
    expect(out.entry.delta).toBe(10);
    expect(out.entry.balanceAfter).toBe(10);
  });

  it('TC-GC-002 — negative delta deducts (refund 시나리오)', async () => {
    const { repo } = makeRepo();
    const uc = new GrantCouponUseCase(repo);
    await uc.execute({ userId: 'u-1', delta: 10 });
    const out = await uc.execute({ userId: 'u-1', delta: -3, reason: 'REFUND' });
    expect(out.wallet.balance).toBe(7);
    expect(out.entry.reason).toBe('REFUND');
  });

  it('TC-GC-003 — delta=0 → COUPON_INVALID_DELTA', async () => {
    const { repo } = makeRepo();
    const uc = new GrantCouponUseCase(repo);
    await expect(uc.execute({ userId: 'u-1', delta: 0 })).rejects.toMatchObject({
      code: 'COUPON_INVALID_DELTA',
    });
  });

  it('TC-GC-004 — non-integer delta → COUPON_INVALID_DELTA', async () => {
    const { repo } = makeRepo();
    const uc = new GrantCouponUseCase(repo);
    await expect(uc.execute({ userId: 'u-1', delta: 1.5 })).rejects.toMatchObject({
      code: 'COUPON_INVALID_DELTA',
    });
  });

  it('TC-GC-005 — memo 미지정 시 ledger memo=null', async () => {
    const { repo } = makeRepo();
    const uc = new GrantCouponUseCase(repo);
    const out = await uc.execute({ userId: 'u-1', delta: 5 });
    expect(out.entry.memo).toBeNull();
  });

  it('TC-GC-006 — reason 기본값 ADMIN_GRANT', async () => {
    const { repo } = makeRepo();
    const uc = new GrantCouponUseCase(repo);
    const out = await uc.execute({ userId: 'u-1', delta: 1 });
    expect(out.entry.reason).toBe('ADMIN_GRANT');
  });
});
