import { createIntegrationApp, type IntegrationApp } from './helpers/app-harness';
import { adminLogin, operatorLogin } from './helpers/audition-fixtures';

/**
 * GET /api/v1/admin/operators — admin role 전용 read-only 운영자 목록.
 * RPT-260426-B §5 첫 슬라이스 회귀 잠금.
 */
describe('ITC-OPERATORS — admin operator management', () => {
  let env: IntegrationApp;

  beforeAll(async () => {
    env = await createIntegrationApp();
  });
  afterAll(async () => {
    await env.close();
  });

  it('TC-OP-001 — admin role으로 GET /admin/operators 200 + 운영자 목록 반환', async () => {
    const adminToken = await adminLogin(env.http);
    const res = await env.http
      .get('/api/v1/admin/operators')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    const sample = res.body[0];
    expect(sample).toMatchObject({
      id: expect.any(String),
      email: expect.any(String),
      displayName: expect.any(String),
      role: expect.stringMatching(/^(admin|operator|viewer)$/),
      status: expect.stringMatching(/^(active|suspended)$/),
      createdAt: expect.any(String),
    });
    // 비밀번호 해시는 절대 노출 안 됨.
    expect(sample.passwordHash).toBeUndefined();
  });

  it('TC-OP-002 — operator role은 admin/operators 403 — RolesGuard 차단', async () => {
    const operatorToken = await operatorLogin(env);
    await env.http
      .get('/api/v1/admin/operators')
      .set('Authorization', `Bearer ${operatorToken}`)
      .expect(403);
  });

  it('TC-OP-003 — 인증 없으면 401', async () => {
    await env.http.get('/api/v1/admin/operators').expect(401);
  });

  it('TC-OP-004 — admin과 operator 둘 다 결과에 포함 (다른 사용자도 정상 조회)', async () => {
    const adminToken = await adminLogin(env.http);
    // operator 계정이 존재하도록 강제 — operatorLogin이 없으면 생성함.
    await operatorLogin(env);

    const res = await env.http
      .get('/api/v1/admin/operators')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const emails = (res.body as Array<{ email: string }>).map((r) => r.email);
    expect(emails).toContain('admin@a-idol.dev');
    expect(emails).toContain('operator@a-idol.dev');
  });
});
