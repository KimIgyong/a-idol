import { Inject, Injectable } from '@nestjs/common';
import type { AdminUserRepository } from './interfaces';
import { ADMIN_USER_REPOSITORY } from './interfaces';
import type { AdminUser } from '../domain/admin-user';

/**
 * 운영자 관리 (Operator Management) 페이지의 read-only list. RPT-260426-B
 * §5의 첫 슬라이스. write actions(create/update role/suspend)은 같은
 * controller에 incremental 추가될 예정 — 이 usecase는 의도적으로 list만.
 *
 * RBAC: 호출 controller가 `@Roles('admin')` 적용 — operator/viewer는 거부.
 */
@Injectable()
export class ListOperatorsUseCase {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly repo: AdminUserRepository,
  ) {}

  execute(): Promise<AdminUser[]> {
    return this.repo.listAll();
  }
}
