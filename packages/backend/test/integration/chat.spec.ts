import { createIntegrationApp, signupUser, type IntegrationApp } from './helpers/app-harness';

/** Fan-club gate (ADR-013 era) requires membership before chat open. */
async function joinFanClub(
  env: IntegrationApp,
  accessToken: string,
  idolId: string,
): Promise<void> {
  await env.http
    .post(`/api/v1/idols/${idolId}/fan-club/join`)
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);
}

async function openRoom(
  env: IntegrationApp,
  accessToken: string,
  idolId: string,
): Promise<string> {
  const res = await env.http
    .post(`/api/v1/chat/rooms/${idolId}/open`)
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);
  return res.body.id as string;
}

describe('ITC-CHAT — open room → send → balance → quota exhaustion', () => {
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

  it('TC-CHAT-001 — open room returns a roomId; second call returns the same (idempotent)', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      await joinFanClub(env, accessToken, idolId);

      const first = await env.http
        .post(`/api/v1/chat/rooms/${idolId}/open`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(first.body.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(first.body.idolId).toBe(idolId);

      const second = await env.http
        .post(`/api/v1/chat/rooms/${idolId}/open`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(second.body.id).toBe(first.body.id);
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-CHAT-002 — open without fan-club membership → 403 CHAT_GATE_NOT_MEMBER', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      const res = await env.http
        .post(`/api/v1/chat/rooms/${idolId}/open`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
      expect(res.body).toMatchObject({ code: 'CHAT_GATE_NOT_MEMBER' });
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-CHAT-003 — send message → user + idol reply; quota incremented', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      await joinFanClub(env, accessToken, idolId);
      const roomId = await openRoom(env, accessToken, idolId);

      const send = await env.http
        .post(`/api/v1/chat/rooms/${roomId}/messages`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ content: '안녕' })
        .expect(200);
      expect(send.body.user.content).toBe('안녕');
      expect(send.body.user.senderType).toBe('user');
      expect(send.body.idol.senderType).toBe('idol');

      const bal = await env.http
        .get('/api/v1/me/chat-balance')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(bal.body.messagesToday).toBe(1);
      // Fresh user hasn't bought any coupons — default = 0.
      expect(bal.body.couponBalance).toBe(0);
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-CHAT-004 — list messages includes the sent message + the idol reply', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      await joinFanClub(env, accessToken, idolId);
      const roomId = await openRoom(env, accessToken, idolId);

      await env.http
        .post(`/api/v1/chat/rooms/${roomId}/messages`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ content: '오늘 공연 최고였어요' })
        .expect(200);

      const list = await env.http
        .get(`/api/v1/chat/rooms/${roomId}/messages`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const contents = (list.body as Array<{ content: string }>).map((m) => m.content);
      expect(contents).toContain('오늘 공연 최고였어요');
      expect(list.body.length).toBeGreaterThanOrEqual(2); // user + idol reply
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-CHAT-005 — exhaust 5 free quota + 0 coupons → 6th message returns HTTP 402 NO_COUPON', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      await joinFanClub(env, accessToken, idolId);
      const roomId = await openRoom(env, accessToken, idolId);

      // Default free daily quota is 5 (prisma/schema ChatQuota.dailyLimit=5).
      for (let i = 0; i < 5; i++) {
        await env.http
          .post(`/api/v1/chat/rooms/${roomId}/messages`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ content: `msg-${i}` })
          .expect(200);
      }

      const sixth = await env.http
        .post(`/api/v1/chat/rooms/${roomId}/messages`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ content: 'one-too-many' })
        .expect(402);
      expect(sixth.body).toMatchObject({ code: 'NO_COUPON' });

      const bal = await env.http
        .get('/api/v1/me/chat-balance')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(bal.body.messagesToday).toBe(5);
      expect(bal.body.couponBalance).toBe(0);
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-CHAT-006 — no token on chat endpoint → 401', async () => {
    await env.http.post(`/api/v1/chat/rooms/${idolId}/open`).expect(401);
  });
});
