import { createIntegrationApp, signupUser, type IntegrationApp } from './helpers/app-harness';
import { adminLogin, operatorLogin } from './helpers/audition-fixtures';

/**
 * ITC-ADMIN-PROJECT-DOCS-AUTHZ — T-088 후속.
 *
 *  - 인증 없는 호출 → 401
 *  - 일반 user JWT → 401 (admin guard 가 user 토큰 거부)
 *  - operator role → list/detail 200, write 403
 *  - admin role → 모두 허용 (CRUD + version 자동 증가)
 *  - 추가: 중복 slug 409, 잘못된 slug 형식 400, missing slug 404
 */
describe('ITC-ADMIN-PROJECT-DOCS-AUTHZ — admin project-docs endpoints', () => {
  let env: IntegrationApp;

  beforeAll(async () => {
    env = await createIntegrationApp();
  });
  afterAll(async () => {
    await env.close();
  });

  it('TC-PROJDOC-ADMZ-001 — 인증 없으면 401 (list / detail / write)', async () => {
    await env.http.get('/api/v1/admin/project-docs').expect(401);
    await env.http.get('/api/v1/admin/project-docs/some-slug').expect(401);
    await env.http.post('/api/v1/admin/project-docs').send({}).expect(401);
    await env.http
      .patch('/api/v1/admin/project-docs/00000000-0000-0000-0000-000000000001')
      .send({})
      .expect(401);
    await env.http
      .delete('/api/v1/admin/project-docs/00000000-0000-0000-0000-000000000001')
      .expect(401);
  });

  it('TC-PROJDOC-ADMZ-002 — 일반 user JWT 거부', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      await env.http
        .get('/api/v1/admin/project-docs')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-PROJDOC-ADMZ-003 — admin: 전체 CRUD + version 자동 증가', async () => {
    const adminToken = await adminLogin(env.http);

    const slug = `deliverable-itc-${Date.now()}`;
    const created = await env.http
      .post('/api/v1/admin/project-docs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        slug,
        title: 'ITC test',
        category: 'DELIVERABLE',
        sourceType: 'INLINE',
        content: '# v1',
      })
      .expect(201);
    expect(created.body.version).toBe(1);
    const id = created.body.id as string;

    // 중복 slug → 409
    await env.http
      .post('/api/v1/admin/project-docs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        slug,
        title: 'dup',
        category: 'DELIVERABLE',
        sourceType: 'INLINE',
        content: '# dup',
      })
      .expect(409);

    // content 변경 → version 2
    const updated = await env.http
      .patch(`/api/v1/admin/project-docs/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: '# v2', status: 'REVIEW' })
      .expect(200);
    expect(updated.body.version).toBe(2);
    expect(updated.body.status).toBe('REVIEW');

    // title 만 변경 → version 유지
    const titleOnly = await env.http
      .patch(`/api/v1/admin/project-docs/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'renamed' })
      .expect(200);
    expect(titleOnly.body.version).toBe(2);

    // detail by slug
    const detail = await env.http
      .get(`/api/v1/admin/project-docs/${slug}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(detail.body.content).toContain('v2');

    // 잘못된 slug 형식 → 400
    await env.http
      .post('/api/v1/admin/project-docs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        slug: 'bad slug with spaces!',
        title: 'x',
        category: 'OTHER',
        content: 'x',
      })
      .expect(400);

    // 미존재 slug → 404
    await env.http
      .get('/api/v1/admin/project-docs/this-does-not-exist-zzz')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    // delete → 204, 재삭제 → 404
    await env.http
      .delete(`/api/v1/admin/project-docs/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
    await env.http
      .delete(`/api/v1/admin/project-docs/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('TC-PROJDOC-ADMZ-004 — operator: read 200 / write 403', async () => {
    const opToken = await operatorLogin(env);

    // List
    const list = await env.http
      .get('/api/v1/admin/project-docs')
      .set('Authorization', `Bearer ${opToken}`)
      .expect(200);
    expect(Array.isArray(list.body)).toBe(true);

    // Detail (시드된 첫 doc)
    const slug: string | undefined = list.body[0]?.slug;
    if (slug) {
      await env.http
        .get(`/api/v1/admin/project-docs/${slug}`)
        .set('Authorization', `Bearer ${opToken}`)
        .expect(200);
    }

    // Write 모두 거부
    await env.http
      .post('/api/v1/admin/project-docs')
      .set('Authorization', `Bearer ${opToken}`)
      .send({
        slug: `op-blocked-${Date.now()}`,
        title: 'op',
        category: 'DELIVERABLE',
        sourceType: 'INLINE',
        content: 'x',
      })
      .expect(403);

    // PATCH/DELETE 도 admin only
    const adminToken = await adminLogin(env.http);
    const list2 = await env.http
      .get('/api/v1/admin/project-docs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const targetId: string | undefined = list2.body[0]?.id;
    if (!targetId) return;

    await env.http
      .patch(`/api/v1/admin/project-docs/${targetId}`)
      .set('Authorization', `Bearer ${opToken}`)
      .send({ status: 'ARCHIVED' })
      .expect(403);

    await env.http
      .delete(`/api/v1/admin/project-docs/${targetId}`)
      .set('Authorization', `Bearer ${opToken}`)
      .expect(403);
  });
});
