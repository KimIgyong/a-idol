import { Inject, Injectable, Logger } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { AdminRole } from '@a-idol/shared';
import type { PasswordHasher } from '../../identity/application/interfaces';
import { PASSWORD_HASHER } from '../../identity/application/interfaces';
import type { AdminUserRepository } from './interfaces';
import { ADMIN_USER_REPOSITORY } from './interfaces';
import type { AdminUser } from '../domain/admin-user';

export interface CreateAdminOperatorInput {
  actorId: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: AdminRole;
}

/**
 * FR-102-A — admin 운영자가 신규 어드민 계정을 직접 생성. 이메일 초대(magic
 * link) 없이 즉시 활성. 비밀번호 정책은 controller DTO 의 `IsStrongPassword`
 * 데코레이터에서 검증되므로 use case 진입 전에 평문은 이미 정책 통과 + 해시까지
 * 변환된 상태로 들어온다 (controller 가 PasswordHasher 호출).
 *
 * 정책 (POL-010):
 *  - 이메일 unique
 *  - role==='admin' 인 경우 admin 카운트 ≤ 3 강제
 */
@Injectable()
export class CreateAdminOperatorUseCase {
  private readonly log = new Logger(CreateAdminOperatorUseCase.name);

  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly repo: AdminUserRepository,
  ) {}

  async execute(input: CreateAdminOperatorInput): Promise<AdminUser> {
    const existing = await this.repo.findByEmail(input.email);
    if (existing) {
      throw new DomainError(
        ErrorCodes.ADMIN_EMAIL_DUPLICATE,
        '이미 등록된 이메일입니다.',
      );
    }

    if (input.role === 'admin') {
      const adminCount = await this.repo.countByRole('admin');
      if (adminCount >= 3) {
        throw new DomainError(
          ErrorCodes.ADMIN_LIMIT_EXCEEDED,
          'admin 역할은 최대 3명까지 등록 가능합니다.',
          { current: adminCount },
        );
      }
    }

    const created = await this.repo.create({
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      role: input.role,
    });

    // POL-010 — 모든 admin 쓰기는 audit 대상 (audit_logs 테이블 미구축, T-082
    // 후속). 일단 structured log 로 trace 가능하게 기록.
    // TODO(audit): replace with AuditLogger.write(...) once audit_logs lands.
    this.log.log(
      `admin.create actorId=${input.actorId} createdId=${created.id} email=${created.email} role=${created.role}`,
    );

    return created;
  }
}

/**
 * Controller 에서 사용 — 평문 비밀번호 → 해시 변환 thin wrapper. use case 자체는
 * 해시만 받도록 격리하여 테스트 용이성 확보.
 */
@Injectable()
export class CreateAdminOperatorService {
  constructor(
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly useCase: CreateAdminOperatorUseCase,
  ) {}

  async execute(input: {
    actorId: string;
    email: string;
    displayName: string;
    password: string;
    role: AdminRole;
  }): Promise<AdminUser> {
    const passwordHash = await this.hasher.hash(input.password);
    return this.useCase.execute({
      actorId: input.actorId,
      email: input.email,
      displayName: input.displayName,
      passwordHash,
      role: input.role,
    });
  }
}
