import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
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

@Injectable()
export class RefreshAdminTokenUseCase {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly repo: AdminUserRepository,
    @Inject(ADMIN_TOKEN_SERVICE) private readonly tokens: AdminTokenService,
    @Inject(ADMIN_AUTH_SESSION_REPOSITORY)
    private readonly sessions: AdminAuthSessionRepository,
  ) {}

  async execute(input: { refreshToken: string }): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    let payload: { sub: string; role: 'admin' | 'operator' | 'viewer'; sid: string };
    try {
      payload = await this.tokens.verifyRefresh(input.refreshToken);
    } catch {
      throw new DomainError(ErrorCodes.INVALID_REFRESH_TOKEN, 'Invalid or expired refresh token');
    }

    const session = await this.sessions.findByIdForAdmin(payload.sid, payload.sub);
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new DomainError(
        ErrorCodes.INVALID_REFRESH_TOKEN,
        'Session not found, revoked, or expired',
      );
    }
    const submittedHash = await this.tokens.hashRefresh(input.refreshToken);
    if (submittedHash !== session.refreshTokenHash) {
      // Reuse detected — defensive revoke.
      await this.sessions.revoke(session.id);
      throw new DomainError(ErrorCodes.INVALID_REFRESH_TOKEN, 'Refresh token mismatch');
    }

    const admin = await this.repo.findById(payload.sub);
    if (!admin) throw new DomainError(ErrorCodes.INVALID_REFRESH_TOKEN, 'Account no longer exists');
    admin.assertCanLogin();

    // Re-sign with current role (in case role changed). Rotate session hash.
    const newRefresh = await this.tokens.signRefresh({
      sub: admin.id,
      role: admin.role,
      sid: session.id,
    });
    const newHash = await this.tokens.hashRefresh(newRefresh);
    await this.sessions.rotate(session.id, newHash, this.tokens.refreshExpiresAt());
    const accessToken = await this.tokens.signAccess({ sub: admin.id, role: admin.role });

    return {
      accessToken,
      refreshToken: newRefresh,
      expiresIn: this.tokens.accessExpiresInSeconds(),
    };
  }
}
