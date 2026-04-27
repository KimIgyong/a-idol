import type { CouponReason } from '@a-idol/shared';

export interface QuotaRecord {
  userId: string;
  messagesToday: number;
  dailyLimit: number;
  lastResetAt: Date;
}

export interface WalletRecord {
  userId: string;
  balance: number;
}

export interface LedgerEntry {
  delta: number;
  reason: CouponReason;
  balanceAfter: number;
  memo: string | null;
  createdAt: Date;
}

export interface ConsumeOutcome {
  source: 'quota' | 'coupon';
  quotaAfter: QuotaRecord;
  walletAfter: WalletRecord;
}

/**
 * Atomic view over (ChatQuota, ChatCouponWallet, ChatCouponLedger).
 * All mutations must run inside a single Prisma `$transaction` — the
 * adapter owns that transaction so use cases stay storage-agnostic.
 */
export interface ChatBillingRepository {
  getOrInitQuota(userId: string): Promise<QuotaRecord>;
  getOrInitWallet(userId: string): Promise<WalletRecord>;
  /**
   * Atomically: lazy-reset quota (if stale) → try free quota → else try
   * coupon → else throw. Returns which source was charged and the post-state.
   */
  consumeOne(userId: string, now: Date): Promise<ConsumeOutcome>;
  /**
   * Grant or deduct (`delta` can be negative for refunds). Writes a ledger row.
   */
  adjustWallet(input: {
    userId: string;
    delta: number;
    reason: CouponReason;
    memo?: string | null;
  }): Promise<{ wallet: WalletRecord; entry: LedgerEntry }>;
  listLedger(userId: string, take: number): Promise<LedgerEntry[]>;
}

export const CHAT_BILLING_REPOSITORY = 'ChatBillingRepository';
