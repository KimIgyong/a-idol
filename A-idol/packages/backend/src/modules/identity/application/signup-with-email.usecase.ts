import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes, User } from '@a-idol/shared';
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
import { randomUUID } from 'crypto';

export interface SignupWithEmailInput {
  email: string;
  password: string;
  nickname: string;
  birthdate: Date;
  deviceId?: string;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class SignupWithEmailUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(AUTH_SESSION_REPOSITORY) private readonly sessions: AuthSessionRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
  ) {}

  async execute(input: SignupWithEmailInput): Promise<AuthResult> {
    // POL-006 age gate
    User.assertMinimumAge(input.birthdate);

    // Unique email
    if (await this.users.findByEmail(input.email)) {
      throw new DomainError(ErrorCodes.EMAIL_ALREADY_EXISTS, 'Email already in use');
    }

    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.create({
      provider: 'email',
      providerUserId: input.email, // for email provider, PUID == email
      email: input.email,
      passwordHash,
      nickname: input.nickname,
      birthdate: input.birthdate,
    });

    return this.issueTokens(user, input.deviceId ?? null);
  }

  private async issueTokens(user: User, deviceId: string | null): Promise<AuthResult> {
    const sid = randomUUID();
    const refreshToken = await this.tokens.signRefresh({ sub: user.id, sid });
    const refreshHash = await this.tokens.hashRefresh(refreshToken);
    await this.sessions.create({
      userId: user.id,
      refreshTokenHash: refreshHash,
      deviceId,
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
