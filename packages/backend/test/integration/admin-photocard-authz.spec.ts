import { createIntegrationApp, signupUser, type IntegrationApp } from './helpers/app-harness';
import { adminLogin, operatorLogin } from './helpers/audition-fixtures';

/**
 * ITC-ADMIN-PHOTOCARD-AUTHZ — RPT-260426-D Phase D T-084.
 *
 *  - 인증 없는 호출 → 401
 *  - 일반 사용자 토큰 → 401 (admin guard 가 user JWT 거부)
 *  - operator role → 401 또는 200 (admin/operator 모두 read 허용 정책)
 *  - admin role → 200/201
 */
describe('ITC-ADMIN-PHOTOCARD-AUTHZ — admin photocard endpoints', () => {
  let env: IntegrationApp;

  beforeAll(async () => {
    env = await createIntegrationApp();
  });
  afterAll(async () => {
    await env.close();
  });

  it('TC-PHOTO-ADMZ-001 — 인증 없으면 401 (admin/photocards/sets, admin/photocards/sets/:id)', async () => {
    await env.http.get('/api/v1/admin/photocards/sets').expect(401);
    // existing seed has 1 set (HYUN 1st) — id is fixed
    await env.http.get('/api/v1/admin/photocards/sets/00000000-0000-0000-0000-0000000000ca').expect(401);
  });

  it('TC-PHOTO-ADMZ-002 — 일반 user JWT 거부 (admin guard 가 user 토큰 401 처리)', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      await env.http
        .get('/api/v1/admin/photocards/sets')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-PHOTO-ADMZ-003 — admin role: GET /admin/photocards/sets 200', async () => {
    const adminToken = await adminLogin(env.http);
    const res = await env.http
      .get('/api/v1/admin/photocards/sets')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('TC-PHOTO-ADMZ-004 — operator role: read OK (작성/수정은 admin 전용)', async () => {
    const opToken = await operatorLogin(env);
    // Read 는 허용 (RolesGuard read = admin/operator)
    await env.http
      .get('/api/v1/admin/photocards/sets')
      .set('Authorization', `Bearer ${opToken}`)
      .expect(200);
    // Write 는 admin 전용 — operator 는 403
    await env.http
      .post('/api/v1/admin/photocards/sets')
      .set('Authorization', `Bearer ${opToken}`)
      .send({ name: 'opwrite-test', description: null, idolId: null })
      .expect((r) => {
        // RolesGuard 정책에 따라 403 또는 401. 둘 다 forbidden.
        if (r.status !== 403 && r.status !== 401) {
          throw new Error(`expected 401/403 got ${r.status}`);
        }
      });
  });
});
