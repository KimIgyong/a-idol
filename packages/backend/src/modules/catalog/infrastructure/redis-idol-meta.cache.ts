import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../../shared/redis/redis.module';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { IdolMeta, IdolMetaCache } from '../application/idol-meta-cache.interface';

const KEY_PREFIX = 'idol:meta:';
/**
 * 5 minutes. Idol metadata (name / stageName / heroImageUrl) changes on
 * admin edits — minutes-to-hours cadence. 5 min caps staleness cheaply;
 * write-through invalidation on AdminIdolRepository mutations is a future
 * refinement (currently absent — staleness cap is TTL).
 */
const TTL_SECONDS = 300;

/**
 * Redis-first idol metadata cache. On `getMany` we MGET by id; for any
 * missing ids we hit Prisma once, then pipeline-SET them with TTL.
 *
 * Chosen over Prisma-only because the leaderboard hydration path does
 * N (up to ~50) row lookups per request and is called every few seconds
 * by mobile clients during active rounds — caching collapses that into
 * roughly 0 DB calls on hit and 1 call on partial miss.
 */
@Injectable()
export class RedisIdolMetaCache implements IdolMetaCache {
  private readonly log = new Logger(RedisIdolMetaCache.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  async getMany(ids: string[]): Promise<Map<string, IdolMeta>> {
    if (ids.length === 0) return new Map();
    const keys = ids.map((id) => KEY_PREFIX + id);
    const raws = await this.redis.mget(...keys);

    const result = new Map<string, IdolMeta>();
    const missing: string[] = [];

    for (let i = 0; i < ids.length; i++) {
      const raw = raws[i];
      if (raw) {
        try {
          result.set(ids[i], JSON.parse(raw) as IdolMeta);
          continue;
        } catch {
          // Corrupted entry — treat as miss, the source-of-truth lookup
          // will overwrite it.
          this.log.warn(`corrupted cache entry for ${ids[i]}, refetching`);
        }
      }
      missing.push(ids[i]);
    }

    if (missing.length > 0) {
      const rows = await this.prisma.idol.findMany({
        where: { id: { in: missing } },
        select: { id: true, name: true, stageName: true, heroImageUrl: true },
      });
      if (rows.length > 0) {
        const pipe = this.redis.pipeline();
        for (const row of rows) {
          const meta: IdolMeta = {
            id: row.id,
            name: row.name,
            stageName: row.stageName,
            heroImageUrl: row.heroImageUrl,
          };
          result.set(row.id, meta);
          pipe.set(KEY_PREFIX + row.id, JSON.stringify(meta), 'EX', TTL_SECONDS);
        }
        await pipe.exec();
      }
      // Missing ids that Prisma also didn't return (soft-deleted / never
      // existed) are simply absent from `result` — callers decide fallback.
    }
    return result;
  }

  async invalidate(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const keys = ids.map((id) => KEY_PREFIX + id);
    await this.redis.del(...keys);
  }
}
