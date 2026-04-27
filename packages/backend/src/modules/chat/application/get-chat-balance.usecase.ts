import { Inject, Injectable } from '@nestjs/common';
import type { ChatBillingRepository } from './coupon-interfaces';
import { CHAT_BILLING_REPOSITORY } from './coupon-interfaces';

export interface ChatBalanceView {
  dailyLimit: number;
  messagesToday: number;
  remainingFreeMessages: number;
  couponBalance: number;
  /** Next midnight KST (Asia/Seoul is UTC+9, no DST). */
  nextResetAt: Date;
}

@Injectable()
export class GetChatBalanceUseCase {
  constructor(
    @Inject(CHAT_BILLING_REPOSITORY) private readonly repo: ChatBillingRepository,
  ) {}

  async execute(userId: string): Promise<ChatBalanceView> {
    const [quota, wallet] = await Promise.all([
      this.repo.getOrInitQuota(userId),
      this.repo.getOrInitWallet(userId),
    ]);
    const nowUtc = new Date();
    return {
      dailyLimit: quota.dailyLimit,
      messagesToday: quota.messagesToday,
      remainingFreeMessages: Math.max(0, quota.dailyLimit - quota.messagesToday),
      couponBalance: wallet.balance,
      nextResetAt: nextKstMidnight(nowUtc),
    };
  }
}

/** Returns the next 00:00 KST strictly after `now`. KST = UTC+9, no DST. */
export function nextKstMidnight(now: Date): Date {
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const kstNow = now.getTime() + kstOffsetMs;
  const day = Math.floor(kstNow / 86_400_000);
  return new Date((day + 1) * 86_400_000 - kstOffsetMs);
}
