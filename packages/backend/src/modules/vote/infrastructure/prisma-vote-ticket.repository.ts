import { Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  RoundVoteTicketBalanceRecord,
  TicketBucket,
  VoteTicketBalanceRecord,
  VoteTicketLedgerEntry,
  VoteTicketReason,
  VoteTicketRepository,
} from '../application/ticket-interfaces';

@Injectable()
export class PrismaVoteTicketRepository implements VoteTicketRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOrInitBalance(userId: string): Promise<VoteTicketBalanceRecord> {
    const row = await this.prisma.voteTicketBalance.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return { userId: row.userId, balance: row.balance, updatedAt: row.updatedAt };
  }

  async listRoundBalances(userId: string): Promise<RoundVoteTicketBalanceRecord[]> {
    const rows = await this.prisma.roundVoteTicketBalance.findMany({
      where: { userId, balance: { gt: 0 } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => ({
      userId: r.userId,
      roundId: r.roundId,
      balance: r.balance,
      updatedAt: r.updatedAt,
    }));
  }

  async grant(input: {
    userId: string;
    amount: number;
    reason: VoteTicketReason;
    memo?: string | null;
  }): Promise<{ balance: VoteTicketBalanceRecord; entry: VoteTicketLedgerEntry }> {
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new DomainError(
        ErrorCodes.INVALID_DELIVERY_PAYLOAD,
        'grant amount must be a positive integer',
      );
    }
    return this.adjustGlobal(
      input.userId,
      input.amount,
      input.reason,
      input.memo ?? null,
    );
  }

  async grantRound(input: {
    userId: string;
    roundId: string;
    amount: number;
    reason: VoteTicketReason;
    memo?: string | null;
  }): Promise<{
    balance: RoundVoteTicketBalanceRecord;
    entry: VoteTicketLedgerEntry;
  }> {
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new DomainError(
        ErrorCodes.INVALID_DELIVERY_PAYLOAD,
        'grant amount must be a positive integer',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const existing =
        (await tx.roundVoteTicketBalance.findUnique({
          where: { userId_roundId: { userId: input.userId, roundId: input.roundId } },
        })) ??
        (await tx.roundVoteTicketBalance.create({
          data: { userId: input.userId, roundId: input.roundId },
        }));
      const newBalance = existing.balance + input.amount;
      const updated = await tx.roundVoteTicketBalance.update({
        where: { userId_roundId: { userId: input.userId, roundId: input.roundId } },
        data: { balance: newBalance },
      });
      const ledger = await tx.roundVoteTicketLedger.create({
        data: {
          userId: input.userId,
          roundId: input.roundId,
          delta: input.amount,
          reason: input.reason,
          balanceAfter: newBalance,
          memo: input.memo ?? null,
        },
      });
      return {
        balance: {
          userId: updated.userId,
          roundId: updated.roundId,
          balance: updated.balance,
          updatedAt: updated.updatedAt,
        },
        entry: this.toLedgerEntry(ledger),
      };
    });
  }

  async consumeOne(
    userId: string,
    roundId: string,
    memo?: string | null,
  ): Promise<{
    source: TicketBucket;
    global: VoteTicketBalanceRecord;
    round: RoundVoteTicketBalanceRecord | null;
    entry: VoteTicketLedgerEntry;
  }> {
    return this.prisma.$transaction(async (tx) => {
      // Prefer the round-scoped bucket — these tickets are literally
      // scope-limited and would otherwise expire unused when the round closes.
      const roundRow = await tx.roundVoteTicketBalance.findUnique({
        where: { userId_roundId: { userId, roundId } },
      });
      if (roundRow && roundRow.balance > 0) {
        const newBalance = roundRow.balance - 1;
        const updated = await tx.roundVoteTicketBalance.update({
          where: { userId_roundId: { userId, roundId } },
          data: { balance: newBalance },
        });
        const ledger = await tx.roundVoteTicketLedger.create({
          data: {
            userId,
            roundId,
            delta: -1,
            reason: 'VOTE_CAST',
            balanceAfter: newBalance,
            memo: memo ?? null,
          },
        });
        // Global balance untouched — fetch current for the return payload.
        const globalRow =
          (await tx.voteTicketBalance.findUnique({ where: { userId } })) ??
          (await tx.voteTicketBalance.create({ data: { userId } }));
        return {
          source: 'ROUND' as const,
          global: {
            userId: globalRow.userId,
            balance: globalRow.balance,
            updatedAt: globalRow.updatedAt,
          },
          round: {
            userId: updated.userId,
            roundId: updated.roundId,
            balance: updated.balance,
            updatedAt: updated.updatedAt,
          },
          entry: this.toLedgerEntry(ledger),
        };
      }

      // Fall back to the global bucket.
      const globalRow =
        (await tx.voteTicketBalance.findUnique({ where: { userId } })) ??
        (await tx.voteTicketBalance.create({ data: { userId } }));
      if (globalRow.balance <= 0) {
        throw new DomainError(
          ErrorCodes.NOT_ENOUGH_TICKETS,
          'No vote tickets remaining — purchase a ticket pack first',
        );
      }
      const newBalance = globalRow.balance - 1;
      const updated = await tx.voteTicketBalance.update({
        where: { userId },
        data: { balance: newBalance },
      });
      const ledger = await tx.voteTicketLedger.create({
        data: {
          userId,
          delta: -1,
          reason: 'VOTE_CAST',
          balanceAfter: newBalance,
          memo: memo ?? null,
        },
      });
      return {
        source: 'GLOBAL' as const,
        global: {
          userId: updated.userId,
          balance: updated.balance,
          updatedAt: updated.updatedAt,
        },
        round: roundRow
          ? {
              userId: roundRow.userId,
              roundId: roundRow.roundId,
              balance: roundRow.balance,
              updatedAt: roundRow.updatedAt,
            }
          : null,
        entry: this.toLedgerEntry(ledger),
      };
    });
  }

  async refundOne(
    userId: string,
    roundId: string,
    source: TicketBucket,
    memo?: string | null,
  ): Promise<void> {
    if (source === 'ROUND') {
      await this.grantRound({
        userId,
        roundId,
        amount: 1,
        reason: 'REFUND',
        memo: memo ?? null,
      });
      return;
    }
    await this.adjustGlobal(userId, 1, 'REFUND', memo ?? null);
  }

  private async adjustGlobal(
    userId: string,
    delta: number,
    reason: VoteTicketReason,
    memo: string | null,
  ): Promise<{ balance: VoteTicketBalanceRecord; entry: VoteTicketLedgerEntry }> {
    return this.prisma.$transaction(async (tx) => {
      const existing =
        (await tx.voteTicketBalance.findUnique({ where: { userId } })) ??
        (await tx.voteTicketBalance.create({ data: { userId } }));
      const newBalance = existing.balance + delta;
      if (newBalance < 0) {
        throw new DomainError(
          ErrorCodes.NOT_ENOUGH_TICKETS,
          'Adjustment would make ticket balance negative',
        );
      }
      const updated = await tx.voteTicketBalance.update({
        where: { userId },
        data: { balance: newBalance },
      });
      const ledger = await tx.voteTicketLedger.create({
        data: {
          userId,
          delta,
          reason,
          balanceAfter: newBalance,
          memo,
        },
      });
      return {
        balance: {
          userId: updated.userId,
          balance: updated.balance,
          updatedAt: updated.updatedAt,
        },
        entry: this.toLedgerEntry(ledger),
      };
    });
  }

  private toLedgerEntry(row: {
    delta: number;
    reason: string;
    balanceAfter: number;
    memo: string | null;
    createdAt: Date;
  }): VoteTicketLedgerEntry {
    return {
      delta: row.delta,
      reason: row.reason as VoteTicketReason,
      balanceAfter: row.balanceAfter,
      memo: row.memo,
      createdAt: row.createdAt,
    };
  }
}
