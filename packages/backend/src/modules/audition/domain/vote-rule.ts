import { DomainError, ErrorCodes } from '@a-idol/shared';

export interface VoteRuleValues {
  heartWeight: number;
  smsWeight: number;
  ticketWeight: number;
  dailyHeartLimit: number;
}

/**
 * Weights are absolute multipliers. The final per-idol score is:
 *   heart_votes * heartWeight + sms_votes * smsWeight + ticket_votes * ticketWeight
 *
 * Rules:
 *   - every weight must be ≥ 0
 *   - at least one weight must be > 0 (otherwise the round is unvotable)
 *   - dailyHeartLimit must be ≥ 1
 */
export function assertValidWeights(v: VoteRuleValues): void {
  if (v.heartWeight < 0 || v.smsWeight < 0 || v.ticketWeight < 0) {
    throw new DomainError(
      ErrorCodes.VOTE_RULE_INVALID_WEIGHTS,
      'Weights must be non-negative',
    );
  }
  if (v.heartWeight === 0 && v.smsWeight === 0 && v.ticketWeight === 0) {
    throw new DomainError(
      ErrorCodes.VOTE_RULE_INVALID_WEIGHTS,
      'At least one vote method must have weight > 0',
    );
  }
  if (!Number.isInteger(v.dailyHeartLimit) || v.dailyHeartLimit < 1) {
    throw new DomainError(
      ErrorCodes.VOTE_RULE_INVALID_WEIGHTS,
      'dailyHeartLimit must be an integer ≥ 1',
    );
  }
}
