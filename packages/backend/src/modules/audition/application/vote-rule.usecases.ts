import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import { assertValidWeights } from '../domain/vote-rule';
import type { RoundRepository } from './interfaces';
import { ROUND_REPOSITORY } from './interfaces';
import type { VoteRuleRecord, VoteRuleRepository } from './vote-rule-interfaces';
import { VOTE_RULE_REPOSITORY } from './vote-rule-interfaces';

@Injectable()
export class UpsertVoteRuleUseCase {
  constructor(
    @Inject(VOTE_RULE_REPOSITORY) private readonly repo: VoteRuleRepository,
    @Inject(ROUND_REPOSITORY) private readonly rounds: RoundRepository,
  ) {}

  async execute(
    roundId: string,
    input: {
      heartWeight: number;
      smsWeight: number;
      ticketWeight: number;
      dailyHeartLimit?: number;
    },
  ): Promise<VoteRuleRecord> {
    const round = await this.rounds.findById(roundId);
    if (!round) throw new DomainError(ErrorCodes.ROUND_NOT_FOUND, 'Round not found');
    // Only SCHEDULED rounds may have their rules changed — once the round is
    // ACTIVE, vote counting depends on stable weights.
    if (round.status !== 'SCHEDULED') {
      throw new DomainError(
        ErrorCodes.ROUND_INVALID_TRANSITION,
        'Vote rule can only be set on a SCHEDULED round',
      );
    }

    const values = {
      heartWeight: input.heartWeight,
      smsWeight: input.smsWeight,
      ticketWeight: input.ticketWeight,
      dailyHeartLimit: input.dailyHeartLimit ?? 1,
    };
    assertValidWeights(values);

    return this.repo.upsert({ roundId, ...values });
  }
}

@Injectable()
export class GetVoteRuleUseCase {
  constructor(
    @Inject(VOTE_RULE_REPOSITORY) private readonly repo: VoteRuleRepository,
    @Inject(ROUND_REPOSITORY) private readonly rounds: RoundRepository,
  ) {}

  async execute(roundId: string): Promise<VoteRuleRecord> {
    // Confirm the round exists so 404 is rounds-based, not vote-rule.
    const round = await this.rounds.findById(roundId);
    if (!round) throw new DomainError(ErrorCodes.ROUND_NOT_FOUND, 'Round not found');
    const rule = await this.repo.findByRound(roundId);
    if (!rule) throw new DomainError(ErrorCodes.VOTE_RULE_NOT_FOUND, 'Vote rule not set for this round');
    return rule;
  }
}

@Injectable()
export class DeleteVoteRuleUseCase {
  constructor(
    @Inject(VOTE_RULE_REPOSITORY) private readonly repo: VoteRuleRepository,
    @Inject(ROUND_REPOSITORY) private readonly rounds: RoundRepository,
  ) {}

  async execute(roundId: string): Promise<void> {
    const round = await this.rounds.findById(roundId);
    if (!round) throw new DomainError(ErrorCodes.ROUND_NOT_FOUND, 'Round not found');
    if (round.status !== 'SCHEDULED') {
      throw new DomainError(
        ErrorCodes.ROUND_INVALID_TRANSITION,
        'Cannot delete vote rule once the round has started',
      );
    }
    await this.repo.delete(roundId);
  }
}
