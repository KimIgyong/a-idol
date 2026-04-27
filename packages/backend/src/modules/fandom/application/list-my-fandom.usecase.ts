import { Inject, Injectable } from '@nestjs/common';
import type { FollowRepository, HeartRepository } from './interfaces';
import { FOLLOW_REPOSITORY, HEART_REPOSITORY } from './interfaces';

@Injectable()
export class ListMyHeartsUseCase {
  constructor(@Inject(HEART_REPOSITORY) private readonly repo: HeartRepository) {}

  async execute(input: { userId: string; page: number; size: number }) {
    const page = Math.max(input.page, 1);
    const size = Math.min(Math.max(input.size, 1), 100);
    const { items, total } = await this.repo.listHeartedIdols(input.userId, {
      take: size,
      skip: (page - 1) * size,
    });
    const nextCursor = page * size < total ? String(page + 1) : null;
    return { items, total, nextCursor };
  }

  getIdentity(userId: string) {
    return this.repo.getMyListIdentity(userId);
  }
}

@Injectable()
export class ListMyFollowsUseCase {
  constructor(@Inject(FOLLOW_REPOSITORY) private readonly repo: FollowRepository) {}

  async execute(input: { userId: string; page: number; size: number }) {
    const page = Math.max(input.page, 1);
    const size = Math.min(Math.max(input.size, 1), 100);
    const { items, total } = await this.repo.listFollowedIdols(input.userId, {
      take: size,
      skip: (page - 1) * size,
    });
    const nextCursor = page * size < total ? String(page + 1) : null;
    return { items, total, nextCursor };
  }

  getIdentity(userId: string) {
    return this.repo.getMyListIdentity(userId);
  }
}
