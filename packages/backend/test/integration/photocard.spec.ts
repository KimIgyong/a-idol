import type { UserPhotocardDto } from '@a-idol/shared';
import { createIntegrationApp, signupUser, type IntegrationApp } from './helpers/app-harness';

/**
 * End-to-end gacha flow: public sets listing → buy pack → grouped
 * inventory reflects the pulls. Validates T-045 fulfiller + T-046b
 * groupBy aggregation + ADR-016 `dropPercent` computation in one shot.
 */
describe('ITC-PHOTOCARD — pack purchase → grouped collection', () => {
  let env: IntegrationApp;
  let pack5ProductId: string;
  let setId: string;

  beforeAll(async () => {
    env = await createIntegrationApp();
    const products = await env.http.get('/api/v1/commerce/products').expect(200);
    const pack5 = (products.body as Array<{ id: string; sku: string; deliveryPayload: { setId: string } }>).find(
      (p) => p.sku === 'photocard-pack-5',
    );
    if (!pack5) {
      throw new Error('photocard-pack-5 missing from seed. Run `pnpm seed`.');
    }
    pack5ProductId = pack5.id;
    setId = pack5.deliveryPayload.setId;
  });
  afterAll(async () => {
    await env.close();
  });

  it('TC-PC-001 — public set detail returns templates with dropPercent summing ≈100 (ADR-016)', async () => {
    const res = await env.http.get(`/api/v1/photocards/sets/${setId}`).expect(200);
    expect(res.body.templateCount).toBeGreaterThan(0);
    const sum = (res.body.templates as Array<{ dropPercent: number; isActive: boolean }>)
      .filter((t) => t.isActive)
      .reduce((acc, t) => acc + t.dropPercent, 0);
    // Rounding drift tolerance — 99.5 to 100.5 is the expected band.
    expect(sum).toBeGreaterThan(99.5);
    expect(sum).toBeLessThan(100.5);
  });

  it('TC-PC-002 — buy pack-5 → /me/photocards returns grouped entries totaling 5', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      const before = await env.http
        .get('/api/v1/me/photocards')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(before.body).toEqual([]);

      const buy = await env.http
        .post('/api/v1/commerce/purchases')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId: pack5ProductId })
        .expect(200);
      expect(buy.body.status).toBe('FULFILLED');

      const after = await env.http
        .get('/api/v1/me/photocards')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const cards = after.body as UserPhotocardDto[];
      expect(cards.length).toBeGreaterThan(0);
      expect(cards.length).toBeLessThanOrEqual(5); // at most 5 distinct templates

      const totalCount = cards.reduce((s, c) => s + c.count, 0);
      expect(totalCount).toBe(5);

      // Every entry from this set — no leakage.
      for (const c of cards) {
        expect(c.setId).toBe(setId);
        expect(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']).toContain(c.rarity);
        expect(new Date(c.firstObtainedAt).getTime()).toBeLessThanOrEqual(
          new Date(c.lastObtainedAt).getTime(),
        );
      }
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-PC-003 — buy pack twice → duplicates collapse into count, not double rows', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      for (let i = 0; i < 2; i++) {
        await env.http
          .post('/api/v1/commerce/purchases')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ productId: pack5ProductId })
          .expect(200);
      }

      const res = await env.http
        .get('/api/v1/me/photocards')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const cards = res.body as UserPhotocardDto[];

      const totalCount = cards.reduce((s, c) => s + c.count, 0);
      expect(totalCount).toBe(10);

      // With 2 × 5 pulls from an 8-template set, duplicates are likely but
      // not guaranteed. Just assert cards.length <= 10 (grouping always
      // reduces) and that at least one entry has count >= 2 in the common
      // case — if RNG gave us all distinct we accept it too.
      expect(cards.length).toBeLessThanOrEqual(10);
      expect(cards.length).toBeLessThanOrEqual(8); // set has 8 templates
    } finally {
      await env.resetUser(userId);
    }
  });
});
