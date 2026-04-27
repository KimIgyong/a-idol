import { Inject, Injectable } from '@nestjs/common';
import type {
  AdminAuthSessionRepository,
  AdminTokenService,
} from './interfaces';
import {
  ADMIN_AUTH_SESSION_REPOSITORY,
  ADMIN_TOKEN_SERVICE,
} from './interfaces';

/**
 * `POST /api/v1/admin/auth/logout` — admin refresh token에 binding된 session revoke.
 *
 * RPT-260426-D Phase D T-082. CMS signOut에서 호출하여 leak된 admin token이
 * 14일 잔존하지 않도록 server-side 즉시 무효화. Idempotent (invalid/expired
 * 토큰은 silent OK).
 */
@Injectable()
export class LogoutAdminUseCase {
  constructor(
    @Inject(ADMIN_TOKEN_SERVICE) private readonly tokens: AdminTokenService,
    @Inject(ADMIN_AUTH_SESSION_REPOSITORY)
    private readonly sessions: AdminAuthSessionRepository,
  ) {}

  async execute(input: { refreshToken: string }): Promise<{ revoked: boolean }> {
    let payload: { sub: string; sid: string };
    try {
      payload = await this.tokens.verifyRefresh(input.refreshToken);
    } catch {
      return { revoked: false };
    }
    const session = await this.sessions.findByIdForAdmin(payload.sid, payload.sub);
    if (!session || session.revokedAt) {
      return { revoked: false };
    }
    await this.sessions.revoke(session.id);
    return { revoked: true };
  }
}
