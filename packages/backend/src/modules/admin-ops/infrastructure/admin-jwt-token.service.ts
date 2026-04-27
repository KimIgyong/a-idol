import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'crypto';
import type { AdminRole } from '@a-idol/shared';
import { AppConfig } from '../../../config/config.schema';
import type { AdminTokenService } from '../application/interfaces';

interface AdminJwtPayload {
  sub: string;
  role: AdminRole;
  type: 'admin-access' | 'admin-refresh';
  sid?: string;
}

@Injectable()
export class AdminJwtTokenService implements AdminTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly cfg: AppConfig,
  ) {}

  signAccess(input: { sub: string; role: AdminRole }): Promise<string> {
    // jti (RFC 7519 §4.1.7) — same-second 회전된 토큰도 unique. 사용자 토큰과
    // 동일한 정책 (T-082, RPT-260426-D Phase D).
    return this.jwt.signAsync(
      { sub: input.sub, role: input.role, type: 'admin-access', jti: randomUUID() },
      { secret: this.cfg.jwtAccessSecret, expiresIn: this.cfg.jwtAccessExpiresIn },
    );
  }

  signRefresh(input: { sub: string; role: AdminRole; sid: string }): Promise<string> {
    return this.jwt.signAsync(
      {
        sub: input.sub,
        role: input.role,
        sid: input.sid,
        type: 'admin-refresh',
        jti: randomUUID(),
      },
      { secret: this.cfg.jwtRefreshSecret, expiresIn: this.cfg.jwtRefreshExpiresIn },
    );
  }

  async verifyAccess(token: string): Promise<{ sub: string; role: AdminRole }> {
    const payload = await this.jwt.verifyAsync<AdminJwtPayload>(token, {
      secret: this.cfg.jwtAccessSecret,
    });
    // Users' tokens share the same secret but carry `type: 'access'`. The
    // admin guard must reject them as 401, not 500.
    if (payload.type !== 'admin-access') {
      throw new UnauthorizedException('Not an admin access token');
    }
    return { sub: payload.sub, role: payload.role };
  }

  async verifyRefresh(token: string): Promise<{ sub: string; role: AdminRole; sid: string }> {
    const payload = await this.jwt.verifyAsync<AdminJwtPayload>(token, {
      secret: this.cfg.jwtRefreshSecret,
    });
    if (payload.type !== 'admin-refresh') {
      throw new UnauthorizedException('Not an admin refresh token');
    }
    if (!payload.sid) {
      // 마이그레이션 이전 발급된 토큰은 sid 없음 — 강제 로그아웃 (revocation 가능
      // 인프라로 일관성 확보). natural expiry는 14d, GA 직전 cutover 시점 매끄러움.
      throw new UnauthorizedException('Legacy admin refresh token without sid');
    }
    return { sub: payload.sub, role: payload.role, sid: payload.sid };
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
