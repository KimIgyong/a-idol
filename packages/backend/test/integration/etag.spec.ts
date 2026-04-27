import { createIntegrationApp, signupUser, type IntegrationApp } from './helpers/app-harness';
import { adminLogin, setupActiveRound } from './helpers/audition-fixtures';

/**
 * ETag / 304 on /api/v1/commerce/products (list) and /api/v1/auditions/:id (detail) —
 * mirrors the /api/v1/idols pattern. Both endpoints have low churn in production
 * (catalog edits + audition transitions are infrequent), so hit ratios are
 * expected to be high. We verify 200/304 round-trips + invalidation on
 * admin mutation for each.
 */
describe('ITC-ETAG — /commerce/products and /auditions/:id conditional GET', () => {
  let env: IntegrationApp;

  beforeAll(async () => {
    env = await createIntegrationApp();
  });
  afterAll(async () => {
    await env.close();
  });

  describe('/api/v1/commerce/products', () => {
    it('TC-ETAG-PROD-001 — first GET returns 200 with products-shaped ETag', async () => {
      const res = await env.http.get('/api/v1/commerce/products').expect(200);
      expect(res.headers['etag']).toMatch(/^W\/"products-\d+-\d+-a1"$/);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('TC-ETAG-PROD-002 — If-None-Match matching ETag returns 304 with empty body', async () => {
      const first = await env.http.get('/api/v1/commerce/products').expect(200);
      const etag = first.headers['etag'] as string;

      const second = await env.http
        .get('/api/v1/commerce/products')
        .set('If-None-Match', etag)
        .expect(304);
      expect(second.text).toBe('');
      expect(second.headers['etag']).toBe(etag);
    });

    it('TC-ETAG-PROD-003 — admin PATCH on a product bumps updatedAt → old ETag misses', async () => {
      const adminToken = await adminLogin(env.http);
      const first = await env.http.get('/api/v1/commerce/products').expect(200);
      const oldEtag = first.headers['etag'] as string;
      const productId = (first.body as Array<{ id: string; title: string }>)[0].id;
      const originalTitle = (first.body as Array<{ id: string; title: string }>)[0].title;

      try {
        await env.http
          .patch(`/api/v1/admin/commerce/products/${productId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: `ETAG-TEST-${Date.now().toString(36)}` })
          .expect(200);

        const after = await env.http
          .get('/api/v1/commerce/products')
          .set('If-None-Match', oldEtag)
          .expect(200);
        expect(after.headers['etag']).not.toBe(oldEtag);
      } finally {
        // Restore title so downstream tests see the original value.
        await env.http
          .patch(`/api/v1/admin/commerce/products/${productId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: originalTitle })
          .expect(200);
      }
    });
  });

  describe('/api/v1/auditions/:id', () => {
    let auditionId: string;

    beforeAll(async () => {
      // Reuse the shared round-setup helper — produces an active audition
      // with a round + entry we can drive ETag assertions against.
      const adminToken = await adminLogin(env.http);
      const setup = await setupActiveRound(env, adminToken, { labelPrefix: 'ITC-etag' });
      auditionId = setup.auditionId;
    });

    it('TC-ETAG-AUD-001 — first GET returns 200 with audition-shaped ETag', async () => {
      const res = await env.http.get(`/api/v1/auditions/${auditionId}`).expect(200);
      expect(res.headers['etag']).toMatch(/^W\/"audition-[0-9a-f-]+-\d+-r\d+-e\d+"$/);
      expect(res.body.id).toBe(auditionId);
    });

    it('TC-ETAG-AUD-002 — If-None-Match returns 304 with empty body', async () => {
      const first = await env.http.get(`/api/v1/auditions/${auditionId}`).expect(200);
      const etag = first.headers['etag'] as string;

      const second = await env.http
        .get(`/api/v1/auditions/${auditionId}`)
        .set('If-None-Match', etag)
        .expect(304);
      expect(second.text).toBe('');
      expect(second.headers['etag']).toBe(etag);
    });

    it('TC-ETAG-AUD-003 — different audition id yields a different ETag (cannot cross-match)', async () => {
      // Second setup for a distinct audition id.
      const adminToken = await adminLogin(env.http);
      const other = await setupActiveRound(env, adminToken, { labelPrefix: 'ITC-etag-other' });

      const a = await env.http.get(`/api/v1/auditions/${auditionId}`).expect(200);
      const b = await env.http.get(`/api/v1/auditions/${other.auditionId}`).expect(200);
      expect(a.headers['etag']).not.toBe(b.headers['etag']);
    });

    it('TC-ETAG-AUD-004 — creating a NEW round on the audition invalidates its detail ETag (write-through)', async () => {
      const adminToken = await adminLogin(env.http);
      const first = await env.http.get(`/api/v1/auditions/${auditionId}`).expect(200);
      const oldEtag = first.headers['etag'] as string;

      // New SCHEDULED round — does not change audition.status itself, so the
      // only way the ETag changes is via the touchUpdatedAt hook in
      // CreateRoundUseCase. This catches regressions of that hook.
      const start = new Date(Date.now() + 86_400_000).toISOString();
      const end = new Date(Date.now() + 2 * 86_400_000).toISOString();
      await env.http
        .post(`/api/v1/admin/auditions/${auditionId}/rounds`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'R-etag-check', orderIndex: 99, startAt: start, endAt: end })
        .expect(201);

      const after = await env.http
        .get(`/api/v1/auditions/${auditionId}`)
        .set('If-None-Match', oldEtag)
        .expect(200);
      expect(after.headers['etag']).not.toBe(oldEtag);
    });
  });

  describe('/api/v1/idols/:id (public detail)', () => {
    let idolId: string;

    beforeAll(async () => {
      const idols = await env.http.get('/api/v1/idols?size=1').expect(200);
      idolId = idols.body.items[0].id as string;
    });

    it('TC-ETAG-DETAIL-001 — first GET returns 200 with idol-shaped ETag', async () => {
      const res = await env.http.get(`/api/v1/idols/${idolId}`).expect(200);
      expect(res.headers['etag']).toMatch(/^W\/"idol-[0-9a-f-]+-\d+-i\d+"$/);
      expect(res.body.id).toBe(idolId);
    });

    it('TC-ETAG-DETAIL-002 — If-None-Match returns 304 with empty body', async () => {
      const first = await env.http.get(`/api/v1/idols/${idolId}`).expect(200);
      const etag = first.headers['etag'] as string;
      const second = await env.http
        .get(`/api/v1/idols/${idolId}`)
        .set('If-None-Match', etag)
        .expect(304);
      expect(second.text).toBe('');
    });

    it('TC-ETAG-DETAIL-003 — heart toggle bumps idol.updatedAt → new ETag', async () => {
      const first = await env.http.get(`/api/v1/idols/${idolId}`).expect(200);
      const oldEtag = first.headers['etag'] as string;
      const { accessToken } = await signupUser(env.http);
      await env.http
        .post(`/api/v1/idols/${idolId}/heart`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const after = await env.http
        .get(`/api/v1/idols/${idolId}`)
        .set('If-None-Match', oldEtag)
        .expect(200);
      expect(after.headers['etag']).not.toBe(oldEtag);
    });
  });

  describe('/api/v1/me/hearts + /api/v1/me/follows (authenticated lists)', () => {
    it('TC-ETAG-ME-001 — /me/hearts returns Vary: Authorization + me-hearts ETag embedding userId', async () => {
      const { userId, accessToken } = await signupUser(env.http);
      const res = await env.http
        .get('/api/v1/me/hearts?size=20')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.headers['vary']).toContain('Authorization');
      expect(res.headers['etag']).toBeDefined();
      // userId must appear in the tag so a stray cache can't cross-match.
      expect(res.headers['etag']).toContain(userId);
      await env.resetUser(userId);
    });

    it('TC-ETAG-ME-002 — same user hits 304 on second call; a heart toggle invalidates', async () => {
      const { userId, accessToken } = await signupUser(env.http);
      try {
        const first = await env.http
          .get('/api/v1/me/hearts?size=20')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);
        const etag = first.headers['etag'] as string;

        const second = await env.http
          .get('/api/v1/me/hearts?size=20')
          .set('Authorization', `Bearer ${accessToken}`)
          .set('If-None-Match', etag)
          .expect(304);
        expect(second.text).toBe('');

        // Toggle a heart → user's maxCreatedAt changes → old ETag misses.
        const idols = await env.http.get('/api/v1/idols?size=1').expect(200);
        const idolId = idols.body.items[0].id as string;
        await env.http
          .post(`/api/v1/idols/${idolId}/heart`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        const after = await env.http
          .get('/api/v1/me/hearts?size=20')
          .set('Authorization', `Bearer ${accessToken}`)
          .set('If-None-Match', etag)
          .expect(200);
        expect(after.headers['etag']).not.toBe(etag);
      } finally {
        await env.resetUser(userId);
      }
    });

    it('TC-ETAG-ME-003 — different user → different ETag (userId segment differs)', async () => {
      const a = await signupUser(env.http);
      const b = await signupUser(env.http);
      try {
        const resA = await env.http
          .get('/api/v1/me/hearts?size=20')
          .set('Authorization', `Bearer ${a.accessToken}`)
          .expect(200);
        const resB = await env.http
          .get('/api/v1/me/hearts?size=20')
          .set('Authorization', `Bearer ${b.accessToken}`)
          .expect(200);
        expect(resA.headers['etag']).not.toBe(resB.headers['etag']);
        // A's ETag must not short-circuit B's request.
        const cross = await env.http
          .get('/api/v1/me/hearts?size=20')
          .set('Authorization', `Bearer ${b.accessToken}`)
          .set('If-None-Match', resA.headers['etag'])
          .expect(200);
        expect(cross.body.items).toBeDefined();
      } finally {
        await env.resetUser(a.userId);
        await env.resetUser(b.userId);
      }
    });

    it('TC-ETAG-ME-004 — /me/follows mirrors the /me/hearts pattern', async () => {
      const { userId, accessToken } = await signupUser(env.http);
      try {
        const res = await env.http
          .get('/api/v1/me/follows?size=20')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);
        expect(res.headers['etag']).toMatch(/^W\/"me-follows-[0-9a-f-]+-\d+-\d+-p1-s20"$/);
        expect(res.headers['vary']).toContain('Authorization');
      } finally {
        await env.resetUser(userId);
      }
    });
  });

  describe('/api/v1/admin/catalog/idols (admin list)', () => {
    it('TC-ETAG-ADMIN-001 — authenticated GET returns admin-idols-shaped ETag', async () => {
      const adminToken = await adminLogin(env.http);
      const res = await env.http
        .get('/api/v1/admin/catalog/idols?size=20')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.headers['etag']).toMatch(/^W\/"admin-idols-\d+-\d+-p1-s20-d0"$/);
      expect(res.body.items).toBeDefined();
    });

    it('TC-ETAG-ADMIN-002 — If-None-Match returns 304 with empty body', async () => {
      const adminToken = await adminLogin(env.http);
      const first = await env.http
        .get('/api/v1/admin/catalog/idols?size=20')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const etag = first.headers['etag'] as string;

      const second = await env.http
        .get('/api/v1/admin/catalog/idols?size=20')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('If-None-Match', etag)
        .expect(304);
      expect(second.text).toBe('');
    });

    it('TC-ETAG-ADMIN-003 — admin PATCH invalidates (updatedAt bumps → new ETag)', async () => {
      const adminToken = await adminLogin(env.http);
      const first = await env.http
        .get('/api/v1/admin/catalog/idols?size=20')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const oldEtag = first.headers['etag'] as string;
      const idolId = first.body.items[0].id as string;
      const originalBio = first.body.items[0].bio as string | null;

      try {
        await env.http
          .patch(`/api/v1/admin/catalog/idols/${idolId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ bio: `etag-invalidate-${Date.now().toString(36)}` })
          .expect(200);

        const after = await env.http
          .get('/api/v1/admin/catalog/idols?size=20')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('If-None-Match', oldEtag)
          .expect(200);
        expect(after.headers['etag']).not.toBe(oldEtag);
      } finally {
        await env.http
          .patch(`/api/v1/admin/catalog/idols/${idolId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ bio: originalBio })
          .expect(200);
      }
    });
  });
});
