import type { Idol } from '@a-idol/shared';

/**
 * Atomic heart toggle: inserts or deletes the join row AND adjusts
 * `idols.heart_count` in the same transaction. Returns the post-state.
 */
export interface HeartRepository {
  toggle(userId: string, idolId: string): Promise<{ hearted: boolean; heartCount: number }>;
  listHeartedIdols(userId: string, opts: { take: number; skip: number }): Promise<{
    items: Idol[];
    total: number;
  }>;
  /**
   * Cheap identity probe for /me/hearts ETag. Returns the user's heart row
   * count + the most recent heart.createdAt. Indexed lookup on (userId).
   * Does NOT reflect heartCount/followCount drift from other users' activity
   * on listed idols — that's accepted as weak-ETag staleness (documented in
   * ADR-021).
   */
  getMyListIdentity(userId: string): Promise<{ total: number; maxCreatedAt: Date | null }>;
}

export interface FollowRepository {
  toggle(userId: string, idolId: string): Promise<{ following: boolean; followCount: number }>;
  listFollowedIdols(userId: string, opts: { take: number; skip: number }): Promise<{
    items: Idol[];
    total: number;
  }>;
  /** See HeartRepository.getMyListIdentity. */
  getMyListIdentity(userId: string): Promise<{ total: number; maxCreatedAt: Date | null }>;
}

export const HEART_REPOSITORY = 'HeartRepository';
export const FOLLOW_REPOSITORY = 'FollowRepository';

// -- Fan Club / Membership -----------------------------------------------

export interface FanClubRecord {
  id: string;
  idolId: string;
  tier: string;
  price: number;
  memberCount: number;
  createdAt: Date;
}

export interface MembershipRecord {
  id: string;
  fanClubId: string;
  idolId: string;
  userId: string;
  tier: string;
  joinedAt: Date;
  leftAt: Date | null;
}

export interface FanClubRepository {
  findByIdol(idolId: string): Promise<FanClubRecord | null>;
  findMembership(userId: string, idolId: string): Promise<MembershipRecord | null>;
  /** Join: creates a new membership or clears leftAt on an existing one. Idempotent. */
  join(userId: string, fanClubId: string): Promise<MembershipRecord>;
  /** Leave: marks leftAt=now() on the active membership. Idempotent (no-op if not a member). */
  leave(userId: string, fanClubId: string): Promise<MembershipRecord | null>;
  listMyMemberships(userId: string, opts: { take: number; skip: number }): Promise<{
    items: MembershipRecord[];
    total: number;
  }>;
}

export const FAN_CLUB_REPOSITORY = 'FanClubRepository';

// -- Cheer (응원댓글) — RPT-260426-C P2 ----------------------------------

export interface CheerRecord {
  id: string;
  userId: string;
  idolId: string;
  message: string;
  createdAt: Date;
  /** Author 표시용. join 비용 최소화를 위해 listByIdol에서 한 번에 hydrate. */
  authorNickname: string;
  authorAvatarUrl: string | null;
}

export interface CheerRepository {
  create(input: { userId: string; idolId: string; message: string }): Promise<CheerRecord>;
  listByIdol(
    idolId: string,
    opts: { take: number; skip: number },
  ): Promise<{ items: CheerRecord[]; total: number }>;
}

export const CHEER_REPOSITORY = 'CheerRepository';
