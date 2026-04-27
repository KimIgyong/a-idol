import { Inject, Injectable } from '@nestjs/common';
import type { HeartRepository } from './interfaces';
import { HEART_REPOSITORY } from './interfaces';

@Injectable()
export class ToggleHeartUseCase {
  constructor(@Inject(HEART_REPOSITORY) private readonly repo: HeartRepository) {}

  execute(input: { userId: string; idolId: string }) {
    return this.repo.toggle(input.userId, input.idolId);
  }
}
