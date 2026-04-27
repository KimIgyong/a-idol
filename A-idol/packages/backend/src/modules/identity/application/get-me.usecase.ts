import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes, User } from '@a-idol/shared';
import type { UserRepository } from './interfaces';
import { USER_REPOSITORY } from './interfaces';

@Injectable()
export class GetMeUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new DomainError(ErrorCodes.SESSION_NOT_FOUND, 'User not found');
    return user;
  }
}
