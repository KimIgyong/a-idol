import { Inject, Injectable, Logger } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  RoundRepository,
} from '../../audition/application/interfaces';
import { ROUND_REPOSITORY } from '../../audition/application/interfaces';
import type { VoteRuleRepository } from '../../audition/application/vote-rule-interfaces';
import { VOTE_RULE_REPOSITORY } from '../../audition/application/vote-rule-interfaces';
import type {
  VoteAuditRepository,
  VoteCounterRepository,
} from './interfaces';
import { VOTE_AUDIT_REPOSITORY, VOTE_COUNTER_REPOSITORY } from './interfaces';

export interface CastHeartResult {
  roundId: string;
  idolId: string;
  weightApplied: number;
  dailyUsed: number;
  dailyLimit: number;
  scoreAfter: number;
}

@Injectable()
export class CastHeartVoteUseCase {
  private readonly log = new Logger(CastHeartVoteUseCase.name);

  constructor(
    @Inject(ROUND_REPOSITORY) private readonly rounds: RoundRepository,
    @Inject(VOTE_RULE_REPOSITORY) private readonly rules: VoteRuleRepository,
    @Inject(VOTE_COUNTER_REPOSITORY) private readonly counters: VoteCounterRepository,
    @Inject(VOTE_AUDIT_REPOSITORY) private readonly audit: VoteAuditRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: {
    userId: string;
    roundId: string;
    idolId: string;
  }): Promise<CastHeartResult> {
    // 1) Round must exist + be ACTIVE.
    const round = await this.rounds.findById(input.roundId);
    if (!round) throw new DomainError(ErrorCodes.ROUND_NOT_FOUND, 'Round not found');
    if (round.status !== 'ACTIVE') {
      throw new DomainError(
        ErrorCodes.VOTE_ROUND_NOT_ACTIVE,
        'Round is not accepting votes',
      );
    }

    // 2) Idol must be an active entry in the parent audition.
    const entry = await this.prisma.auditionEntry.findFirst({
      where: { auditionId: round.auditionId, idolId: input.idolId },
      select: { eliminatedAtRoundId: true },
    });
    if (!entry) {
      throw new DomainError(
        ErrorCodes.IDOL_NOT_IN_AUDITION,
        'This idol is not participating in this audition',
      );
    }
    if (entry.eliminatedAtRoundId) {
      throw new DomainError(
        ErrorCodes.IDOL_ELIMINATED,
        'This idol has been eliminated in a previous round',
      );
    }

    // 3) Load rule + verify HEART is enabled.
    const rule = await this.rules.findByRound(round.id);
    if (!rule) {
      throw new DomainError(ErrorCodes.VOTE_RULE_NOT_FOUND, 'Vote rule not set for this round');
    }
    if (rule.heartWeight <= 0) {
      throw new DomainError(
        ErrorCodes.VOTE_METHOD_NOT_ALLOWED,
        'HEART voting is disabled for this round',
      );
    }

    // 4) Enforce daily limit via Redis INCR → rollback if it pushed us over.
    const dailyUsed = await this.counters.incrDaily({
      userId: input.userId,
      roundId: round.id,
      method: 'HEART',
    });
    if (dailyUsed > rule.dailyHeartLimit) {
      await this.counters.decrDaily({
        userId: input.userId,
        roundId: round.id,
        method: 'HEART',
      });
      throw new DomainError(
        ErrorCodes.VOTE_DAILY_LIMIT_EXCEEDED,
        `Daily heart-vote limit (${rule.dailyHeartLimit}) reached`,
        { dailyUsed: dailyUsed - 1, dailyLimit: rule.dailyHeartLimit },
      );
    }

    // 5) Apply weighted score to the leaderboard.
    const scoreAfter = await this.counters.incrIdolScore({
      roundId: round.id,
      idolId: input.idolId,
      weight: rule.heartWeight,
    });

    // 6) Best-effort DB audit. Redis remains source of truth for the live
    //    leaderboard; if the insert fails we'd still have the Redis vote
    //    counted — accept the slight drift for now (monitoring alert in T-080).
    try {
      await this.audit.append({
        roundId: round.id,
        idolId: input.idolId,
        userId: input.userId,
        method: 'HEART',
        weight: rule.heartWeight,
      });
    } catch (err) {
      this.log.warn(`vote audit insert failed: ${(err as Error).message}`);
    }

    return {
      roundId: round.id,
      idolId: input.idolId,
      weightApplied: rule.heartWeight,
      dailyUsed,
      dailyLimit: rule.dailyHeartLimit,
      scoreAfter,
    };
  }
}
