import { GetChatBalanceUseCase, nextKstMidnight } from './get-chat-balance.usecase';
import type { ChatBillingRepository } from './coupon-interfaces';

/** T-084 — GetChatBalance use case + nextKstMidnight 헬퍼. */
describe('GetChatBalanceUseCase', () => {
  const makeRepo = (
    quota: { messagesToday: number; dailyLimit: number },
    balance: number,
  ): ChatBillingRepository => ({
    getOrInitQuota: jest.fn(async (userId) => ({
      userId,
      messagesToday: quota.messagesToday,
      dailyLimit: quota.dailyLimit,
      lastResetAt: new Date('2026-04-27T00:00:00Z'),
    })),
    getOrInitWallet: jest.fn(async (userId) => ({ userId, balance })),
    consumeOne: jest.fn(),
    adjustWallet: jest.fn(),
    listLedger: jest.fn(),
  });

  it('TC-CB-001 — quota 미사용 시 remainingFreeMessages = dailyLimit', async () => {
    const repo = makeRepo({ messagesToday: 0, dailyLimit: 5 }, 0);
    const uc = new GetChatBalanceUseCase(repo);
    const out = await uc.execute('u-1');
    expect(out.dailyLimit).toBe(5);
    expect(out.messagesToday).toBe(0);
    expect(out.remainingFreeMessages).toBe(5);
    expect(out.couponBalance).toBe(0);
  });

  it('TC-CB-002 — partial 사용 시 remainingFreeMessages 차감', async () => {
    const repo = makeRepo({ messagesToday: 3, dailyLimit: 5 }, 10);
    const uc = new GetChatBalanceUseCase(repo);
    const out = await uc.execute('u-1');
    expect(out.remainingFreeMessages).toBe(2);
    expect(out.couponBalance).toBe(10);
  });

  it('TC-CB-003 — over-consumption 시 remainingFreeMessages = 0 (음수 클램프)', async () => {
    const repo = makeRepo({ messagesToday: 99, dailyLimit: 5 }, 0);
    const uc = new GetChatBalanceUseCase(repo);
    const out = await uc.execute('u-1');
    expect(out.remainingFreeMessages).toBe(0);
  });

  it('TC-CB-004 — nextResetAt 은 현재 KST 자정의 다음 자정 (UTC+9)', async () => {
    const repo = makeRepo({ messagesToday: 0, dailyLimit: 5 }, 0);
    const uc = new GetChatBalanceUseCase(repo);
    const out = await uc.execute('u-1');
    // nextResetAt 의 KST 시간 = 00:00
    const offset = 9 * 60 * 60 * 1000;
    const kst = new Date(out.nextResetAt.getTime() + offset);
    expect(kst.getUTCHours()).toBe(0);
    expect(kst.getUTCMinutes()).toBe(0);
    expect(kst.getUTCSeconds()).toBe(0);
  });
});

describe('nextKstMidnight (helper)', () => {
  it('TC-NK-001 — KST 자정 직후 호출 시 다음 자정 (정확히 24h 후)', () => {
    // 2026-04-27 00:00:01 KST = 2026-04-26 15:00:01 UTC
    const now = new Date('2026-04-26T15:00:01Z');
    const next = nextKstMidnight(now);
    // next = 2026-04-28 00:00 KST = 2026-04-27 15:00 UTC
    expect(next.toISOString()).toBe('2026-04-27T15:00:00.000Z');
  });

  it('TC-NK-002 — KST 자정 1초 전 호출 시 같은 일자의 자정', () => {
    // 2026-04-27 23:59:59 KST = 2026-04-27 14:59:59 UTC
    const now = new Date('2026-04-27T14:59:59Z');
    const next = nextKstMidnight(now);
    // next = 2026-04-28 00:00 KST = 2026-04-27 15:00 UTC
    expect(next.toISOString()).toBe('2026-04-27T15:00:00.000Z');
  });

  it('TC-NK-003 — UTC 자정 호출 (KST 09:00) 시 같은 일자의 KST 자정', () => {
    // 2026-04-27 00:00 UTC = 2026-04-27 09:00 KST
    const now = new Date('2026-04-27T00:00:00Z');
    const next = nextKstMidnight(now);
    // next = 2026-04-28 00:00 KST = 2026-04-27 15:00 UTC
    expect(next.toISOString()).toBe('2026-04-27T15:00:00.000Z');
  });
});
