import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'crypto';
import { AppConfig } from '../../../config/config.schema';
import type { TokenService } from '../application/interfaces';

@Injectable()
export class JwtTokenService implements TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly cfg: AppConfig,
  ) {}

  signAccess(input: { sub: string }): Promise<string> {
    // jti (RFC 7519 §4.1.7) — token uniqueness 보장. 같은 second에 회전된
    // refresh token이 동일 페이로드라도 서로 다른 JWT 가 되어 reuse-detection
    // 의 hash mismatch 가 정확히 동작.
    return this.jwt.signAsync(
      { sub: input.sub, type: 'access', jti: randomUUID() },
      { secret: this.cfg.jwtAccessSecret, expiresIn: this.cfg.jwtAccessExpiresIn },
    );
  }

  signRefresh(input: { sub: string; sid: string }): Promise<string> {
    return this.jwt.signAsync(
      { sub: input.sub, sid: input.sid, type: 'refresh', jti: randomUUID() },
      { secret: this.cfg.jwtRefreshSecret, expiresIn: this.cfg.jwtRefreshExpiresIn },
    );
  }

  async verifyAccess(token: string): Promise<{ sub: string }> {
    const payload = await this.jwt.verifyAsync<{ sub: string; type: string }>(token, {
      secret: this.cfg.jwtAccessSecret,
    });
    // Admin tokens share the secret but carry `type: 'admin-access'`. The
    // user guard must reject them as 401 — if it raised 500 an attacker
    // could fingerprint token shapes via error codes.
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Not a user access token');
    }
    return { sub: payload.sub };
  }

  async verifyRefresh(token: string): Promise<{ sub: string; sid: string }> {
    const payload = await this.jwt.verifyAsync<{ sub: string; sid: string; type: string }>(token, {
      secret: this.cfg.jwtRefreshSecret,
    });
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Not a refresh token');
    }
    return { sub: payload.sub, sid: payload.sid };
  }

  async hashRefresh(token: string): Promise<string> {
    return createHash('sha256').update(token).digest('hex');
  }

  accessExpiresInSeconds(): number {
    return parseDuration(this.cfg.jwtAccessExpiresIn);
  }

  refreshExpiresAt(from: Date = new Date()): Date {
    const seconds = parseDuration(this.cfg.jwtRefreshExpiresIn);
    return new Date(from.getTime() + seconds * 1000);
  }
}

/**
 * Parses simple duration strings used by @nestjs/jwt: e.g. "15m", "14d", "3600".
 */
function parseDuration(input: string): number {
  if (/^\d+$/.test(input)) return Number(input);
  const match = /^(\d+)\s*(s|m|h|d)$/i.exec(input);
  if (!match) return 0;
  const n = Number(match[1]);
  switch (match[2].toLowerCase()) {
    case 's': return n;
    case 'm': return n * 60;
    case 'h': return n * 3600;
    case 'd': return n * 86400;
  }
  return 0;
}
