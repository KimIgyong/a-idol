import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { AuditionStatus } from '@a-idol/shared';

/**
 * Status machine: DRAFT → ACTIVE → FINISHED. CANCELED reachable from DRAFT.
 * No back-edges — once FINISHED, the audition is frozen.
 */
export const AUDITION_TRANSITIONS: Record<AuditionStatus, AuditionStatus[]> = {
  DRAFT: ['ACTIVE', 'CANCELED'],
  ACTIVE: ['FINISHED', 'CANCELED'],
  FINISHED: [],
  CANCELED: [],
};

export function assertAuditionTransition(
  from: AuditionStatus,
  to: AuditionStatus,
): void {
  const allowed = AUDITION_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new DomainError(
      ErrorCodes.AUDITION_INVALID_TRANSITION,
      `Cannot transition audition from ${from} to ${to}`,
      { from, to, allowed },
    );
  }
}

export function assertAuditionDateRange(startAt: Date, endAt: Date): void {
  if (endAt.getTime() <= startAt.getTime()) {
    throw new DomainError(
      ErrorCodes.AUDITION_INVALID_DATE_RANGE,
      'endAt must be after startAt',
    );
  }
}
