import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminJwtTokenService } from './admin-jwt-token.service';
import type { AppConfig } from '../../../config/config.schema';

function makeConfig(): AppConfig {
  return {
    jwtAccessSecret: 'unit-test-access-secret-1234567890',
    jwtAccessExpiresIn: '15m',
    jwtRefreshSecret: 'unit-test-refresh-secret-1234567890',
    jwtRefreshExpiresIn: '14d',
  } as unknown as AppConfig;
}

describe('AdminJwtTokenService', () => {
  let jwt: JwtService;
  let cfg: AppConfig;
  let svc: AdminJwtTokenService;

  beforeEach(() => {
    jwt = new JwtService({});
    cfg = makeConfig();
    svc = new AdminJwtTokenService(jwt, cfg);
  });

  it('TC-ADMJWT-001 — verifyAccess returns {sub, role} for a freshly signed admin access token', async () => {
    const token = await svc.signAccess({ sub: 'admin-1', role: 'admin' });
    await expect(svc.verifyAccess(token)).resolves.toEqual({
      sub: 'admin-1',
      role: 'admin',
    });
  });

  it('TC-ADMJWT-002 — verifyAccess rejects a user-type token (admin↔user cross-use blocked as 401)', async () => {
    // User tokens share the secret but carry `type: 'access'` — the admin
    // guard must reject with 401, not 500.
    const forged = await jwt.signAsync(
      { sub: 'u-1', type: 'access' },
      { secret: cfg.jwtAccessSecret, expiresIn: '15m' },
    );
    await expect(svc.verifyAccess(forged)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('TC-ADMJWT-003 — verifyRefresh returns {sub, role, sid} for a freshly signed admin refresh token', async () => {
    const token = await svc.signRefresh({ sub: 'admin-1', role: 'operator', sid: 'sess-1' });
    await expect(svc.verifyRefresh(token)).resolves.toEqual({
      sub: 'admin-1',
      role: 'operator',
      sid: 'sess-1',
    });
  });

  it('TC-ADMJWT-004 — verifyRefresh rejects a user-type refresh as UnauthorizedException', async () => {
    const forged = await jwt.signAsync(
      { sub: 'u-1', sid: 's-1', type: 'refresh' },
      { secret: cfg.jwtRefreshSecret, expiresIn: '14d' },
    );
    await expect(svc.verifyRefresh(forged)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
