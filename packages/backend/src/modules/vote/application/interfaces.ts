import type { VoteMethod } from '@a-idol/shared';

/**
 * Live leaderboard + per-user daily counters. Redis is the source of truth
 * for both; Postgres holds an audit log (see VoteAuditRepository).
 */
export interface VoteCounterRepository {
  /**
   * Increment today's counter for (user, round, method) and return the new
   * post-increment value. TTL is set to the next KST midnight on first create.
   */
  incrDaily(input: {
    userId: string;
    roundId: string;
    method: VoteMethod;
  }): Promise<number>;
  /** Decrement — used to roll back when the incremented value exceeds the limit. */
  decrDaily(input: {
    userId: string;
    roundId: string;
    method: VoteMethod;
  }): Promise<void>;
  /** Add `weight` to this idol's running leaderboard score (sorted set). */
  incrIdolScore(input: {
    roundId: string;
    idolId: string;
    weight: number;
  }): Promise<number>;
  /** Remove score contribution when DB insert fails. */
  decrIdolScore(input: {
    roundId: string;
    idolId: string;
    weight: number;
  }): Promise<void>;
  /** Return the top-N leaderboard entries (sorted desc). */
  topForRound(roundId: string, limit: number): Promise<Array<{ idolId: string; score: number }>>;
  /** Read today's count for this user on this round/method without mutating. */
  readDaily(input: {
    userId: string;
    roundId: string;
    method: VoteMethod;
  }): Promise<number>;
}

/**
 * One row of caller's vote history (SCR-023). idol/round/audition meta is
 * batch-hydrated by the repository — DB has no Prisma relation between
 * `votes` and `idols/rounds`, so we do explicit `findMany({ where: { id:
 * { in: ids } } })` joins client-side.
 */
export interface MyVoteEntry {
  id: string;
  roundId: string;
  roundName: string;
  auditionId: string;
  auditionName: string;
  idolId: string;
  idolName: string;
  idolStageName: string | null;
  idolHeroImageUrl: string | null;
  method: VoteMethod;
  weight: number;
  createdAt: Date;
}

export interface VoteAuditRepository {
  append(input: {
    roundId: string;
    idolId: string;
    userId: string;
    method: VoteMethod;
    weight: number;
  }): Promise<void>;

  /**
   * SCR-023 자동추출 — 이 유저의 투표 이력 (최신순, paginated).
   * idol/round/audition meta는 batch 조회로 hydrate.
   */
  listMyVotes(
    userId: string,
    opts: { take: number; skip: number },
  ): Promise<{ items: MyVoteEntry[]; total: number }>;
}

export const VOTE_COUNTER_REPOSITORY = 'VoteCounterRepository';
export const VOTE_AUDIT_REPOSITORY = 'VoteAuditRepository';
