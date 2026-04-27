import { createIntegrationApp, signupUser, type IntegrationApp } from './helpers/app-harness';
import { adminLogin, operatorLogin } from './helpers/audition-fixtures';

/**
 * ITC-ADMIN-CATALOG-AUTHZ — RPT-260426-D Phase D T-084.
 *
 * `/admin/catalog/*` (idols / agencies / images / schedules) 의 RBAC 잠금:
 *  - 인증 없음 → 401
 *  - 일반 user JWT → 401 (admin guard)
 *  - operator role → read OK / write 403
 *  - admin role → 200/201/204
 */
describe('ITC-ADMIN-CATALOG-AUTHZ — admin catalog endpoints', () => {
  let env: IntegrationApp;

  beforeAll(async () => {
    env = await createIntegrationApp();
  });
  afterAll(async () => {
    await env.close();
  });

  it('TC-CATAUTHZ-001 — 인증 없이 GET /admin/catalog/idols 401', async () => {
    await env.http.get('/api/v1/admin/catalog/idols').expect(401);
  });

  it('TC-CATAUTHZ-002 — user JWT로 admin catalog 호출 시 401', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      await env.http
        .get('/api/v1/admin/catalog/idols')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-CATAUTHZ-003 — admin role: GET /admin/catalog/idols 200 + paginated shape', async () => {
    const adminToken = await adminLogin(env.http);
    const res = await env.http
      .get('/api/v1/admin/catalog/idols')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    // PaginatedResponseDto shape — items: Array, total/nextCursor 부속
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body).toHaveProperty('total');
  });

  it('TC-CATAUTHZ-004 — operator role: read + create OK (admin/operator 공통 catalog), DELETE 는 admin only(403)', async () => {
    const opToken = await operatorLogin(env);
    const adminToken = await adminLogin(env.http);
    // Read OK
    await env.http
      .get('/api/v1/admin/catalog/agencies')
      .set('Authorization', `Bearer ${opToken}`)
      .expect(200);
    // Create OK (operator 도 catalog write 가능 — 디자인)
    const created = await env.http
      .post('/api/v1/admin/catalog/agencies')
      .set('Authorization', `Bearer ${opToken}`)
      .send({ name: `it-cat-op-${Date.now()}`, description: null })
      .expect(201);
    const agencyId = created.body.id as string;
    // operator 가 DELETE 시도 → 403 (admin only override)
    await env.http
      .delete(`/api/v1/admin/catalog/agencies/${agencyId}`)
      .set('Authorization', `Bearer ${opToken}`)
      .expect(403);
    // admin 은 가능
    await env.http
      .delete(`/api/v1/admin/catalog/agencies/${agencyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
  });
});
