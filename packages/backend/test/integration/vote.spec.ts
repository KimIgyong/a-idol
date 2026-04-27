import { createIntegrationApp, signupUser, type IntegrationApp } from './helpers/app-harness';
import { adminLogin, setupActiveRound } from './helpers/audition-fixtures';

describe('ITC-VOTE — TICKET vote flow', () => {
  let env: IntegrationApp;
  let adminToken: string;
  let roundId: string;
  let idolId: string;

  beforeAll(async () => {
    env = await createIntegrationApp();
    adminToken = await adminLogin(env.http);
    const setup = await setupActiveRound(env, adminToken, { labelPrefix: 'ITC-vote' });
    roundId = setup.roundId;
    idolId = setup.idolId;
  });
  afterAll(async () => {
    await env.close();
  });

  it('TC-VOTE-001 — empty ticket wallet → HTTP 402 NOT_ENOUGH_TICKETS', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      const res = await env.http
        .post(`/api/v1/rounds/${roundId}/votes`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ idolId, method: 'TICKET' })
        .expect(402);
      expect(res.body).toMatchObject({ code: 'NOT_ENOUGH_TICKETS' });
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-VOTE-002 — purchase ticket → cast TICKET → leaderboard reflects ticketWeight', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      const products = await env.http.get('/api/v1/commerce/products').expect(200);
      const ticketProduct = (products.body as Array<{ id: string; sku: string }>).find(
        (p) => p.sku === 'vote-ticket-10',
      );
      if (!ticketProduct) throw new Error('vote-ticket-10 missing from seed');

      await env.http
        .post('/api/v1/commerce/purchases')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId: ticketProduct.id })
        .expect(200);

      const before = await env.http
        .get('/api/v1/me/vote-tickets')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(before.body.balance).toBe(10);

      const vote = await env.http
        .post(`/api/v1/rounds/${roundId}/votes`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ idolId, method: 'TICKET' })
        .expect(200);
      expect(vote.body).toMatchObject({
        method: 'TICKET',
        weightApplied: 10,
      });

      const after = await env.http
        .get('/api/v1/me/vote-tickets')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(after.body.balance).toBe(9);

      const leaderboard = await env.http
        .get(`/api/v1/rounds/${roundId}/leaderboard`)
        .expect(200);
      const entry = (leaderboard.body.entries as Array<{ idolId: string; score: number }>).find(
        (e) => e.idolId === idolId,
      );
      expect(entry).toBeDefined();
      // The smoke round accumulates across tests — just assert the idol's
      // score is at least the ticketWeight we just applied.
      expect((entry?.score ?? 0) >= 10).toBe(true);
    } finally {
      await env.resetUser(userId);
    }
  });
});
