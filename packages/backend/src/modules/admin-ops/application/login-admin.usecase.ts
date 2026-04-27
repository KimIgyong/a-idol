import { randomUUID } from 'crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type {
  LoginAttemptThrottle,
  PasswordHasher,
} from '../../identity/application/interfaces';
import {
  LOGIN_ATTEMPT_THROTTLE,
  PASSWORD_HASHER,
} from '../../identity/application/interfaces';
import type {
  AdminAuthSessionRepository,
  AdminTokenService,
  AdminUserRepository,
} from './interfaces';
import {
  ADMIN_AUTH_SESSION_REPOSITORY,
  ADMIN_TOKEN_SERVICE,
  ADMIN_USER_REPOSITORY,
} from './interfaces';
import type { AdminUser } from '../domain/admin-user';
import { MetricsService } from '../../../shared/metrics/metrics.service';

export interface AdminAuthResult {
  user: AdminUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class LoginAdminUseCase {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly repo: AdminUserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(ADMIN_TOKEN_SERVICE) private readonly tokens: AdminTokenService,
    @Inject(ADMIN_AUTH_SESSION_REPOSITORY)
    private readonly sessions: AdminAuthSessionRepository,
    @Inject(LOGIN_ATTEMPT_THROTTLE)
    private readonly attempts: LoginAttemptThrottle,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async execute(input: { email: string; password: string }): Promise<AdminAuthResult> {
    // T-082 NIST §5.2.2 — admin login도 동일 account lockout. credential
    // stuffing 방어. user 와 같은 Redis namespace 사용 (`login:fail:{email}`)
    // — admin과 user는 별도 email pool이라 충돌 없음.
    const lockStatus = await this.attempts.status(input.email);
    if (lockStatus.locked) {
      this.metrics?.recordAccountLocked('admin');
      throw new DomainError(
        ErrorCodes.ACCOUNT_LOCKED,
        `너무 많은 로그인 실패로 관리자 계정이 일시 잠겼습니다. ${lockStatus.retryAfterSec}초 후 다시 시도하세요.`,
        { retryAfterSec: lockStatus.retryAfterSec },
      );
    }

    const admin = await this.repo.findByEmail(input.email);
    if (!admin) {
      await this.attempts.recordFailure(input.email);
      this.metrics?.recordLoginFailure('admin');
      throw new DomainError(ErrorCodes.INVALID_CREDENTIAL, 'Invalid email or password');
    }
    admin.assertCanLogin();

    const ok = await this.hasher.verify(input.password, admin.passwordHash);
    if (!ok) {
      await this.attempts.recordFailure(input.email);
      this.metrics?.recordLoginFailure('admin');
      throw new DomainError(ErrorCodes.INVALID_CREDENTIAL, 'Invalid email or password');
    }
    // 성공 시 카운터 리셋.
    await this.attempts.clearFailures(input.email);

    const sid = randomUUID();
    const accessToken = await this.tokens.signAccess({ sub: admin.id, role: admin.role });
    const refreshToken = await this.tokens.signRefresh({
      sub: admin.id,
      role: admin.role,
      sid,
    });
    const refreshHash = await this.tokens.hashRefresh(refreshToken);
    await this.sessions.create({
      id: sid,
      adminUserId: admin.id,
      refreshTokenHash: refreshHash,
      expiresAt: this.tokens.refreshExpiresAt(),
    });
    await this.repo.touchLastLogin(admin.id, new Date());

    return {
      user: admin,
      accessToken,
      refreshToken,
      expiresIn: this.tokens.accessExpiresInSeconds(),
    };
  }
}
