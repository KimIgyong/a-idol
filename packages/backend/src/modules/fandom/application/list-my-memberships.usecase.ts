import { Inject, Injectable } from '@nestjs/common';
import type { FanClubRepository } from './interfaces';
import { FAN_CLUB_REPOSITORY } from './interfaces';

@Injectable()
export class ListMyMembershipsUseCase {
  constructor(@Inject(FAN_CLUB_REPOSITORY) private readonly repo: FanClubRepository) {}

  async execute(input: { userId: string; page: number; size: number }) {
    const page = Math.max(input.page, 1);
    const size = Math.min(Math.max(input.size, 1), 100);
    const { items, total } = await this.repo.listMyMemberships(input.userId, {
      take: size,
      skip: (page - 1) * size,
    });
    const nextCursor = page * size < total ? String(page + 1) : null;
    return { items, total, nextCursor };
  }
}
