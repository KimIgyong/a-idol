import { Injectable, OnModuleInit } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * T-080 — Prometheus 메트릭 수집기 (RPT-260426-D Phase D 첫 슬라이스).
 *
 * 자체 `Registry` 인스턴스를 사용 (default 글로벌 registry 분리). Process metrics
 * (memory, GC, event loop lag, FD)는 `collectDefaultMetrics` 로 자동 수집.
 *
 * 라우트 라벨 카디널리티는 `MetricsMiddleware` 가 normalize 후 expose:
 *  - 정확 매칭: `req.route?.path` (Nest matcher 후 채워짐) — 예: `/idols/:id`
 *  - fallback: 미매칭(404 등)은 `unknown` 으로 묶어 cardinality 폭발 방지
 *  - 자기참조: `/metrics` 자체 트래픽은 미들웨어에서 self-exclude
 *
 * Status code는 100 단위(`status_class`)로 group — 5xx 카운터를 별도로 두어
 * Sentry-style alert 트리거 가능.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();
  readonly httpRequestsTotal: Counter<'method' | 'route' | 'status_class'>;
  readonly httpRequestDuration: Histogram<'method' | 'route' | 'status_class'>;
  readonly httpServerErrors: Counter<'method' | 'route'>;
  /** T-082 후속 — 인증 실패 (잘못된 비밀번호 / 미존재 이메일). credential
   *  stuffing 패턴 모니터링용. `kind` = `user` / `admin`. */
  readonly authLoginFailures: Counter<'kind'>;
  /** T-082 후속 — account lockout 발동 카운터. `kind` = `user` / `admin`.
   *  rate burst 시 brute-force / DoS-by-lockout 의심. */
  readonly authAccountLocked: Counter<'kind'>;

  constructor() {
    this.registry.setDefaultLabels({ service: 'a-idol-backend' });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Count of HTTP requests handled, by method/route/status class',
      labelNames: ['method', 'route', 'status_class'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request latency in seconds',
      labelNames: ['method', 'route', 'status_class'],
      // 와이드 버킷 (1ms ~ 30s) — p50 ~30ms, p95 < 300ms 로 baseline 가정.
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
      registers: [this.registry],
    });

    this.httpServerErrors = new Counter({
      name: 'http_server_errors_total',
      help: 'Count of HTTP 5xx responses (separate so alerts can fire on rate)',
      labelNames: ['method', 'route'],
      registers: [this.registry],
    });

    this.authLoginFailures = new Counter({
      name: 'auth_login_failures_total',
      help: 'Count of failed login attempts (wrong password or unknown email)',
      labelNames: ['kind'],
      registers: [this.registry],
    });

    this.authAccountLocked = new Counter({
      name: 'auth_account_locked_total',
      help: 'Count of account lockout trips (NIST §5.2.2)',
      labelNames: ['kind'],
      registers: [this.registry],
    });
  }

  onModuleInit() {
    // Process-level metrics — node_*, process_*. Default prefix은 `''`라 nodejs_*
    // / process_* prefix 그대로 노출.
    collectDefaultMetrics({ register: this.registry });
  }

  observe(input: {
    method: string;
    route: string;
    statusCode: number;
    durationSeconds: number;
  }): void {
    const status_class = `${Math.floor(input.statusCode / 100)}xx`;
    const labels = {
      method: input.method.toUpperCase(),
      route: input.route,
      status_class,
    };
    this.httpRequestsTotal.inc(labels, 1);
    this.httpRequestDuration.observe(labels, input.durationSeconds);
    if (input.statusCode >= 500) {
      this.httpServerErrors.inc(
        { method: labels.method, route: labels.route },
        1,
      );
    }
  }

  /** T-082 보안 관측 — 로그인 실패 1회 기록. */
  recordLoginFailure(kind: 'user' | 'admin'): void {
    this.authLoginFailures.inc({ kind }, 1);
  }

  /** T-082 보안 관측 — account lockout 1회 발동. */
  recordAccountLocked(kind: 'user' | 'admin'): void {
    this.authAccountLocked.inc({ kind }, 1);
  }

  async expose(): Promise<{ contentType: string; body: string }> {
    return {
      contentType: this.registry.contentType,
      body: await this.registry.metrics(),
    };
  }
}
