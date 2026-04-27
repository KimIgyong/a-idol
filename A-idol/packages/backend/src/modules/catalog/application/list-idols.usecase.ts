import { Inject, Injectable } from '@nestjs/common';
import type { Idol } from '@a-idol/shared';

export interface IdolRepository {
  listPublished(opts: { take: number; skip: number; sort: 'popularity' | 'name' | 'new' }): Promise<{
    items: Idol[];
    total: number;
  }>;
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
}
