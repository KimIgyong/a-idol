import { createIntegrationApp, type IntegrationApp } from './helpers/app-harness';

/**
 * ITC-ADMIN-AUTH — RPT-260426-D Phase D T-082.
 *
 * Admin login + refresh + throttle 검증.
 */
describe('ITC-ADMIN-AUTH — admin login + refresh + throttle', () => {
  let env: IntegrationApp;

  beforeAll(async () => {
    env = await createIntegrationApp();
  });
  afterAll(async () => {
    await env.close();
  });

  it('TC-ADMIN-AUTH-001 — admin/auth/login 정상 토큰 반환 + /admin/me 200', async () => {
    const login = await env.http
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin@a-idol.dev', password: 'admin-dev-0000' })
      .expect(200);
    expect(login.body).toMatchObject({
      user: expect.objectContaining({ role: 'admin' }),
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });
    const me = await env.http
      .get('/api/v1/admin/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(me.body.role).toBe('admin');
  });

  it('TC-ADMIN-AUTH-002 — 잘못된 비밀번호 → 401 INVALID_CREDENTIAL', async () => {
    const res = await env.http
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin@a-idol.dev', password: 'wrong-password' })
      .expect(401);
    expect(res.body).toMatchObject({ code: 'INVALID_CREDENTIAL' });
  });

  it('TC-ADMIN-AUTH-003 — refresh 후 새 access/refresh 발급, 둘이 다름 (jti)', async () => {
    const login = await env.http
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin@a-idol.dev', password: 'admin-dev-0000' })
      .expect(200);
    const refreshed = await env.http
      .post('/api/v1/admin/auth/refresh')
      .send({ refresh_token: login.body.refreshToken })
      .expect(200);
    expect(refreshed.body.accessToken).not.toBe(login.body.accessToken);
    expect(refreshed.body.refreshToken).not.toBe(login.body.refreshToken);
  });

  it('TC-ADMIN-AUTH-005 — logout 후 같은 refresh token 으로 refresh 시도 시 401', async () => {
    const login = await env.http
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin@a-idol.dev', password: 'admin-dev-0000' })
      .expect(200);
    const logout = await env.http
      .post('/api/v1/admin/auth/logout')
      .send({ refresh_token: login.body.refreshToken })
      .expect(200);
    expect(logout.body).toEqual({ revoked: true });
    const reuse = await env.http
      .post('/api/v1/admin/auth/refresh')
      .send({ refresh_token: login.body.refreshToken })
      .expect(401);
    expect(reuse.body).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  it('TC-ADMIN-AUTH-006 — bogus refresh token으로 logout은 silent 200 (idempotent)', async () => {
    const res = await env.http
      .post('/api/v1/admin/auth/logout')
      .send({ refresh_token: 'eyJhbGc.bogus.bogus' })
      .expect(200);
    expect(res.body).toEqual({ revoked: false });
  });

  it('TC-ADMIN-AUTH-007 — 회전 후 옛 refresh token reuse → 401 (hash mismatch defensive revoke)', async () => {
    const login = await env.http
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin@a-idol.dev', password: 'admin-dev-0000' })
      .expect(200);
    await env.http
      .post('/api/v1/admin/auth/refresh')
      .send({ refresh_token: login.body.refreshToken })
      .expect(200);
    // 옛 token 재사용은 hash mismatch 라 401.
    const reuse = await env.http
      .post('/api/v1/admin/auth/refresh')
      .send({ refresh_token: login.body.refreshToken })
      .expect(401);
    expect(reuse.body).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  // Throttle 검증은 마지막에 — 한 describe 안에서 throttle bucket이 유지되므로
  // 11번 시도 후 다른 login-기반 테스트는 429에 막힘.
  it('TC-ADMIN-AUTH-004 — 11번 연속 잘못된 비밀번호 → 11번째는 429 (10/min/IP throttle)', async () => {
    let last429 = false;
    for (let i = 0; i < 11; i++) {
      const res = await env.http
        .post('/api/v1/admin/auth/login')
        .send({ email: 'admin@a-idol.dev', password: 'wrong-pw' });
      if (res.status === 429) {
        last429 = true;
        break;
      }
    }
    expect(last429).toBe(true);
  });
});
