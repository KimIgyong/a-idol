import { createIntegrationApp, signupUser, type IntegrationApp } from './helpers/app-harness';

/**
 * Heart / Follow idempotence + listings. The server-side contract is that
 * toggles are state-target (POST = ensure-on, DELETE = ensure-off) rather
 * than increment-decrement, so double-POST or double-DELETE must not move
 * the count. Integration-level because the race-safety comes from a
 * Prisma upsert + unique constraint, not from application code.
 */
describe('ITC-FANDOM — heart + follow idempotence + listings', () => {
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

  it('TC-FAND-001 — POST /heart flips hearted:true; second POST is idempotent (same count)', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      const first = await env.http
        .post(`/api/v1/idols/${idolId}/heart`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(first.body).toMatchObject({ idolId, hearted: true });
      const afterFirst = first.body.heartCount as number;
      expect(afterFirst).toBeGreaterThan(0);

      const second = await env.http
        .post(`/api/v1/idols/${idolId}/heart`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(second.body.hearted).toBe(true);
      // Server is state-target, not increment — double POST must not bump count.
      expect(second.body.heartCount).toBe(afterFirst);
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-FAND-002 — DELETE /heart flips off; second DELETE idempotent', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      // Start from hearted state
      const on = await env.http
        .post(`/api/v1/idols/${idolId}/heart`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const beforeCount = on.body.heartCount as number;

      const off = await env.http
        .delete(`/api/v1/idols/${idolId}/heart`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(off.body.hearted).toBe(false);
      expect(off.body.heartCount).toBe(beforeCount - 1);

      const offAgain = await env.http
        .delete(`/api/v1/idols/${idolId}/heart`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(offAgain.body.hearted).toBe(false);
      expect(offAgain.body.heartCount).toBe(off.body.heartCount);
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-FAND-003 — POST /follow flips following:true; second is idempotent', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      const first = await env.http
        .post(`/api/v1/idols/${idolId}/follow`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(first.body).toMatchObject({ idolId, following: true });

      const second = await env.http
        .post(`/api/v1/idols/${idolId}/follow`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(second.body.following).toBe(true);
      expect(second.body.followCount).toBe(first.body.followCount);
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-FAND-004 — /me/hearts lists hearted idols + /me/follows lists followed', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      await env.http
        .post(`/api/v1/idols/${idolId}/heart`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      await env.http
        .post(`/api/v1/idols/${idolId}/follow`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const hearts = await env.http
        .get('/api/v1/me/hearts')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const heartIds = (hearts.body.items as Array<{ id: string }>).map((i) => i.id);
      expect(heartIds).toContain(idolId);

      const follows = await env.http
        .get('/api/v1/me/follows')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const followIds = (follows.body.items as Array<{ id: string }>).map((i) => i.id);
      expect(followIds).toContain(idolId);
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-FAND-005 — toggle endpoints require auth (401 on missing token)', async () => {
    await env.http.post(`/api/v1/idols/${idolId}/heart`).expect(401);
    await env.http.post(`/api/v1/idols/${idolId}/follow`).expect(401);
    await env.http.get('/api/v1/me/hearts').expect(401);
  });
});
