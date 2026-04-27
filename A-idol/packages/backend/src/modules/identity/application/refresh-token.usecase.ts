import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type {
  AuthSessionRepository,
  TokenService,
  UserRepository,
} from './interfaces';
import {
  AUTH_SESSION_REPOSITORY,
  TOKEN_SERVICE,
  USER_REPOSITORY,
} from './interfaces';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(AUTH_SESSION_REPOSITORY) private readonly sessions: AuthSessionRepository,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
  ) {}

  async execute(input: { refreshToken: string }): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    let payload: { sub: string; sid: string };
    try {
      payload = await this.tokens.verifyRefresh(input.refreshToken);
    } catch {
      throw new DomainError(ErrorCodes.INVALID_REFRESH_TOKEN, 'Refresh token invalid or expired');
    }

    const session = await this.sessions.findByIdForUser(payload.sid, payload.sub);
    if (!session || !session.isActive()) {
      throw new DomainError(ErrorCodes.INVALID_REFRESH_TOKEN, 'Session not found or revoked');
    }

    const submittedHash = await this.tokens.hashRefresh(input.refreshToken);
    if (submittedHash !== session.refreshTokenHash) {
      // Reuse detected — revoke session defensively
      await this.sessions.revoke(session.id);
      throw new DomainError(ErrorCodes.INVALID_REFRESH_TOKEN, 'Refresh token mismatch');
    }

    // Rotate
    const newRefresh = await this.tokens.signRefresh({ sub: payload.sub, sid: session.id });
    const newHash = await this.tokens.hashRefresh(newRefresh);
    const newExpires = this.tokens.refreshExpiresAt();
    await this.sessions.rotate(session.id, newHash, newExpires);
    const accessToken = await this.tokens.signAccess({ sub: payload.sub });
    return {
      accessToken,
      refreshToken: newRefresh,
      expiresIn: this.tokens.accessExpiresInSeconds(),
    };
  }
}
