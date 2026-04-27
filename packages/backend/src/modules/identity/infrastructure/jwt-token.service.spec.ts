import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtTokenService } from './jwt-token.service';
import type { AppConfig } from '../../../config/config.schema';

// Minimal AppConfig stub — only the JWT-related fields JwtTokenService reads.
function makeConfig(): AppConfig {
  return {
    jwtAccessSecret: 'unit-test-access-secret-1234567890',
    jwtAccessExpiresIn: '15m',
    jwtRefreshSecret: 'unit-test-refresh-secret-1234567890',
    jwtRefreshExpiresIn: '14d',
  } as unknown as AppConfig;
}

describe('JwtTokenService', () => {
  let jwt: JwtService;
  let cfg: AppConfig;
  let svc: JwtTokenService;

  beforeEach(() => {
    jwt = new JwtService({});
    cfg = makeConfig();
    svc = new JwtTokenService(jwt, cfg);
  });

  it('TC-JWT-001 — verifyAccess returns {sub} for a freshly signed access token', async () => {
    const token = await svc.signAccess({ sub: 'user-1' });
    await expect(svc.verifyAccess(token)).resolves.toEqual({ sub: 'user-1' });
  });

  it('TC-JWT-002 — verifyAccess throws UnauthorizedException when payload.type is not "access"', async () => {
    // Forge a token with the same secret but `type: 'admin-access'` — the
    // exact payload shape an admin token carries. The user guard must
    // reject with 401, not 500 (regression: token-shape fingerprinting).
    const forged = await jwt.signAsync(
      { sub: 'u-1', type: 'admin-access' },
      { secret: cfg.jwtAccessSecret, expiresIn: '15m' },
    );
    await expect(svc.verifyAccess(forged)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('TC-JWT-003 — verifyRefresh returns {sub, sid} for a freshly signed refresh token', async () => {
    const token = await svc.signRefresh({ sub: 'user-1', sid: 'sess-a' });
    await expect(svc.verifyRefresh(token)).resolves.toEqual({
      sub: 'user-1',
      sid: 'sess-a',
    });
  });

  it('TC-JWT-004 — verifyRefresh throws UnauthorizedException when payload.type is not "refresh"', async () => {
    const forged = await jwt.signAsync(
      { sub: 'u-1', sid: 's-1', type: 'access' },
      { secret: cfg.jwtRefreshSecret, expiresIn: '15m' },
    );
    await expect(svc.verifyRefresh(forged)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
