import { createIntegrationApp, signupUser, type IntegrationApp } from './helpers/app-harness';

describe('ITC-COMMERCE — DEV_SANDBOX purchase flow', () => {
  let env: IntegrationApp;
  let chatCouponProductId: string;

  beforeAll(async () => {
    env = await createIntegrationApp();
    // Resolve the seeded chat-coupon-10 product id once per run.
    const products = await env.http.get('/api/v1/commerce/products').expect(200);
    const coupon = (products.body as Array<{ id: string; sku: string }>).find(
      (p) => p.sku === 'chat-coupon-10',
    );
    if (!coupon) {
      throw new Error(
        'Integration tests require `chat-coupon-10` in the catalog. Run `pnpm seed`.',
      );
    }
    chatCouponProductId = coupon.id;
  });
  afterAll(async () => {
    await env.close();
  });

  it('TC-COMM-001 — purchase chat-coupon-10 in DEV_SANDBOX → FULFILLED + wallet +10', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      const buy = await env.http
        .post('/api/v1/commerce/purchases')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ product_id: chatCouponProductId })
        .expect(200);

      expect(buy.body).toMatchObject({
        status: 'FULFILLED',
        provider: 'DEV_SANDBOX',
        priceKrw: 1100,
      });

      const bal = await env.http
        .get('/api/v1/me/chat-balance')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(bal.body.couponBalance).toBe(10);
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-COMM-002 — duplicate providerTxId → 409 DUPLICATE_RECEIPT (R-03)', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      const providerTxId = `integration-dup-${Date.now()}`;
      await env.http
        .post('/api/v1/commerce/purchases')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ product_id: chatCouponProductId, provider_tx_id: providerTxId })
        .expect(200);

      const second = await env.http
        .post('/api/v1/commerce/purchases')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ product_id: chatCouponProductId, provider_tx_id: providerTxId })
        .expect(409);

      expect(second.body).toMatchObject({ code: 'DUPLICATE_RECEIPT' });
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-COMM-003 — APPLE_IAP rejected until adapter ships (ADR-015)', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      const res = await env.http
        .post('/api/v1/commerce/purchases')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ product_id: chatCouponProductId, provider: 'APPLE_IAP' })
        .expect(400);
      expect(res.body).toMatchObject({ code: 'PROVIDER_NOT_SUPPORTED' });
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-COMM-004 — unknown productId → 404 PRODUCT_NOT_FOUND', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      const res = await env.http
        .post('/api/v1/commerce/purchases')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ product_id: 'deadbeef-cafe-4bad-8c0d-000000000099' })
        .expect(404);
      expect(res.body).toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-COMM-005 — DEV_SANDBOX accepts optional receiptJws and ignores it (forward-compat with ADR-019)', async () => {
    // The field landed ahead of `jose` install so mobile can ship an IAP
    // integration without a later DTO change. DEV_SANDBOX path must stay
    // a no-op on this input.
    const { userId, accessToken } = await signupUser(env.http);
    try {
      const res = await env.http
        .post('/api/v1/commerce/purchases')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          product_id: chatCouponProductId,
          receipt_jws: 'eyJhbGciOiJFUzI1NiJ9.ignored-in-dev-sandbox.sig',
        })
        .expect(200);
      expect(res.body.status).toBe('FULFILLED');
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-COMM-006 — APPLE_IAP with receiptJws still 400 PROVIDER_NOT_SUPPORTED (stub verifier not wired yet)', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      const res = await env.http
        .post('/api/v1/commerce/purchases')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          product_id: chatCouponProductId,
          provider: 'APPLE_IAP',
          receipt_jws: 'eyJhbGciOiJFUzI1NiJ9.whatever.sig',
        })
        .expect(400);
      expect(res.body).toMatchObject({ code: 'PROVIDER_NOT_SUPPORTED' });
    } finally {
      await env.resetUser(userId);
    }
  });

  it('TC-COMM-007 — receiptJws exceeding 8 KB rejected at DTO level (400)', async () => {
    const { userId, accessToken } = await signupUser(env.http);
    try {
      const huge = 'x'.repeat(8193);
      await env.http
        .post('/api/v1/commerce/purchases')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          product_id: chatCouponProductId,
          receipt_jws: huge,
        })
        .expect(400);
    } finally {
      await env.resetUser(userId);
    }
  });
});
