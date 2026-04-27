import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  VoteRuleRecord,
  VoteRuleRepository,
} from '../application/vote-rule-interfaces';

type Row = {
  roundId: string;
  heartWeight: Prisma.Decimal;
  smsWeight: Prisma.Decimal;
  ticketWeight: Prisma.Decimal;
  dailyHeartLimit: number;
  updatedAt: Date;
};

@Injectable()
export class PrismaVoteRuleRepository implements VoteRuleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByRound(roundId: string): Promise<VoteRuleRecord | null> {
    const row = await this.prisma.voteRule.findUnique({ where: { roundId } });
    return row ? this.toRecord(row) : null;
  }

  async upsert(input: {
    roundId: string;
    heartWeight: number;
    smsWeight: number;
    ticketWeight: number;
    dailyHeartLimit: number;
  }): Promise<VoteRuleRecord> {
    const row = await this.prisma.voteRule.upsert({
      where: { roundId: input.roundId },
      update: {
        heartWeight: input.heartWeight,
        smsWeight: input.smsWeight,
        ticketWeight: input.ticketWeight,
        dailyHeartLimit: input.dailyHeartLimit,
      },
      create: {
        roundId: input.roundId,
        heartWeight: input.heartWeight,
        smsWeight: input.smsWeight,
        ticketWeight: input.ticketWeight,
        dailyHeartLimit: input.dailyHeartLimit,
      },
    });
    return this.toRecord(row);
  }

  async delete(roundId: string): Promise<void> {
    // No-throw if absent: deleteMany is idempotent.
    await this.prisma.voteRule.deleteMany({ where: { roundId } });
  }

  private toRecord(row: Row): VoteRuleRecord {
    return {
      roundId: row.roundId,
      heartWeight: row.heartWeight.toNumber(),
      smsWeight: row.smsWeight.toNumber(),
      ticketWeight: row.ticketWeight.toNumber(),
      dailyHeartLimit: row.dailyHeartLimit,
      updatedAt: row.updatedAt,
    };
  }
}
