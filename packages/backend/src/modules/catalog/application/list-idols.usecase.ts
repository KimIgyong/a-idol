import { Inject, Injectable } from '@nestjs/common';
import type { Idol, IdolImageDto } from '@a-idol/shared';

export interface IdolDetailRow {
  idol: Idol;
  birthdate: Date | null;
  mbti: string | null;
  bio: string | null;
  profile: unknown | null;
  images: IdolImageDto[];
  /** Surfaced for ETag — not part of the wire DTO. */
  updatedAt: Date;
}

export interface IdolRepository {
  listPublished(opts: { take: number; skip: number; sort: 'popularity' | 'name' | 'new' }): Promise<{
    items: Idol[];
    total: number;
  }>;
  /**
   * Cheap identity probe for the published-idols dataset — used by the
   * controller to build an ETag without fetching the full page. Returns
   * (total row count, max updatedAt across all published rows). Both change
   * whenever a row is inserted, deleted, or any field (including heartCount /
   * followCount) is updated via Prisma's `@updatedAt`.
   */
  getListIdentity(): Promise<{ total: number; maxUpdatedAt: Date | null }>;
  findByIdWithDetail(id: string): Promise<IdolDetailRow | null>;
}

export const IDOL_REPOSITORY = 'IdolRepository';

@Injectable()
export class ListIdolsUseCase {
  constructor(@Inject(IDOL_REPOSITORY) private readonly repo: IdolRepository) {}

  async execute(opts: { page: number; size: number; sort: 'popularity' | 'name' | 'new' }) {
    const page = Math.max(opts.page, 1);
    const size = Math.min(Math.max(opts.size, 1), 100);
    const { items, total } = await this.repo.listPublished({
      take: size,
      skip: (page - 1) * size,
      sort: opts.sort,
    });
    const nextCursor = page * size < total ? String(page + 1) : null;
    return { items, total, nextCursor };
  }

  getIdentity() {
    return this.repo.getListIdentity();
  }
}
