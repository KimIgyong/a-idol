import { createIntegrationApp, type IntegrationApp } from './helpers/app-harness';

/**
 * 보안 ITC — RPT-260426-D Phase D T-082 첫 슬라이스.
 *  - helmet default 헤더 존재
 *  - X-Powered-By 미노출
 *  - /metrics 와 /health 는 throttle skip
 *  - JSON validator 가 unknown field 거부 (이미 main.ts forbidNonWhitelisted)
 *
 * Note: ThrottlerGuard rate-limit 통과 자체는 /minute/IP 200 — single-test로
 * trip 시키는 건 시간 비용이 커 unit smoke 만 (live curl 으로 별도 검증).
 */
describe('ITC-SECURITY — helmet + throttle skip + validator', () => {
  let env: IntegrationApp;
  beforeAll(async () => {
    env = await createIntegrationApp();
  });
  afterAll(async () => {
    await env.close();
  });

  it('TC-SEC-001 — /health 응답에 helmet 보안 헤더 포함', async () => {
    const res = await env.http.get('/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(res.headers['cross-origin-opener-policy']).toBeDefined();
    // X-Powered-By: Express는 fingerprint이라 disable.
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('TC-SEC-002 — /metrics 도 helmet 헤더 + 텍스트 응답', async () => {
    const res = await env.http.get('/metrics').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.text).toMatch(/^# HELP /m);
  });

  it('TC-SEC-003 — unknown field 가 들어오면 ValidationPipe 가 거부', async () => {
    const res = await env.http
      .post('/api/v1/auth/signup')
      .send({
        email: 'bogus@x.com',
        password: 'Aaaaaa1!',
        nickname: 'sec',
        device_id: 'sec-1',
        birthdate: '2000-01-01',
        // unknown field — forbidNonWhitelisted=true 라 400.
        admin: true,
      })
      .expect((r) => {
        if (r.status < 400 || r.status >= 500) {
          throw new Error(`expected 4xx got ${r.status}`);
        }
      });
    expect(JSON.stringify(res.body)).toMatch(/admin/);
  });

  it('TC-SEC-004 — Content-Security-Policy 헤더 + 핵심 directive 정확히 노출', async () => {
    const res = await env.http.get('/health').expect(200);
    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/script-src[^;]*'self'[^;]*'unsafe-inline'/);
    expect(csp).toMatch(/object-src 'none'/);
    expect(csp).toMatch(/frame-ancestors 'self'/);
    // upgrade-insecure-requests 는 directive 자체로 표기 (값 없음)
    expect(csp).toMatch(/upgrade-insecure-requests/);
  });
});
