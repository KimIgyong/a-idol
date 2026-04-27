import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { AppConfig } from '../../../config/config.schema';
import type { TokenService } from '../application/interfaces';

@Injectable()
export class JwtTokenService implements TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly cfg: AppConfig,
  ) {}

  signAccess(input: { sub: string }): Promise<string> {
    return this.jwt.signAsync(
      { sub: input.sub, type: 'access' },
      { secret: this.cfg.jwtAccessSecret, expiresIn: this.cfg.jwtAccessExpiresIn },
    );
  }

  signRefresh(input: { sub: string; sid: string }): Promise<string> {
    return this.jwt.signAsync(
      { sub: input.sub, sid: input.sid, type: 'refresh' },
      { secret: this.cfg.jwtRefreshSecret, expiresIn: this.cfg.jwtRefreshExpiresIn },
    );
  }

  async verifyAccess(token: string): Promise<{ sub: string }> {
    const payload = await this.jwt.verifyAsync<{ sub: string; type: string }>(token, {
      secret: this.cfg.jwtAccessSecret,
    });
    if (payload.type !== 'access') throw new Error('Not an access token');
    return { sub: payload.sub };
  }

  async verifyRefresh(token: string): Promise<{ sub: string; sid: string }> {
    const payload = await this.jwt.verifyAsync<{ sub: string; sid: string; type: string }>(token, {
      secret: this.cfg.jwtRefreshSecret,
    });
    if (payload.type !== 'refresh') throw new Error('Not a refresh token');
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
