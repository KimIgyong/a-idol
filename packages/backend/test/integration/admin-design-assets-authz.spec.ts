import { createIntegrationApp, signupUser, type IntegrationApp } from './helpers/app-harness';
import { adminLogin, operatorLogin } from './helpers/audition-fixtures';

/**
 * ITC-ADMIN-DESIGN-ASSETS-AUTHZ — T-085 후속.
 *
 *  - 인증 없는 호출 → 401
 *  - 일반 user JWT → 401 (admin guard 가 user 토큰 거부)
 *  - operator role → read 200 / write 403 (admin/operator read, admin-only write)
 *  - admin role → read/write 모두 200/201/204
 */
describe('ITC-ADMIN-DESIGN-ASSETS-AUTHZ — admin design-assets endpoints', () => {
  let env: IntegrationApp;

  beforeAll(async () => {
    env = await createIntegrationApp();
  });
  afterAll(async () => {
    await env.close();
  });

  it('TC-DA-ADMZ-001 — 인증 없으면 401 (GET / POST / PATCH / DELETE)', async () => {
    await env.http.get('/api/v1/admin/design-assets').expect(401);
    await env.http.post('/api/v1/admin/design-assets').send({}).expect(401);
    await env.http
      .patch('/api/v1/admin/design-assets/00000000-0000-0000-0000-000000000001')
      .send({})
      .expect(401);
    await env.http
      .delete('/api/v1/admin/design-assets/00000000-0000-0000-0000-000000000001')
      .expect(401);
  });

  it('TC-DA-ADMZ-002 — 일반 user JWT 거부 (admin guard 가 user 토큰 401)', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      await env.http
        .get('/api/v1/admin/design-assets')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-DA-ADMZ-003 — admin: read + write 모두 허용', async () => {
    const adminToken = await adminLogin(env.http);

    // Read
    const list = await env.http
      .get('/api/v1/admin/design-assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(list.body)).toBe(true);

    // Create
    const created = await env.http
      .post('/api/v1/admin/design-assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'authz-test-asset',
        type: 'OTHER',
        platform: 'ALL',
        status: 'PLACEHOLDER',
        order_index: 999,
      })
      .expect(201);
    const id = created.body.id as string;

    // Update
    await env.http
      .patch(`/api/v1/admin/design-assets/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DRAFT' })
      .expect(200);

    // Delete
    await env.http
      .delete(`/api/v1/admin/design-assets/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
  });

  it('TC-DA-ADMZ-004 — operator: read 200 / write(POST/PATCH/DELETE) 403', async () => {
    const opToken = await operatorLogin(env);

    // Read 허용
    await env.http
      .get('/api/v1/admin/design-assets')
      .set('Authorization', `Bearer ${opToken}`)
      .expect(200);

    // Write 거부 — RolesGuard 가 admin role 만 허용
    await env.http
      .post('/api/v1/admin/design-assets')
      .set('Authorization', `Bearer ${opToken}`)
      .send({ name: 'op-write-blocked', type: 'OTHER' })
      .expect(403);

    // 시드된 첫 design asset id 가져와서 PATCH/DELETE 시도
    const adminToken = await adminLogin(env.http);
    const list = await env.http
      .get('/api/v1/admin/design-assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const targetId: string | undefined = list.body[0]?.id;
    if (!targetId) {
      // seed 가 없는 환경 — operator write 거부만 검증하고 종료
      return;
    }

    await env.http
      .patch(`/api/v1/admin/design-assets/${targetId}`)
      .set('Authorization', `Bearer ${opToken}`)
      .send({ status: 'DRAFT' })
      .expect(403);

    await env.http
      .delete(`/api/v1/admin/design-assets/${targetId}`)
      .set('Authorization', `Bearer ${opToken}`)
      .expect(403);
  });
});
