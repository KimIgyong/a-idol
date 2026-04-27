import { Inject, Injectable, Optional } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import { randomUUID } from 'crypto';
import type {
  AuthSessionRepository,
  LoginAttemptThrottle,
  PasswordHasher,
  TokenService,
  UserRepository,
} from './interfaces';
import {
  AUTH_SESSION_REPOSITORY,
  LOGIN_ATTEMPT_THROTTLE,
  PASSWORD_HASHER,
  TOKEN_SERVICE,
  USER_REPOSITORY,
} from './interfaces';
import type { AuthResult } from './signup-with-email.usecase';
import { MetricsService } from '../../../shared/metrics/metrics.service';

@Injectable()
export class LoginWithEmailUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(AUTH_SESSION_REPOSITORY) private readonly sessions: AuthSessionRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    @Inject(LOGIN_ATTEMPT_THROTTLE)
    private readonly attempts: LoginAttemptThrottle,
    // Optional — unit specs construct usecase manually without metrics. Live
    // app always wires it via @Global() MetricsModule.
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async execute(input: { email: string; password: string; deviceId?: string }): Promise<AuthResult> {
    // T-082 NIST §5.2.2 — account lockout (IP throttle 와 별도 layer).
    const lockStatus = await this.attempts.status(input.email);
    if (lockStatus.locked) {
      this.metrics?.recordAccountLocked('user');
      throw new DomainError(
        ErrorCodes.ACCOUNT_LOCKED,
        `너무 많은 로그인 실패로 계정이 일시 잠겼습니다. ${lockStatus.retryAfterSec}초 후 다시 시도하세요.`,
        { retryAfterSec: lockStatus.retryAfterSec },
      );
    }

    const user = await this.users.findByEmail(input.email);
    if (!user) {
      // 존재 안 하는 이메일도 같은 카운터 — enumeration 방어용 + 공격자가
      // 무차별 시도 시 동일 effect.
      await this.attempts.recordFailure(input.email);
      this.metrics?.recordLoginFailure('user');
      throw new DomainError(ErrorCodes.INVALID_CREDENTIAL, 'Invalid email or password');
    }

    // The Prisma adapter overrides User.toJSON() to leak the password hash into
    // this bounded context (see PrismaUserRepository.toDomain).
    const record = user.toJSON() as { passwordHash?: string | null };
    const { passwordHash } = record;
    if (!passwordHash) {
      // User signed up via social — can't use password login
      this.metrics?.recordLoginFailure('user');
      throw new DomainError(ErrorCodes.INVALID_CREDENTIAL, 'Use social login for this account');
    }
    const ok = await this.hasher.verify(input.password, passwordHash);
    if (!ok) {
      await this.attempts.recordFailure(input.email);
      this.metrics?.recordLoginFailure('user');
      throw new DomainError(ErrorCodes.INVALID_CREDENTIAL, 'Invalid email or password');
    }
    // 성공 시 카운터 리셋.
    await this.attempts.clearFailures(input.email);

    const sid = randomUUID();
    const refreshToken = await this.tokens.signRefresh({ sub: user.id, sid });
    const refreshHash = await this.tokens.hashRefresh(refreshToken);
    await this.sessions.create({
      id: sid,
      userId: user.id,
      refreshTokenHash: refreshHash,
      deviceId: input.deviceId ?? null,
      expiresAt: this.tokens.refreshExpiresAt(),
    });
    const accessToken = await this.tokens.signAccess({ sub: user.id });
    return {
      user,
      accessToken,
      refreshToken,
      expiresIn: this.tokens.accessExpiresInSeconds(),
    };
  }
}
