import { Inject, Injectable, Logger } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { RoundRepository } from '../../audition/application/interfaces';
import { ROUND_REPOSITORY } from '../../audition/application/interfaces';
import type { VoteRuleRepository } from '../../audition/application/vote-rule-interfaces';
import { VOTE_RULE_REPOSITORY } from '../../audition/application/vote-rule-interfaces';
import type {
  VoteAuditRepository,
  VoteCounterRepository,
} from './interfaces';
import { VOTE_AUDIT_REPOSITORY, VOTE_COUNTER_REPOSITORY } from './interfaces';
import type { VoteTicketRepository } from './ticket-interfaces';
import { VOTE_TICKET_REPOSITORY } from './ticket-interfaces';

export interface CastTicketResult {
  roundId: string;
  idolId: string;
  weightApplied: number;
  /**
   * Total remaining tickets after the spend — global + round-scoped for
   * this round. Matches what the "tickets left" badge on the vote UI shows.
   */
  ticketBalanceAfter: number;
  scoreAfter: number;
  /** Which bucket we drained. Surfaces for logging + audit. */
  source: 'ROUND' | 'GLOBAL';
}

/**
 * TICKET-method vote. Unlike HEART there is no daily limit — one ticket is
 * consumed from the user's global balance per vote. Fails cleanly with
 * NOT_ENOUGH_TICKETS when the balance is 0; the commerce flow grants tickets.
 */
@Injectable()
export class CastTicketVoteUseCase {
  private readonly log = new Logger(CastTicketVoteUseCase.name);

  constructor(
    @Inject(ROUND_REPOSITORY) private readonly rounds: RoundRepository,
    @Inject(VOTE_RULE_REPOSITORY) private readonly rules: VoteRuleRepository,
    @Inject(VOTE_COUNTER_REPOSITORY) private readonly counters: VoteCounterRepository,
    @Inject(VOTE_AUDIT_REPOSITORY) private readonly audit: VoteAuditRepository,
    @Inject(VOTE_TICKET_REPOSITORY) private readonly tickets: VoteTicketRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: {
    userId: string;
    roundId: string;
    idolId: string;
  }): Promise<CastTicketResult> {
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

    // 3) Load rule + verify TICKET is enabled.
    const rule = await this.rules.findByRound(round.id);
    if (!rule) {
      throw new DomainError(ErrorCodes.VOTE_RULE_NOT_FOUND, 'Vote rule not set for this round');
    }
    if (rule.ticketWeight <= 0) {
      throw new DomainError(
        ErrorCodes.VOTE_METHOD_NOT_ALLOWED,
        'TICKET voting is disabled for this round',
      );
    }

    // 4) Consume one ticket atomically — tries the round-scoped bucket first
    //    (T-062b), falls back to the global bucket, throws NOT_ENOUGH_TICKETS
    //    only when both are at 0.
    const consumed = await this.tickets.consumeOne(
      input.userId,
      round.id,
      `round:${round.id}:idol:${input.idolId}`,
    );

    // 5) Apply weighted score to the leaderboard. If this fails after the
    //    ticket was consumed, refund the ticket to whichever bucket we drained.
    let scoreAfter: number;
    try {
      scoreAfter = await this.counters.incrIdolScore({
        roundId: round.id,
        idolId: input.idolId,
        weight: rule.ticketWeight,
      });
    } catch (err) {
      this.log.warn(
        `leaderboard ZINCRBY failed after ticket consume (source=${consumed.source}), refunding: ${(err as Error).message}`,
      );
      await this.tickets.refundOne(
        input.userId,
        round.id,
        consumed.source,
        `refund:${round.id}:idol:${input.idolId}`,
      );
      throw err;
    }

    // 6) Best-effort DB audit (Redis remains source of truth for the live
    //    leaderboard; the ticket ledger itself already captured the spend).
    try {
      await this.audit.append({
        roundId: round.id,
        idolId: input.idolId,
        userId: input.userId,
        method: 'TICKET',
        weight: rule.ticketWeight,
      });
    } catch (err) {
      this.log.warn(`vote audit insert failed: ${(err as Error).message}`);
    }

    const ticketBalanceAfter =
      consumed.global.balance + (consumed.round?.balance ?? 0);

    return {
      roundId: round.id,
      idolId: input.idolId,
      weightApplied: rule.ticketWeight,
      ticketBalanceAfter,
      scoreAfter,
      source: consumed.source,
    };
  }
}
