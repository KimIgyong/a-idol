import { createIntegrationApp, signupUser, type IntegrationApp } from './helpers/app-harness';

/**
 * PATCH /api/v1/me — 자기 자신의 프로필/동의 필드 업데이트.
 * RPT-260426-C P1 SCR-004(가입 직후 추가 정보) + 설정 화면 의존.
 */
describe('ITC-ME-PATCH — self update via PATCH /me', () => {
  let env: IntegrationApp;

  beforeAll(async () => {
    env = await createIntegrationApp();
  });
  afterAll(async () => {
    await env.close();
  });

  it('TC-ME-001 — avatarUrl + marketingOptIn + pushOptIn 동시 업데이트', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      const res = await env.http
        .patch('/api/v1/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          avatar_url: 'https://cdn.a-idol.dev/u/abc.jpg',
          marketing_opt_in: true,
          push_opt_in: false,
        })
        .expect(200);

      expect(res.body).toMatchObject({
        avatarUrl: 'https://cdn.a-idol.dev/u/abc.jpg',
        marketingOptIn: true,
        pushOptIn: false,
      });
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-ME-002 — 부분 업데이트(보낸 필드만 변경)', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      // 가입 직후 default: marketingOptIn=false, pushOptIn=true
      const before = await env.http
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(before.body.marketingOptIn).toBe(false);
      expect(before.body.pushOptIn).toBe(true);

      // marketingOptIn만 변경
      const after = await env.http
        .patch('/api/v1/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ marketing_opt_in: true })
        .expect(200);
      expect(after.body.marketingOptIn).toBe(true);
      expect(after.body.pushOptIn).toBe(true); // 그대로
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-ME-003 — avatarUrl=null 명시적 제거', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      // 일단 설정
      await env.http
        .patch('/api/v1/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ avatar_url: 'https://x.com/a.jpg' })
        .expect(200);

      // null로 제거
      const cleared = await env.http
        .patch('/api/v1/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ avatar_url: null })
        .expect(200);
      expect(cleared.body.avatarUrl).toBeNull();
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-ME-004 — 미인증 시 401', async () => {
    await env.http
      .patch('/api/v1/me')
      .send({ marketing_opt_in: true })
      .expect(401);
  });

  it('TC-ME-005 — nickname / email 변경 시도는 무시 (DTO whitelist)', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      // ValidationPipe `forbidNonWhitelisted: true` 라 알 수 없는 필드는
      // 422로 거부되거나(현재 backend 설정) 그냥 무시됨. 어느 쪽이든 nickname은
      // 변경되지 않아야 함.
      const before = await env.http
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const originalNickname = before.body.nickname;

      // forbidden field — Nest ValidationPipe `forbidNonWhitelisted: true`가
      // 4xx로 거부 (정확한 status는 ValidationPipe 옵션에 따라 400 또는 422).
      await env.http
        .patch('/api/v1/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ nickname: 'evilHacker', marketing_opt_in: true })
        .expect((r) => {
          if (r.status < 400 || r.status >= 500) {
            throw new Error(`expected 4xx for forbidden field, got ${r.status}`);
          }
        });

      const after = await env.http
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(after.body.nickname).toBe(originalNickname);
    } finally {
      await env.resetUser(userId);
    }
  });
});
