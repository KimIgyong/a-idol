import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { RoundRepository } from '../../audition/application/interfaces';
import { ROUND_REPOSITORY } from '../../audition/application/interfaces';
import type { VoteRuleRepository } from '../../audition/application/vote-rule-interfaces';
import { VOTE_RULE_REPOSITORY } from '../../audition/application/vote-rule-interfaces';
import type { VoteCounterRepository } from './interfaces';
import { VOTE_COUNTER_REPOSITORY } from './interfaces';
import { nextKstMidnight } from '../../chat/application/get-chat-balance.usecase';

export interface MyVoteStatusView {
  roundId: string;
  dailyUsed: number;
  dailyLimit: number;
  resetAt: Date;
}

@Injectable()
export class GetMyVoteStatusUseCase {
  constructor(
    @Inject(ROUND_REPOSITORY) private readonly rounds: RoundRepository,
    @Inject(VOTE_RULE_REPOSITORY) private readonly rules: VoteRuleRepository,
    @Inject(VOTE_COUNTER_REPOSITORY) private readonly counters: VoteCounterRepository,
  ) {}

  async execute(input: { userId: string; roundId: string }): Promise<MyVoteStatusView> {
    const round = await this.rounds.findById(input.roundId);
    if (!round) throw new DomainError(ErrorCodes.ROUND_NOT_FOUND, 'Round not found');

    const rule = await this.rules.findByRound(round.id);
    const dailyLimit = rule?.dailyHeartLimit ?? 0;
    const dailyUsed = await this.counters.readDaily({
      userId: input.userId,
      roundId: round.id,
      method: 'HEART',
    });
    return {
      roundId: round.id,
      dailyUsed,
      dailyLimit,
      resetAt: nextKstMidnight(new Date()),
    };
  }
}
