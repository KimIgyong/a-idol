import { Inject, Injectable } from '@nestjs/common';
import type { AuthSessionRepository, TokenService } from './interfaces';
import { AUTH_SESSION_REPOSITORY, TOKEN_SERVICE } from './interfaces';

/**
 * `POST /api/v1/auth/logout` — refresh token에 binding된 session을 revoke.
 *
 * RPT-260426-D Phase D T-082 후속. 모바일 signOut 시 호출하여 leak된
 * refresh token이 14일 잔존하지 않도록 server-side에서 즉시 무효화.
 *
 * 의도적으로 invalid token은 silent OK — 클라이언트 retry를 유도하지 않기
 * 위해 idempotent. 실제 보안 보장은 valid sid 가 들어왔을 때만의 revoke.
 */
@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY) private readonly sessions: AuthSessionRepository,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
  ) {}

  async execute(input: { refreshToken: string }): Promise<{ revoked: boolean }> {
    let payload: { sub: string; sid: string };
    try {
      payload = await this.tokens.verifyRefresh(input.refreshToken);
    } catch {
      // bogus / 만료 token은 silent — 이미 무효화된 것과 등가.
      return { revoked: false };
    }

    const session = await this.sessions.findByIdForUser(payload.sid, payload.sub);
    if (!session || !session.isActive()) {
      return { revoked: false };
    }
    await this.sessions.revoke(session.id);
    return { revoked: true };
  }
}
