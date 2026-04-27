import { createIntegrationApp, signupUser, type IntegrationApp } from './helpers/app-harness';

/**
 * 응원댓글 API — RPT-260426-C P2 SCR-006.
 */
describe('ITC-CHEER — 응원댓글 작성 + 목록', () => {
  let env: IntegrationApp;
  let idolId: string;

  beforeAll(async () => {
    env = await createIntegrationApp();
    const idols = await env.http.get('/api/v1/idols?size=1').expect(200);
    idolId = idols.body.items[0].id as string;
  });
  afterAll(async () => {
    await env.close();
  });

  it('TC-CHEER-001 — 인증된 사용자가 응원댓글 작성 (201) + author hydrate', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      const res = await env.http
        .post(`/api/v1/idols/${idolId}/cheers`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ message: '오늘 무대 최고였어요!' })
        .expect(201);

      expect(res.body).toMatchObject({
        idolId,
        message: '오늘 무대 최고였어요!',
        author: {
          userId,
          nickname: expect.any(String),
        },
      });
      expect(res.body.id).toEqual(expect.any(String));
      expect(res.body.createdAt).toEqual(expect.any(String));
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-CHEER-002 — 미인증 시 401', async () => {
    await env.http
      .post(`/api/v1/idols/${idolId}/cheers`)
      .send({ message: '응원합니다' })
      .expect(401);
  });

  it('TC-CHEER-003 — 빈 message는 4xx (DTO MinLength 1, trim 후)', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      await env.http
        .post(`/api/v1/idols/${idolId}/cheers`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ message: '   ' })
        .expect((r) => {
          if (r.status < 400 || r.status >= 500) {
            throw new Error(`expected 4xx, got ${r.status}`);
          }
        });
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-CHEER-004 — 200자 초과 시 4xx', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      const longMessage = 'a'.repeat(201);
      await env.http
        .post(`/api/v1/idols/${idolId}/cheers`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ message: longMessage })
        .expect((r) => {
          if (r.status < 400 || r.status >= 500) {
            throw new Error(`expected 4xx, got ${r.status}`);
          }
        });
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-CHEER-005 — 미존재 idol 404', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      await env.http
        .post('/api/v1/idols/00000000-0000-0000-0000-000000000000/cheers')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ message: '응원합니다' })
        .expect(404);
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-CHEER-006 — GET 공개 + 최신순 정렬 + 페이지네이션', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      // 3 댓글 작성
      for (const msg of ['첫번째', '두번째', '세번째']) {
        await env.http
          .post(`/api/v1/idols/${idolId}/cheers`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ message: msg })
          .expect(201);
      }

      const res = await env.http
        .get(`/api/v1/idols/${idolId}/cheers?size=20`)
        .expect(200);

      expect(res.body.items.length).toBeGreaterThanOrEqual(3);
      expect(res.body.total).toBeGreaterThanOrEqual(3);
      // 최신순 — 우리 3개가 위쪽에.
      const last3 = (res.body.items as Array<{ message: string }>).slice(0, 3).map((c) => c.message);
      expect(last3).toEqual(['세번째', '두번째', '첫번째']);
    } finally {
      await env.resetUser(userId);
    }
  });
});
