import { Inject, Injectable } from '@nestjs/common';
import type { FollowRepository } from './interfaces';
import { FOLLOW_REPOSITORY } from './interfaces';

@Injectable()
export class ToggleFollowUseCase {
  constructor(@Inject(FOLLOW_REPOSITORY) private readonly repo: FollowRepository) {}

  execute(input: { userId: string; idolId: string }) {
    return this.repo.toggle(input.userId, input.idolId);
  }
}
