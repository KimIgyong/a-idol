import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { AdminUserRepository } from './interfaces';
import { ADMIN_USER_REPOSITORY } from './interfaces';
import type { AdminUser } from '../domain/admin-user';

@Injectable()
export class GetAdminMeUseCase {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly repo: AdminUserRepository,
  ) {}

  async execute(id: string): Promise<AdminUser> {
    const admin = await this.repo.findById(id);
    if (!admin) throw new DomainError(ErrorCodes.SESSION_NOT_FOUND, 'Admin account not found');
    return admin;
  }
}
