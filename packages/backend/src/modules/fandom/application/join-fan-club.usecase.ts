import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { FanClubRecord, FanClubRepository, MembershipRecord } from './interfaces';
import { FAN_CLUB_REPOSITORY } from './interfaces';

@Injectable()
export class JoinFanClubUseCase {
  constructor(@Inject(FAN_CLUB_REPOSITORY) private readonly repo: FanClubRepository) {}

  async execute(input: { userId: string; idolId: string }): Promise<{
    fanClub: FanClubRecord;
    membership: MembershipRecord;
  }> {
    const fanClub = await this.repo.findByIdol(input.idolId);
    if (!fanClub) throw new DomainError(ErrorCodes.FAN_CLUB_NOT_FOUND, 'Fan club not found for this idol');

    // Paid fan clubs flow through the Commerce context (not implemented in MVP).
    if (fanClub.price > 0) {
      throw new DomainError(
        ErrorCodes.PAID_FAN_CLUB_NOT_SUPPORTED,
        'Paid fan clubs require Commerce (T-044). Not enabled in MVP.',
      );
    }

    const membership = await this.repo.join(input.userId, fanClub.id);
    // Refresh memberCount after the join tx.
    const refreshed = await this.repo.findByIdol(input.idolId);
    return { fanClub: refreshed ?? fanClub, membership };
  }
}
