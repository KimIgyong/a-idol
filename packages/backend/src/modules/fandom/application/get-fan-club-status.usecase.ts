import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { FanClubRecord, FanClubRepository, MembershipRecord } from './interfaces';
import { FAN_CLUB_REPOSITORY } from './interfaces';

@Injectable()
export class GetFanClubStatusUseCase {
  constructor(@Inject(FAN_CLUB_REPOSITORY) private readonly repo: FanClubRepository) {}

  async execute(input: { userId: string; idolId: string }): Promise<{
    fanClub: FanClubRecord;
    membership: MembershipRecord | null;
  }> {
    const fanClub = await this.repo.findByIdol(input.idolId);
    if (!fanClub) throw new DomainError(ErrorCodes.FAN_CLUB_NOT_FOUND, 'Fan club not found for this idol');
    const membership = await this.repo.findMembership(input.userId, input.idolId);
    return { fanClub, membership };
  }
}
