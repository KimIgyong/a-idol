import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { RoundRepository } from '../../audition/application/interfaces';
import { ROUND_REPOSITORY } from '../../audition/application/interfaces';
import type { IdolMetaCache } from '../../catalog/application/idol-meta-cache.interface';
import { IDOL_META_CACHE } from '../../catalog/application/idol-meta-cache.interface';
import type { VoteCounterRepository } from './interfaces';
import { VOTE_COUNTER_REPOSITORY } from './interfaces';
import type { RoundStatus } from '@a-idol/shared';

export interface LeaderboardView {
  roundId: string;
  status: RoundStatus;
  entries: Array<{
    rank: number;
    idolId: string;
    idolName: string;
    stageName: string | null;
    heroImageUrl: string | null;
    score: number;
  }>;
}

@Injectable()
export class GetLeaderboardUseCase {
  constructor(
    @Inject(ROUND_REPOSITORY) private readonly rounds: RoundRepository,
    @Inject(VOTE_COUNTER_REPOSITORY) private readonly counters: VoteCounterRepository,
    @Inject(IDOL_META_CACHE) private readonly idolMeta: IdolMetaCache,
  ) {}

  async execute(roundId: string, limit = 50): Promise<LeaderboardView> {
    const round = await this.rounds.findById(roundId);
    if (!round) throw new DomainError(ErrorCodes.ROUND_NOT_FOUND, 'Round not found');

    const top = await this.counters.topForRound(roundId, limit);
    if (top.length === 0) {
      return { roundId, status: round.status, entries: [] };
    }

    const idolIds = top.map((t) => t.idolId);
    // Redis-first idol metadata hydration — on warm cache this replaces the
    // N-row Prisma findMany with a single MGET. Measured impact: see
    // docs/ops/perf-baseline-ko.md.
    const byId = await this.idolMeta.getMany(idolIds);

    const entries = top.map((t, idx) => {
      const idol = byId.get(t.idolId);
      return {
        rank: idx + 1,
        idolId: t.idolId,
        idolName: idol?.name ?? '(deleted)',
        stageName: idol?.stageName ?? null,
        heroImageUrl: idol?.heroImageUrl ?? null,
        score: t.score,
      };
    });

    return { roundId, status: round.status, entries };
  }
}
