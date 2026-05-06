import { Inject, Injectable, Logger } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { AdminRole } from '@a-idol/shared';
import type { AdminUserRepository } from './interfaces';
import { ADMIN_USER_REPOSITORY } from './interfaces';
import type { AdminUser } from '../domain/admin-user';

export interface UpdateAdminRoleInput {
  actorId: string;
  targetId: string;
  role: AdminRole;
}

/**
 * FR-102-B — 어드민 역할 변경.
 *
 * 정책 (POL-010):
 *  - 자기 자신 변경 금지 (actorId === targetId)
 *  - 마지막 admin 강등 금지 (admin 잔여수 ≥ 1 보장)
 *  - admin 한도 ≤ 3 (승격 케이스)
 *  - 동일 role → 멱등 no-op (현재 도메인 객체 그대로 반환)
 */
@Injectable()
export class UpdateAdminRoleUseCase {
  private readonly log = new Logger(UpdateAdminRoleUseCase.name);

  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly repo: AdminUserRepository,
  ) {}

  async execute(input: UpdateAdminRoleInput): Promise<AdminUser> {
    if (input.actorId === input.targetId) {
      throw new DomainError(
        ErrorCodes.ADMIN_SELF_MODIFICATION_FORBIDDEN,
        '자기 자신의 역할은 변경할 수 없습니다.',
      );
    }

    const target = await this.repo.findById(input.targetId);
    if (!target) {
      throw new DomainError(ErrorCodes.ADMIN_NOT_FOUND, '대상 어드민이 존재하지 않습니다.');
    }

    if (target.role === input.role) {
      return target;
    }

    if (target.role === 'admin' && input.role !== 'admin') {
      const adminCount = await this.repo.countByRole('admin');
      if (adminCount <= 1) {
        throw new DomainError(
          ErrorCodes.ADMIN_LAST_ADMIN_DEMOTION,
          '마지막 admin 계정은 강등할 수 없습니다.',
          { current: adminCount },
        );
      }
    }

    if (input.role === 'admin' && target.role !== 'admin') {
      const adminCount = await this.repo.countByRole('admin');
      if (adminCount >= 3) {
        throw new DomainError(
          ErrorCodes.ADMIN_LIMIT_EXCEEDED,
          'admin 역할은 최대 3명까지 등록 가능합니다.',
          { current: adminCount },
        );
      }
    }

    const updated = await this.repo.updateRole(input.targetId, input.role);
    if (!updated) {
      // 동시성 — findById 후 update 사이에 삭제된 경우. drop-through 가드.
      throw new DomainError(ErrorCodes.ADMIN_NOT_FOUND, '대상 어드민이 존재하지 않습니다.');
    }

    // TODO(audit): POL-010 — replace with AuditLogger.write(...).
    this.log.log(
      `admin.role-change actorId=${input.actorId} targetId=${updated.id} from=${target.role} to=${updated.role}`,
    );

    return updated;
  }
}
