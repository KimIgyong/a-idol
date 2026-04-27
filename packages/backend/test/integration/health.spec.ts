import { createIntegrationApp, type IntegrationApp } from './helpers/app-harness';

describe('ITC-HEALTH — /health', () => {
  let env: IntegrationApp;

  beforeAll(async () => {
    env = await createIntegrationApp();
  });
  afterAll(async () => {
    await env.close();
  });

  it('TC-HEALTH-001 — reports ok with db=up and redis=up when both are reachable', async () => {
    const res = await env.http.get('/health').expect(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      db: 'up',
      redis: 'up',
    });
    expect(typeof res.body.uptimeSeconds).toBe('number');
    expect(typeof res.body.version).toBe('string');
  });

  it('TC-HEALTH-002 — response echoes X-Request-ID when supplied (ADR-017)', async () => {
    const requested = '11111111-2222-3333-4444-555555555555';
    const res = await env.http
      .get('/health')
      .set('X-Request-ID', requested)
      .expect(200);
    expect(res.headers['x-request-id']).toBe(requested);
  });

  it('TC-HEALTH-003 — response mints an X-Request-ID when caller sends none', async () => {
    const res = await env.http.get('/health').expect(200);
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});
