import { Inject, Injectable } from '@nestjs/common';
import type { MyVoteEntry, VoteAuditRepository } from './interfaces';
import { VOTE_AUDIT_REPOSITORY } from './interfaces';

const MAX_PAGE_SIZE = 50;

/**
 * SCR-023 — 내 투표 이력 (페이지네이션, 최신순). idol/round/audition meta는
 * repository에서 batch hydrate.
 */
@Injectable()
export class ListMyVotesUseCase {
  constructor(
    @Inject(VOTE_AUDIT_REPOSITORY) private readonly audit: VoteAuditRepository,
  ) {}

  async execute(input: {
    userId: string;
    page?: number;
    size?: number;
  }): Promise<{ items: MyVoteEntry[]; total: number; nextCursor: string | null }> {
    const page = Math.max(1, Math.floor(input.page ?? 1));
    const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(input.size ?? 20)));
    const skip = (page - 1) * size;
    const { items, total } = await this.audit.listMyVotes(input.userId, {
      take: size,
      skip,
    });
    const consumed = skip + items.length;
    return {
      items,
      total,
      nextCursor: consumed < total ? String(page + 1) : null,
    };
  }
}
