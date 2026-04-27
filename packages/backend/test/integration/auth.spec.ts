import { createIntegrationApp, signupUser, type IntegrationApp } from './helpers/app-harness';

describe('ITC-AUTH — signup → login → /me', () => {
  let env: IntegrationApp;

  beforeAll(async () => {
    env = await createIntegrationApp();
  });
  afterAll(async () => {
    await env.close();
  });

  it('TC-AUTH-001 — signup returns tokens + /me returns the user', async () => {
    const { accessToken, userId, email } = await signupUser(env.http);

    const me = await env.http
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(me.body).toMatchObject({
      id: userId,
      email,
      status: 'active',
    });
  });

  it('TC-AUTH-002 — /me without token returns 401', async () => {
    await env.http.get('/api/v1/me').expect(401);
  });

  it('TC-AUTH-003 — signup under 14 returns 422 UNDER_AGE', async () => {
    // Today-minus-13-years → clearly under 14
    const under = new Date();
    under.setFullYear(under.getFullYear() - 13);
    const body = {
      email: `it-young-${Date.now()}@test.a-idol.dev`,
      password: 'integration-pw-1234',
      nickname: 'tooyoung',
      birthdate: under.toISOString().slice(0, 10),
    };
    const res = await env.http.post('/api/v1/auth/signup').send(body).expect(422);
    expect(res.body).toMatchObject({ code: 'UNDER_AGE' });
  });

  it('TC-AUTH-004 — duplicate signup returns 409 EMAIL_ALREADY_EXISTS', async () => {
    const { email } = await signupUser(env.http);
    const res = await env.http
      .post('/api/v1/auth/signup')
      .send({
        email,
        password: 'another-pw',
        nickname: 'dup',
        birthdate: '2000-01-01',
      })
      .expect(409);
    expect(res.body).toMatchObject({ code: 'EMAIL_ALREADY_EXISTS' });
  });

  it('TC-AUTH-005 — refresh token rotation: 새 access/refresh 발급 + 새 access로 /me 200, 옛 refresh 무효화', async () => {
    const { refreshToken, userId } = await signupUser(env.http);
    const refreshed = await env.http
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: refreshToken })
      .expect(200);
    expect(refreshed.body).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: expect.any(Number),
    });
    // 새 access token으로 /me 정상 응답.
    const me = await env.http
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
      .expect(200);
    expect(me.body.id).toBe(userId);

    // 옛 refresh token은 hash mismatch 라 reuse-detection으로 401 (session 도
    // 방어적으로 revoke). JWT 서명은 동일 second에 같을 수 있어 token equality
    // 보다 hash mismatch 동작을 검증.
    const reuse = await env.http
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: refreshToken })
      .expect(401);
    expect(reuse.body).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  it('TC-AUTH-006 — bogus refresh token → 401 INVALID_REFRESH_TOKEN', async () => {
    const res = await env.http
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: 'eyJhbGc.bogus.bogus' })
      .expect(401);
    expect(res.body).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  it('TC-AUTH-007 — logout 후 같은 refresh token 으로 refresh 시도 시 401', async () => {
    const { refreshToken } = await signupUser(env.http);
    const logout = await env.http
      .post('/api/v1/auth/logout')
      .send({ refresh_token: refreshToken })
      .expect(200);
    expect(logout.body).toEqual({ revoked: true });

    // 같은 refresh token 재사용 시 session revoked → 401.
    const reuse = await env.http
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: refreshToken })
      .expect(401);
    expect(reuse.body).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  it('TC-AUTH-008 — bogus refresh token으로 logout은 silent 200 (idempotent)', async () => {
    const res = await env.http
      .post('/api/v1/auth/logout')
      .send({ refresh_token: 'eyJhbGc.bogus.bogus' })
      .expect(200);
    expect(res.body).toEqual({ revoked: false });
  });

  it('TC-AUTH-009 — 흔한 비밀번호(NIST blocklist)는 signup 400', async () => {
    const res = await env.http
      .post('/api/v1/auth/signup')
      .send({
        email: `weak-${Date.now()}@test.a-idol.dev`,
        password: 'password', // 정확 일치 blocklist
        nickname: 'weak',
        birthdate: '2000-01-01',
      })
      .expect(400);
    expect(JSON.stringify(res.body)).toMatch(/password/i);
  });

  it('TC-AUTH-010 — 흔한 root 포함(짧은 길이)는 signup 400', async () => {
    const res = await env.http
      .post('/api/v1/auth/signup')
      .send({
        email: `weak2-${Date.now()}@test.a-idol.dev`,
        password: 'admin12345',
        nickname: 'weak',
        birthdate: '2000-01-01',
      })
      .expect(400);
    expect(JSON.stringify(res.body)).toMatch(/password/i);
  });

  it('TC-AUTH-011 — passphrase(≥13자)는 root 포함되어도 통과', async () => {
    const res = await env.http
      .post('/api/v1/auth/signup')
      .send({
        email: `pass-${Date.now()}@test.a-idol.dev`,
        password: 'my password is long enough',
        nickname: 'pp',
        birthdate: '2000-01-01',
      })
      .expect(201);
    expect(res.body.user).toBeDefined();
  });

  it('TC-AUTH-LOCK — 10회 비번 실패 후 11번째는 423 ACCOUNT_LOCKED, 정상 비번도 잠긴 동안 423', async () => {
    const { email } = await signupUser(env.http);
    // 10회 wrong password
    for (let i = 0; i < 10; i++) {
      await env.http
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrong-password-' + i })
        .expect((r) => {
          if (r.status !== 401) throw new Error(`expected 401, got ${r.status}`);
        });
    }
    // 11번째는 잠금
    const locked = await env.http
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong-password-final' })
      .expect(423);
    expect(locked.body).toMatchObject({ code: 'ACCOUNT_LOCKED' });
    expect(locked.body.details).toMatchObject({ retryAfterSec: expect.any(Number) });
    // 정상 비번도 잠긴 동안 423
    const correct = await env.http
      .post('/api/v1/auth/login')
      .send({ email, password: 'integration-pw-1234' })
      .expect(423);
    expect(correct.body).toMatchObject({ code: 'ACCOUNT_LOCKED' });
  });

  it('TC-AUTH-UNLOCK — admin이 unlock-account 호출하면 즉시 해제 + 정상 로그인 가능', async () => {
    const { email } = await signupUser(env.http);
    for (let i = 0; i < 10; i++) {
      await env.http
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrong-' + i });
    }
    await env.http
      .post('/api/v1/auth/login')
      .send({ email, password: 'integration-pw-1234' })
      .expect(423);

    const adminLogin = await env.http
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin@a-idol.dev', password: 'admin-dev-0000' })
      .expect(200);
    const unlock = await env.http
      .post('/api/v1/admin/operators/unlock-account')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .send({ email })
      .expect(200);
    expect(unlock.body).toEqual({ unlocked: true });

    await env.http
      .post('/api/v1/auth/login')
      .send({ email, password: 'integration-pw-1234' })
      .expect(200);
  });

  it('TC-AUTH-UNLOCK-AUTHZ — user JWT 으로 unlock-account 호출 시 401', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      await env.http
        .post('/api/v1/admin/operators/unlock-account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'someone@x.com' })
        .expect(401);
    } finally {
      await env.resetUser(userId);
    }
  });
});
