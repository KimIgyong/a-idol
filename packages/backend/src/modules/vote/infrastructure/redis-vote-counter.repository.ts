import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { VoteMethod } from '@a-idol/shared';
import { REDIS_CLIENT } from '../../../shared/redis/redis.module';
import type { VoteCounterRepository } from '../application/interfaces';

/**
 * Redis key layout:
 *   vote:daily:{yyyymmdd-kst}:u:{userId}:r:{roundId}:m:{METHOD}  → INCR counter, TTL → next KST midnight
 *   vote:leaderboard:r:{roundId}                                  → sorted set (ZINCRBY weight)
 */
@Injectable()
export class RedisVoteCounterRepository implements VoteCounterRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async incrDaily(input: {
    userId: string;
    roundId: string;
    method: VoteMethod;
  }): Promise<number> {
    const key = this.dailyKey(input);
    const value = await this.redis.incr(key);
    // Only set TTL on the first increment — avoids resetting expiry on re-votes.
    if (value === 1) {
      const ttl = Math.max(60, Math.floor((this.nextKstMidnightMs() - Date.now()) / 1000));
      await this.redis.expire(key, ttl);
    }
    return value;
  }

  async decrDaily(input: {
    userId: string;
    roundId: string;
    method: VoteMethod;
  }): Promise<void> {
    await this.redis.decr(this.dailyKey(input));
  }

  async incrIdolScore(input: {
    roundId: string;
    idolId: string;
    weight: number;
  }): Promise<number> {
    const score = await this.redis.zincrby(
      this.leaderboardKey(input.roundId),
      input.weight,
      input.idolId,
    );
    return Number(score);
  }

  async decrIdolScore(input: {
    roundId: string;
    idolId: string;
    weight: number;
  }): Promise<void> {
    await this.redis.zincrby(
      this.leaderboardKey(input.roundId),
      -input.weight,
      input.idolId,
    );
  }

  async topForRound(
    roundId: string,
    limit: number,
  ): Promise<Array<{ idolId: string; score: number }>> {
    // WITHSCORES returns [member, score, member, score, ...]
    const raw = await this.redis.zrevrange(
      this.leaderboardKey(roundId),
      0,
      Math.max(0, limit - 1),
      'WITHSCORES',
    );
    const out: Array<{ idolId: string; score: number }> = [];
    for (let i = 0; i < raw.length; i += 2) {
      out.push({ idolId: raw[i]!, score: Number(raw[i + 1]!) });
    }
    return out;
  }

  async readDaily(input: {
    userId: string;
    roundId: string;
    method: VoteMethod;
  }): Promise<number> {
    const value = await this.redis.get(this.dailyKey(input));
    return value ? Number(value) : 0;
  }

  private dailyKey(input: { userId: string; roundId: string; method: VoteMethod }): string {
    return `vote:daily:${this.kstDayStamp()}:u:${input.userId}:r:${input.roundId}:m:${input.method}`;
  }

  private leaderboardKey(roundId: string): string {
    return `vote:leaderboard:r:${roundId}`;
  }

  private kstDayStamp(): string {
    const now = Date.now() + 9 * 3600 * 1000;
    const day = Math.floor(now / 86_400_000);
    const date = new Date(day * 86_400_000);
    // yyyymmdd format from the KST-aligned day number
    return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  private nextKstMidnightMs(): number {
    const now = Date.now();
    const kstOffsetMs = 9 * 3600 * 1000;
    const day = Math.floor((now + kstOffsetMs) / 86_400_000);
    return (day + 1) * 86_400_000 - kstOffsetMs;
  }
}
