import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../../shared/redis/redis.module';
import type { LoginAttemptThrottle } from '../application/interfaces';

/**
 * T-082 (RPT-260426-D Phase D) — NIST SP 800-63B §5.2.2 account lockout.
 *
 *  - key: `login:fail:{email-lowercased}`
 *  - INCR + EXPIRE on first failure
 *  - 잠금 임계치(`THRESHOLD`) 도달 시 `isLocked` true. retry-after 는 키
 *    TTL.
 *  - email은 case-insensitive 정규화 (signup의 unique check도 lowercase).
 *
 *  IP 단위 ThrottlerGuard 와 *별도* layer — credential stuffing 처럼 공격자가
 *  IP rotate 하는 경우에도 특정 계정에 대한 실패가 누적되어 잠금.
 */
@Injectable()
export class RedisLoginAttemptThrottle implements LoginAttemptThrottle {
  private readonly THRESHOLD = 10;
  private readonly WINDOW_SEC = 15 * 60; // 15 minutes

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private key(email: string): string {
    return `login:fail:${email.toLowerCase()}`;
  }

  async recordFailure(email: string): Promise<void> {
    const k = this.key(email);
    const count = await this.redis.incr(k);
    // 첫 INCR 일 때만 EXPIRE — 후속 실패는 동일 window 내에서 누적.
    if (count === 1) {
      await this.redis.expire(k, this.WINDOW_SEC);
    }
  }

  async clearFailures(email: string): Promise<void> {
    await this.redis.del(this.key(email));
  }

  async status(email: string): Promise<{ locked: boolean; retryAfterSec: number }> {
    const k = this.key(email);
    const [countRaw, ttl] = await Promise.all([this.redis.get(k), this.redis.ttl(k)]);
    const count = countRaw ? Number(countRaw) : 0;
    const locked = count >= this.THRESHOLD;
    return { locked, retryAfterSec: locked ? Math.max(ttl, 0) : 0 };
  }
}
