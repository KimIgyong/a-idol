import { ErrorCodes } from '@a-idol/shared';
import { JoinFanClubUseCase } from './join-fan-club.usecase';
import type { FanClubRecord, FanClubRepository, MembershipRecord } from './interfaces';

const baseClub: FanClubRecord = {
  id: 'fc-1',
  idolId: 'idol-1',
  tier: 'official',
  price: 0,
  memberCount: 0,
  createdAt: new Date('2026-04-01T00:00:00Z'),
};

const makeRepo = (club: FanClubRecord | null): FanClubRepository => {
  const state = { club, membership: null as MembershipRecord | null };
  return {
    findByIdol: jest.fn(async () => state.club),
    findMembership: jest.fn(async () => state.membership),
    join: jest.fn(async (userId: string, fanClubId: string) => {
      state.membership = {
        id: 'm-1',
        fanClubId,
        idolId: state.club?.idolId ?? 'idol-1',
        userId,
        tier: state.club?.tier ?? 'official',
        joinedAt: new Date(),
        leftAt: null,
      };
      if (state.club) state.club.memberCount += 1;
      return state.membership;
    }),
    leave: jest.fn(async () => null),
    listMyMemberships: jest.fn(async () => ({ items: [], total: 0 })),
  };
};

describe('JoinFanClubUseCase', () => {
  it('TC-FC001 — fresh join creates membership and increments memberCount', async () => {
    const repo = makeRepo({ ...baseClub });
    const uc = new JoinFanClubUseCase(repo);
    const res = await uc.execute({ userId: 'u1', idolId: 'idol-1' });
    expect(res.membership.userId).toBe('u1');
    expect(res.membership.leftAt).toBeNull();
    expect(res.fanClub.memberCount).toBe(1);
    expect(repo.join).toHaveBeenCalledTimes(1);
  });

  it('TC-FC002 — rejects paid fan clubs (commerce not wired in MVP)', async () => {
    const repo = makeRepo({ ...baseClub, price: 4900 });
    const uc = new JoinFanClubUseCase(repo);
    await expect(uc.execute({ userId: 'u1', idolId: 'idol-1' })).rejects.toMatchObject({
      code: ErrorCodes.PAID_FAN_CLUB_NOT_SUPPORTED,
    });
    expect(repo.join).not.toHaveBeenCalled();
  });

  it('TC-FC003 — no fan club for the idol → FAN_CLUB_NOT_FOUND', async () => {
    const repo = makeRepo(null);
    const uc = new JoinFanClubUseCase(repo);
    await expect(uc.execute({ userId: 'u1', idolId: 'idol-none' })).rejects.toMatchObject({
      code: ErrorCodes.FAN_CLUB_NOT_FOUND,
    });
  });
});
