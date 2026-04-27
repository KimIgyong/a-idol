import { createIntegrationApp, signupUser, type IntegrationApp } from './helpers/app-harness';
import { adminLogin, setupActiveRound } from './helpers/audition-fixtures';

/**
 * End-to-end exercise of the audition lifecycle — the one flow where
 * event-driven coupling between modules (round → vote snapshot) is hardest
 * to verify in unit tests. Catches regressions in `round.closed` →
 * `SnapshotRankingUseCase` wiring (ADR-014 slice 1).
 */
describe('ITC-AUDITION — round close → snapshot → rejects further votes', () => {
  let env: IntegrationApp;
  let adminToken: string;

  beforeAll(async () => {
    env = await createIntegrationApp();
    adminToken = await adminLogin(env.http);
  });
  afterAll(async () => {
    await env.close();
  });

  it('TC-AUD-001 — cast HEART → close round → snapshot row written + new votes rejected', async () => {
    const { roundId, idolId } = await setupActiveRound(env, adminToken, {
      labelPrefix: 'ITC-aud-close',
    });
    const { userId, accessToken } = await signupUser(env.http);
    try {
      // cast 2 hearts so the leaderboard has a known score
      for (let i = 0; i < 2; i++) {
        await env.http
          .post(`/api/v1/rounds/${roundId}/votes`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ idol_id: idolId, method: 'HEART' })
          .expect(200);
      }

      const before = await env.http.get(`/api/v1/rounds/${roundId}/leaderboard`).expect(200);
      const beforeEntry = (before.body.entries as Array<{ idolId: string; score: number }>).find(
        (e) => e.idolId === idolId,
      );
      expect(beforeEntry?.score).toBe(2);

      // Close the round — this emits `round.closed` → RoundClosedListener →
      // SnapshotRankingUseCase, which writes a RoundRankingSnapshot row.
      await env.http
        .post(`/api/v1/admin/auditions/rounds/${roundId}/close`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Give the event emitter a tick — listener fires synchronously in
      // our setup, but the DB write is awaited. 200ms is ample.
      await new Promise((r) => setTimeout(r, 200));

      const snapshots = await env.prisma.roundRankingSnapshot.findMany({
        where: { roundId },
        orderBy: { snapshotAt: 'desc' },
      });
      // Exactly one close-time snapshot from the listener. The 5-min cron
      // could also have run in a long test — assert at least one row and
      // at least one matching the idol with score 2.
      expect(snapshots.length).toBeGreaterThanOrEqual(1);
      const targetSnapshot = snapshots.find((s) => s.idolId === idolId);
      expect(targetSnapshot).toBeDefined();
      expect(Number(targetSnapshot!.score)).toBe(2);

      // A vote against a CLOSED round is rejected with VOTE_ROUND_NOT_ACTIVE.
      const reject = await env.http
        .post(`/api/v1/rounds/${roundId}/votes`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ idol_id: idolId, method: 'HEART' })
        .expect(403);
      expect(reject.body).toMatchObject({ code: 'VOTE_ROUND_NOT_ACTIVE' });
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-AUD-002 — round vote-rule with ticketWeight=0 → TICKET vote forbidden even with wallet', async () => {
    // Fresh audition with ticketWeight=0 baked in at setup. Admin controller
    // rejects vote-rule edits on ACTIVE rounds (409), so we set the rule
    // BEFORE activation via the helper option. This isolates "rule gate
    // rejects before wallet consume" from "wallet gate empty".
    const { roundId, idolId } = await setupActiveRound(env, adminToken, {
      labelPrefix: 'ITC-aud-tw0',
      voteRule: { heartWeight: 1, smsWeight: 0, ticketWeight: 0, dailyHeartLimit: 5 },
    });

    const { userId, accessToken } = await signupUser(env.http);
    try {
      // Buy tickets so the "wallet empty" path is NOT what trips the test.
      const products = await env.http.get('/api/v1/commerce/products').expect(200);
      const ticketProduct = (products.body as Array<{ id: string; sku: string }>).find(
        (p) => p.sku === 'vote-ticket-10',
      )!;
      await env.http
        .post('/api/v1/commerce/purchases')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ product_id: ticketProduct.id })
        .expect(200);

      const res = await env.http
        .post(`/api/v1/rounds/${roundId}/votes`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ idol_id: idolId, method: 'TICKET' })
        .expect(403);
      expect(res.body).toMatchObject({ code: 'VOTE_METHOD_NOT_ALLOWED' });

      // And the wallet should be untouched — ticket gate rejected before
      // consume.
      const wallet = await env.http
        .get('/api/v1/me/vote-tickets')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(wallet.body.balance).toBe(10);
    } finally {
      await env.resetUser(userId);
      // Close the round so subsequent test runs don't leave dozens of
      // ACTIVE rounds polluting the leaderboard-audit cron log.
      await env.http
        .post(`/api/v1/admin/auditions/rounds/${roundId}/close`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
  });
});
