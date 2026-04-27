import { createIntegrationApp, signupUser, type IntegrationApp } from './helpers/app-harness';

/**
 * ITC-MYVOTES — RPT-260426-D Phase D T-084.
 *
 * `GET /api/v1/me/votes` (paginated). 정렬 (createdAt DESC), idol/round/audition
 * batch-hydrate, page=1 cursor 동작 검증.
 */
describe('ITC-MYVOTES — 내 투표 이력', () => {
  let env: IntegrationApp;
  let activeRoundId: string;
  let candidateIdolId: string;

  beforeAll(async () => {
    env = await createIntegrationApp();
    // 시드 데이터 — 임의 ACTIVE 라운드 + 후보. audition.spec.ts에서 사용하는
    // helper가 ACTIVE 만 추출.
    const auds = await env.http.get('/api/v1/auditions?status=ACTIVE').expect(200);
    for (const a of auds.body as Array<{ id: string }>) {
      const detail = await env.http.get(`/api/v1/auditions/${a.id}`).expect(200);
      const r = (detail.body.rounds as Array<{ id: string; status: string }>).find(
        (x) => x.status === 'ACTIVE',
      );
      const e = (detail.body.entries as Array<{ idolId: string; eliminatedAt: string | null }>).find(
        (x) => !x.eliminatedAt,
      );
      if (r && e) {
        activeRoundId = r.id;
        candidateIdolId = e.idolId;
        break;
      }
    }
    expect(activeRoundId).toBeTruthy();
    expect(candidateIdolId).toBeTruthy();
  });
  afterAll(async () => {
    await env.close();
  });

  it('TC-MYVOTES-001 — 인증 없으면 401', async () => {
    await env.http.get('/api/v1/me/votes').expect(401);
  });

  it('TC-MYVOTES-002 — 신규 유저는 빈 list, total=0, nextCursor=null', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      const res = await env.http
        .get('/api/v1/me/votes')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body).toEqual({ items: [], total: 0, nextCursor: null });
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-MYVOTES-003 — HEART vote 후 /me/votes 가 idol/round/audition meta 포함해 반환', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      await env.http
        .post(`/api/v1/rounds/${activeRoundId}/votes`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ idol_id: candidateIdolId, method: 'HEART' })
        .expect(200);

      const res = await env.http
        .get('/api/v1/me/votes?size=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({
        roundId: activeRoundId,
        idolId: candidateIdolId,
        method: 'HEART',
        weight: expect.any(Number),
        roundName: expect.any(String),
        auditionName: expect.any(String),
        idolName: expect.any(String),
        createdAt: expect.any(String),
      });
      expect(res.body.items[0].auditionId).toBeTruthy();
      expect(res.body.nextCursor).toBeNull();
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-MYVOTES-004 — page/size 검증: page=0 또는 size>50 은 400', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      await env.http
        .get('/api/v1/me/votes?page=0')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
      await env.http
        .get('/api/v1/me/votes?size=999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    } finally {
      await env.resetUser(userId);
    }
  });
});
