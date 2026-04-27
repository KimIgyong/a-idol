import { createIntegrationApp, signupUser, type IntegrationApp } from './helpers/app-harness';
import { adminLogin, operatorLogin } from './helpers/audition-fixtures';

/**
 * Authorization boundaries between public · user · admin · operator.
 * Unit-level RBAC is covered per-guard; these specs exercise the full
 * request pipeline (JwtAuthGuard → RolesGuard → controller) which is the
 * regression path that breaks when guard decorators drift.
 */
describe('ITC-AUTHZ — role gates', () => {
  let env: IntegrationApp;
  let userToken: string;
  let adminToken: string;
  let operatorToken: string;

  beforeAll(async () => {
    env = await createIntegrationApp();
    const u = await signupUser(env.http);
    userToken = u.accessToken;
    adminToken = await adminLogin(env.http);
    operatorToken = await operatorLogin(env);
  });
  afterAll(async () => {
    await env.close();
  });

  it('TC-AUTHZ-001 — admin endpoint with no token → 401', async () => {
    await env.http.get('/api/v1/admin/commerce/products').expect(401);
  });

  it('TC-AUTHZ-002 — admin endpoint with user token → 401 (user JWTs not accepted by AdminJwtAuthGuard)', async () => {
    await env.http
      .get('/api/v1/admin/commerce/products')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(401);
  });

  it('TC-AUTHZ-003 — admin endpoint with admin token → 200', async () => {
    await env.http
      .get('/api/v1/admin/commerce/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('TC-AUTHZ-004 — user endpoint (/me) with admin token → 401 (admin JWTs not accepted by JwtAuthGuard)', async () => {
    // Per ADR-010 the two token issuers are fully separate — there is no
    // crossover. An admin token must NOT unlock user-scoped endpoints.
    await env.http
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(401);
  });

  it('TC-AUTHZ-005 — operator token: reads admin list (200)', async () => {
    // `@Roles('admin', 'operator')` on the controller class → operator
    // passes the role gate for GET.
    await env.http
      .get('/api/v1/admin/commerce/products')
      .set('Authorization', `Bearer ${operatorToken}`)
      .expect(200);
  });

  it('TC-AUTHZ-006 — operator token: cannot create products (403)', async () => {
    // `@Roles('admin')` method-level override on POST — operator rejected.
    const res = await env.http
      .post('/api/v1/admin/commerce/products')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        sku: `authz-op-${Date.now()}`,
        kind: 'CHAT_COUPON',
        title: 'op-forbidden',
        price_krw: 1000,
        delivery_payload: { couponAmount: 1 },
      })
      .expect(403);
    // RolesGuard throws ForbiddenException; body shape is Nest default.
    expect(res.body.statusCode).toBe(403);
  });

  it('TC-AUTHZ-007 — admin token: can create products (201)', async () => {
    const sku = `authz-admin-${Date.now()}`;
    const res = await env.http
      .post('/api/v1/admin/commerce/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku,
        kind: 'CHAT_COUPON',
        title: 'admin-ok',
        price_krw: 1000,
        delivery_payload: { couponAmount: 1 },
      })
      .expect(201);
    expect(res.body.sku).toBe(sku);
    // Cleanup — deactivate the test product so the catalog doesn't drift.
    await env.prisma.purchaseProduct.update({
      where: { sku },
      data: { isActive: false },
    });
  });
});
