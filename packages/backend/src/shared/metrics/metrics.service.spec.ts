import { MetricsService } from './metrics.service';

/**
 * T-OBS-001 — Prometheus exposition + observe() 동작 단위 테스트.
 */
describe('MetricsService', () => {
  it('observes a 200 request and counter/histogram increase, no 5xx counter bump', async () => {
    const m = new MetricsService();
    m.observe({ method: 'GET', route: '/idols/:id', statusCode: 200, durationSeconds: 0.05 });
    const out = await m.expose();
    expect(out.contentType).toMatch(/text\/plain/);
    expect(out.body).toMatch(/http_requests_total\{[^}]*method="GET"[^}]*route="\/idols\/:id"[^}]*status_class="2xx"[^}]*\} 1/);
    expect(out.body).toMatch(/http_request_duration_seconds_bucket\{/);
    expect(out.body).toMatch(/http_server_errors_total/); // metric exists
    // 5xx 없으니 카운터 row 없음 ⇒ "http_server_errors_total{...} <n>" line 미존재.
    const errorBumpRegex = /http_server_errors_total\{[^\n]*\} \d+/;
    expect(errorBumpRegex.test(out.body)).toBe(false);
  });

  it('observes a 503 request and bumps http_server_errors_total', async () => {
    const m = new MetricsService();
    m.observe({ method: 'POST', route: '/foo', statusCode: 503, durationSeconds: 0.2 });
    const out = await m.expose();
    expect(out.body).toMatch(/http_server_errors_total\{[^}]*method="POST"[^}]*route="\/foo"[^}]*\} 1/);
    expect(out.body).toMatch(/http_requests_total\{[^}]*status_class="5xx"[^}]*\} 1/);
  });

  it('aggregates multiple observations into the same labelset', async () => {
    const m = new MetricsService();
    for (let i = 0; i < 3; i++) {
      m.observe({ method: 'get', route: '/auditions', statusCode: 200, durationSeconds: 0.01 });
    }
    const out = await m.expose();
    // method 라벨은 uppercase 정규화됨.
    expect(out.body).toMatch(/http_requests_total\{[^}]*method="GET"[^}]*route="\/auditions"[^}]*\} 3/);
  });

  it('exposes default Node process metrics', async () => {
    const m = new MetricsService();
    m.onModuleInit();
    const out = await m.expose();
    expect(out.body).toMatch(/process_cpu_user_seconds_total/);
    expect(out.body).toMatch(/nodejs_eventloop_lag_seconds/);
  });

  it('records login failures + account lockouts with kind label', async () => {
    const m = new MetricsService();
    m.recordLoginFailure('user');
    m.recordLoginFailure('user');
    m.recordLoginFailure('admin');
    m.recordAccountLocked('admin');
    const out = await m.expose();
    expect(out.body).toMatch(/auth_login_failures_total\{[^}]*kind="user"[^}]*\} 2/);
    expect(out.body).toMatch(/auth_login_failures_total\{[^}]*kind="admin"[^}]*\} 1/);
    expect(out.body).toMatch(/auth_account_locked_total\{[^}]*kind="admin"[^}]*\} 1/);
  });
});
