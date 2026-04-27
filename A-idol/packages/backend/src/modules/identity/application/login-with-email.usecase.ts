import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import { randomUUID } from 'crypto';
import type {
  AuthSessionRepository,
  PasswordHasher,
  TokenService,
  UserRepository,
} from './interfaces';
import {
  AUTH_SESSION_REPOSITORY,
  PASSWORD_HASHER,
  TOKEN_SERVICE,
  USER_REPOSITORY,
} from './interfaces';
import type { AuthResult } from './signup-with-email.usecase';

@Injectable()
export class LoginWithEmailUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(AUTH_SESSION_REPOSITORY) private readonly sessions: AuthSessionRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
  ) {}

  async execute(input: { email: string; password: string; deviceId?: string }): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email);
    if (!user) throw new DomainError(ErrorCodes.INVALID_CREDENTIAL, 'Invalid email or password');

    const record = user.toJSON() as any;
    const passwordHash = record.passwordHash as string | null | undefined;
    if (!passwordHash) {
      // User signed up via social — can't use password login
      throw new DomainError(ErrorCodes.INVALID_CREDENTIAL, 'Use social login for this account');
    }
    const ok = await this.hasher.verify(input.password, passwordHash);
    if (!ok) throw new DomainError(ErrorCodes.INVALID_CREDENTIAL, 'Invalid email or password');

    const sid = randomUUID();
    const refreshToken = await this.tokens.signRefresh({ sub: user.id, sid });
    const refreshHash = await this.tokens.hashRefresh(refreshToken);
    await this.sessions.create({
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
