import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { RoundStatus } from '@a-idol/shared';

export const ROUND_TRANSITIONS: Record<RoundStatus, RoundStatus[]> = {
  SCHEDULED: ['ACTIVE'],
  ACTIVE: ['CLOSED'],
  CLOSED: [],
};

export function assertRoundTransition(from: RoundStatus, to: RoundStatus): void {
  const allowed = ROUND_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new DomainError(
      ErrorCodes.ROUND_INVALID_TRANSITION,
      `Cannot transition round from ${from} to ${to}`,
      { from, to, allowed },
    );
  }
}
