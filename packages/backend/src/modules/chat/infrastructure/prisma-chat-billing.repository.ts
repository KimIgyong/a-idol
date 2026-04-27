import { Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { CouponReason } from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  ChatBillingRepository,
  ConsumeOutcome,
  LedgerEntry,
  QuotaRecord,
  WalletRecord,
} from '../application/coupon-interfaces';
import { nextKstMidnight } from '../application/get-chat-balance.usecase';

/** KST-calendar-day test: was `last` on a different KST day than `now`? */
function isStaleByKstDay(last: Date, now: Date): boolean {
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const dayOf = (d: Date) => Math.floor((d.getTime() + kstOffsetMs) / 86_400_000);
  return dayOf(last) < dayOf(now);
}

@Injectable()
export class PrismaChatBillingRepository implements ChatBillingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOrInitQuota(userId: string): Promise<QuotaRecord> {
    const row = await this.prisma.chatQuota.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    // Lazy reset on read — keeps /me/chat-balance honest.
    if (isStaleByKstDay(row.lastResetAt, new Date())) {
      const reset = await this.prisma.chatQuota.update({
        where: { userId },
        data: { messagesToday: 0, lastResetAt: new Date() },
      });
      return this.toQuota(reset);
    }
    return this.toQuota(row);
  }

  async getOrInitWallet(userId: string): Promise<WalletRecord> {
    const row = await this.prisma.chatCouponWallet.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return { userId: row.userId, balance: row.balance };
  }

  async consumeOne(userId: string, now: Date): Promise<ConsumeOutcome> {
    return this.prisma.$transaction(async (tx) => {
      // 1) Quota — lazy reset + increment if within limit.
      const qRow =
        (await tx.chatQuota.findUnique({ where: { userId } })) ??
        (await tx.chatQuota.create({ data: { userId } }));

      let quota = qRow;
      if (isStaleByKstDay(quota.lastResetAt, now)) {
        quota = await tx.chatQuota.update({
          where: { userId },
          data: { messagesToday: 0, lastResetAt: now },
        });
      }

      if (quota.messagesToday < quota.dailyLimit) {
        quota = await tx.chatQuota.update({
          where: { userId },
          data: { messagesToday: { increment: 1 } },
        });
        const wallet =
          (await tx.chatCouponWallet.findUnique({ where: { userId } })) ??
          (await tx.chatCouponWallet.create({ data: { userId } }));
        return {
          source: 'quota' as const,
          quotaAfter: this.toQuota(quota),
          walletAfter: { userId: wallet.userId, balance: wallet.balance },
        };
      }

      // 2) Coupon fallback — decrement wallet + ledger row, atomically.
      const wallet =
        (await tx.chatCouponWallet.findUnique({ where: { userId } })) ??
        (await tx.chatCouponWallet.create({ data: { userId } }));
      if (wallet.balance <= 0) {
        throw new DomainError(
          ErrorCodes.NO_COUPON,
          'Daily free messages exhausted and no coupons remaining',
        );
      }

      const newBalance = wallet.balance - 1;
      const updatedWallet = await tx.chatCouponWallet.update({
        where: { userId },
        data: { balance: newBalance },
      });
      await tx.chatCouponLedger.create({
        data: {
          userId,
          delta: -1,
          reason: 'MESSAGE_CONSUME',
          balanceAfter: newBalance,
        },
      });

      return {
        source: 'coupon' as const,
        quotaAfter: this.toQuota(quota),
        walletAfter: { userId: updatedWallet.userId, balance: updatedWallet.balance },
      };
    });
  }

  async adjustWallet(input: {
    userId: string;
    delta: number;
    reason: CouponReason;
    memo?: string | null;
  }): Promise<{ wallet: WalletRecord; entry: LedgerEntry }> {
    return this.prisma.$transaction(async (tx) => {
      const existing =
        (await tx.chatCouponWallet.findUnique({ where: { userId: input.userId } })) ??
        (await tx.chatCouponWallet.create({ data: { userId: input.userId } }));
      const newBalance = existing.balance + input.delta;
      if (newBalance < 0) {
        throw new DomainError(
          'COUPON_INSUFFICIENT_BALANCE',
          'Adjustment would make balance negative',
        );
      }
      const updated = await tx.chatCouponWallet.update({
        where: { userId: input.userId },
        data: { balance: newBalance },
      });
      const ledgerRow = await tx.chatCouponLedger.create({
        data: {
          userId: input.userId,
          delta: input.delta,
          reason: input.reason,
          balanceAfter: newBalance,
          memo: input.memo ?? null,
        },
      });
      return {
        wallet: { userId: updated.userId, balance: updated.balance },
        entry: {
          delta: ledgerRow.delta,
          reason: ledgerRow.reason as CouponReason,
          balanceAfter: ledgerRow.balanceAfter,
          memo: ledgerRow.memo,
          createdAt: ledgerRow.createdAt,
        },
      };
    });
  }

  async listLedger(userId: string, take: number): Promise<LedgerEntry[]> {
    const rows = await this.prisma.chatCouponLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return rows.map((r) => ({
      delta: r.delta,
      reason: r.reason as CouponReason,
      balanceAfter: r.balanceAfter,
      memo: r.memo,
      createdAt: r.createdAt,
    }));
  }

  private toQuota(row: {
    userId: string;
    messagesToday: number;
    dailyLimit: number;
    lastResetAt: Date;
  }): QuotaRecord {
    return {
      userId: row.userId,
      messagesToday: row.messagesToday,
      dailyLimit: row.dailyLimit,
      lastResetAt: row.lastResetAt,
    };
  }
}

// Tests reach this helper via a dedicated import path.
export { nextKstMidnight };
