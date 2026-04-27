import { createIntegrationApp, signupUser, type IntegrationApp } from './helpers/app-harness';

/**
 * ETag / 304 flow on /api/v1/idols. Verifies that:
 *  (1) first GET returns 200 + ETag header
 *  (2) a subsequent request with If-None-Match == ETag returns 304 with no body
 *  (3) after mutating the dataset (heart toggle bumps Idol.updatedAt), the
 *      same If-None-Match no longer matches — full 200 + new ETag
 * The weak ETag is composed of `total + max(updatedAt) + page/size/sort`
 * so any row update invalidates every page of the list.
 */
describe('ITC-CATALOG — /idols ETag / 304 conditional GET', () => {
  let env: IntegrationApp;

  beforeAll(async () => {
    env = await createIntegrationApp();
  });
  afterAll(async () => {
    await env.close();
  });

  it('TC-CAT-001 — first GET /api/v1/idols returns 200 with ETag header', async () => {
    const res = await env.http.get('/api/v1/idols?size=20').expect(200);
    expect(res.headers['etag']).toMatch(/^W\/"idols-\d+-\d+-p1-s20-popularity"$/);
    expect(res.body.items).toBeDefined();
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('TC-CAT-002 — If-None-Match matching ETag returns 304 with empty body', async () => {
    const first = await env.http.get('/api/v1/idols?size=20').expect(200);
    const etag = first.headers['etag'] as string;

    const second = await env.http
      .get('/api/v1/idols?size=20')
      .set('If-None-Match', etag)
      .expect(304);
    // 304 must not carry a body — client reuses the cached one.
    expect(second.text).toBe('');
    expect(second.headers['etag']).toBe(etag);
  });

  it('TC-CAT-003 — heart toggle bumps Idol.updatedAt → same If-None-Match no longer matches', async () => {
    const first = await env.http.get('/api/v1/idols?size=20').expect(200);
    const oldEtag = first.headers['etag'] as string;
    const idolId = first.body.items[0].id as string;

    // Mutate: a heart toggle updates Idol.heartCount which bumps @updatedAt.
    const { accessToken } = await signupUser(env.http);
    await env.http
      .post(`/api/v1/idols/${idolId}/heart`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const third = await env.http
      .get('/api/v1/idols?size=20')
      .set('If-None-Match', oldEtag)
      .expect(200);
    const newEtag = third.headers['etag'] as string;
    expect(newEtag).not.toBe(oldEtag);
    expect(third.body.items).toBeDefined();
  });

  it('TC-CAT-004 — ETag varies by page so a stray token from p1 cannot short-circuit p2', async () => {
    const page1 = await env.http.get('/api/v1/idols?size=20&page=1').expect(200);
    const page2 = await env.http.get('/api/v1/idols?size=20&page=2').expect(200);
    expect(page1.headers['etag']).not.toBe(page2.headers['etag']);
  });
});
