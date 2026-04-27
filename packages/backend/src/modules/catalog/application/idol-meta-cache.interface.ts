/**
 * Minimal idol metadata used by read-heavy hydration paths (e.g. the public
 * leaderboard). Deliberately omits BigInt counts + publishedAt + profileJson
 * — those either churn too fast to cache (counts) or don't need hydration
 * at the call site (profile).
 */
export interface IdolMeta {
  id: string;
  name: string;
  stageName: string | null;
  heroImageUrl: string | null;
}

/**
 * Bulk-read cache for idol metadata. Implementations should serve hits from
 * memory/Redis, fall back to the source of truth on misses, and populate
 * the cache for subsequent hits. Deletions / admin edits should call
 * `invalidate` — staleness window on missed invalidation is capped by TTL.
 */
export interface IdolMetaCache {
  getMany(ids: string[]): Promise<Map<string, IdolMeta>>;
  invalidate(ids: string[]): Promise<void>;
}

export const IDOL_META_CACHE = 'IdolMetaCache';
