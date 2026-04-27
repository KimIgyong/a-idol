export type VoteTicketReason = 'PURCHASE' | 'VOTE_CAST' | 'ADMIN_GRANT' | 'REFUND';

export interface VoteTicketBalanceRecord {
  userId: string;
  balance: number;
  updatedAt: Date;
}

export interface RoundVoteTicketBalanceRecord {
  userId: string;
  roundId: string;
  balance: number;
  updatedAt: Date;
}

export interface VoteTicketLedgerEntry {
  delta: number;
  reason: VoteTicketReason;
  balanceAfter: number;
  memo: string | null;
  createdAt: Date;
}

/**
 * Source the consume flow drained from. Surfaces back to the usecase so
 * audit logs + the vote result can say "round-scoped" or "global".
 */
export type TicketBucket = 'ROUND' | 'GLOBAL';

/**
 * Atomic view over the two-tier ticket wallet:
 *   - global balance (VoteTicketBalance): any round can consume
 *   - round-scoped balance (RoundVoteTicketBalance): only the matching round
 * Round-scoped balance is tried first on cast; see CastTicketVoteUseCase
 * for the preference order. T-062b.
 */
export interface VoteTicketRepository {
  getOrInitBalance(userId: string): Promise<VoteTicketBalanceRecord>;
  listRoundBalances(userId: string): Promise<RoundVoteTicketBalanceRecord[]>;

  /** Grant N to the global bucket. */
  grant(input: {
    userId: string;
    amount: number;
    reason: VoteTicketReason;
    memo?: string | null;
  }): Promise<{ balance: VoteTicketBalanceRecord; entry: VoteTicketLedgerEntry }>;

  /** Grant N to a round-scoped bucket (tickets only valid for that round). */
  grantRound(input: {
    userId: string;
    roundId: string;
    amount: number;
    reason: VoteTicketReason;
    memo?: string | null;
  }): Promise<{
    balance: RoundVoteTicketBalanceRecord;
    entry: VoteTicketLedgerEntry;
  }>;

  /**
   * Cast-flow consume: try the round-scoped bucket for `roundId` first; if
   * that bucket is empty, fall back to the global bucket. Throws
   * `NOT_ENOUGH_TICKETS` only when both are at 0.
   * Writes a VOTE_CAST ledger row in the bucket it drained from.
   * Returns which bucket drained + the remaining balances (both).
   */
  consumeOne(
    userId: string,
    roundId: string,
    memo?: string | null,
  ): Promise<{
    source: TicketBucket;
    global: VoteTicketBalanceRecord;
    round: RoundVoteTicketBalanceRecord | null;
    entry: VoteTicketLedgerEntry;
  }>;

  /**
   * Refund one ticket to the bucket it came from (used when leaderboard
   * ZINCRBY fails after consume). Caller passes the `source` from consume.
   */
  refundOne(
    userId: string,
    roundId: string,
    source: TicketBucket,
    memo?: string | null,
  ): Promise<void>;
}

export const VOTE_TICKET_REPOSITORY = 'VoteTicketRepository';
