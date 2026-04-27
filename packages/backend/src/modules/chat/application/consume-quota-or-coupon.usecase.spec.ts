import { ErrorCodes } from '@a-idol/shared';
import { ConsumeQuotaOrCouponUseCase } from './consume-quota-or-coupon.usecase';
import type {
  ChatBillingRepository,
  ConsumeOutcome,
} from './coupon-interfaces';

/**
 * These tests treat the repository as the transactional boundary and verify
 * that the usecase passes through both happy paths and the NO_COUPON failure.
 * Lazy reset and atomic decrement are covered at the integration layer (Prisma
 * impl has its own E2E).
 */
function makeRepo(outcomes: ConsumeOutcome[]): ChatBillingRepository {
  const queue = [...outcomes];
  return {
    getOrInitQuota: jest.fn(),
    getOrInitWallet: jest.fn(),
    consumeOne: jest.fn(async () => {
      const next = queue.shift();
      if (!next) throw new Error('exhausted outcome queue');
      return next;
    }),
    adjustWallet: jest.fn(),
    listLedger: jest.fn(async () => []),
  };
}

describe('ConsumeQuotaOrCouponUseCase', () => {
  it('TC-CC001 — returns quota source when daily limit not reached', async () => {
    const repo = makeRepo([
      {
        source: 'quota',
        quotaAfter: { userId: 'u1', messagesToday: 3, dailyLimit: 5, lastResetAt: new Date() },
        walletAfter: { userId: 'u1', balance: 0 },
      },
    ]);
    const uc = new ConsumeQuotaOrCouponUseCase(repo);
    const res = await uc.execute('u1');
    expect(res.source).toBe('quota');
    expect(res.quotaAfter.messagesToday).toBe(3);
  });

  it('TC-CC002 — returns coupon source when quota exhausted but wallet has balance', async () => {
    const repo = makeRepo([
      {
        source: 'coupon',
        quotaAfter: { userId: 'u1', messagesToday: 5, dailyLimit: 5, lastResetAt: new Date() },
        walletAfter: { userId: 'u1', balance: 2 },
      },
    ]);
    const uc = new ConsumeQuotaOrCouponUseCase(repo);
    const res = await uc.execute('u1');
    expect(res.source).toBe('coupon');
    expect(res.walletAfter.balance).toBe(2);
  });

  it('TC-CC003 — propagates NO_COUPON when both exhausted', async () => {
    const repo: ChatBillingRepository = {
      getOrInitQuota: jest.fn(),
      getOrInitWallet: jest.fn(),
      consumeOne: jest.fn(async () => {
        throw Object.assign(new Error('no coupon'), { code: ErrorCodes.NO_COUPON });
      }),
      adjustWallet: jest.fn(),
      listLedger: jest.fn(async () => []),
    };
    const uc = new ConsumeQuotaOrCouponUseCase(repo);
    await expect(uc.execute('u1')).rejects.toMatchObject({ code: ErrorCodes.NO_COUPON });
  });
});
