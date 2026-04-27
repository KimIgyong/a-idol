import type {
  FanClubDto,
  FanClubStatusDto,
  MembershipDto,
} from '@a-idol/shared';
import type { FanClubRecord, MembershipRecord } from '../../application/interfaces';

export function toFanClubDto(fc: FanClubRecord): FanClubDto {
  return {
    id: fc.id,
    idolId: fc.idolId,
    tier: fc.tier,
    price: fc.price,
    memberCount: fc.memberCount,
    createdAt: fc.createdAt.toISOString(),
  };
}

export function toMembershipDto(m: MembershipRecord): MembershipDto {
  return {
    id: m.id,
    fanClubId: m.fanClubId,
    idolId: m.idolId,
    tier: m.tier,
    joinedAt: m.joinedAt.toISOString(),
    leftAt: m.leftAt ? m.leftAt.toISOString() : null,
  };
}

export function toFanClubStatusDto(
  fc: FanClubRecord,
  membership: MembershipRecord | null,
): FanClubStatusDto {
  const isMember = !!membership && membership.leftAt === null;
  return {
    fanClub: toFanClubDto(fc),
    isMember,
    joinedAt: isMember && membership ? membership.joinedAt.toISOString() : null,
  };
}
