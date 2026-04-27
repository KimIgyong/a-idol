import { createIntegrationApp, signupUser, type IntegrationApp } from './helpers/app-harness';
import { adminLogin } from './helpers/audition-fixtures';

/**
 * ITC-IDOL-AUTHZ — RPT-260426-D Phase D T-084.
 *
 * 공개 read 경로 `/api/v1/idols/:id` 의 publishing/visibility 경계:
 *  - draft (publishedAt=null) → public 404
 *  - soft-deleted (deletedAt!=null) → public 404
 *  - 인증된 일반 사용자도 동일 (admin 가시성 분리)
 *  - admin은 별도 `/admin/catalog/idols/:id` 로 전체 가시성
 */
describe('ITC-IDOL-AUTHZ — public idol detail visibility', () => {
  let env: IntegrationApp;
  let adminToken: string;
  let agencyId: string;

  beforeAll(async () => {
    env = await createIntegrationApp();
    adminToken = await adminLogin(env.http);
    // 새 agency를 만들어 격리 (다른 테스트 간섭 방지).
    const agencyRes = await env.http
      .post('/api/v1/admin/catalog/agencies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `it-authz-agency-${Date.now()}`, description: 'authz boundary test' })
      .expect(201);
    agencyId = agencyRes.body.id as string;
  });
  afterAll(async () => {
    await env.close();
  });

  async function createDraftIdol(name: string): Promise<string> {
    const res = await env.http
      .post('/api/v1/admin/catalog/idols')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ agencyId, name })
      .expect(201);
    return res.body.id as string;
  }

  it('TC-IDOLAUTHZ-001 — draft idol (publishedAt=null) → public GET 404', async () => {
    const id = await createDraftIdol(`Draft-${Date.now()}`);
    await env.http.get(`/api/v1/idols/${id}`).expect(404);
  });

  it('TC-IDOLAUTHZ-002 — published 후 → public GET 200', async () => {
    const id = await createDraftIdol(`Pub-${Date.now()}`);
    await env.http
      .post(`/api/v1/admin/catalog/idols/${id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const res = await env.http.get(`/api/v1/idols/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('TC-IDOLAUTHZ-003 — published 후 unpublish → public GET 다시 404', async () => {
    const id = await createDraftIdol(`Unpub-${Date.now()}`);
    await env.http
      .post(`/api/v1/admin/catalog/idols/${id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    await env.http.get(`/api/v1/idols/${id}`).expect(200);
    await env.http
      .post(`/api/v1/admin/catalog/idols/${id}/unpublish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    await env.http.get(`/api/v1/idols/${id}`).expect(404);
  });

  it('TC-IDOLAUTHZ-004 — soft-deleted idol → public GET 404', async () => {
    const id = await createDraftIdol(`Del-${Date.now()}`);
    await env.http
      .post(`/api/v1/admin/catalog/idols/${id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    await env.http.get(`/api/v1/idols/${id}`).expect(200);
    const del = await env.http
      .delete(`/api/v1/admin/catalog/idols/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 204]).toContain(del.status);
    await env.http.get(`/api/v1/idols/${id}`).expect(404);
  });

  it('TC-IDOLAUTHZ-005 — 인증된 일반 사용자도 동일하게 404 (가시성은 user/anon 동일)', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      const id = await createDraftIdol(`UserView-${Date.now()}`);
      await env.http
        .get(`/api/v1/idols/${id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    } finally {
      await env.resetUser(userId);
    }
  });
});
