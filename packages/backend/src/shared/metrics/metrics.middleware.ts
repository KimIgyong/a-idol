import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

/**
 * 모든 요청에 대해 latency + status를 기록. 라우트 정규화는 Express의
 * `req.route?.path` 사용 — Nest controller의 path pattern (`/idols/:id`)이
 * 들어와 cardinality가 안전. 미매칭(404)은 `unknown` 으로 묶음.
 *
 * `/metrics` 자체는 self-exclude (스크래이프 트래픽이 카운터를 부풀리지
 * 않도록).
 */
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      // `req.route?.path` 는 Nest matcher가 끝난 후 채워짐 — 이 시점이 가장 정확.
      // 미매칭(404 등)은 `unknown` 으로 묶음 (cardinality 폭발 방지).
      const route = req.route?.path ?? 'unknown';
      // self-exclude — 스크래이프 트래픽이 카운터를 부풀리지 않도록.
      if (route === '/metrics') return;
      const elapsedNs = Number(process.hrtime.bigint() - start);
      const durationSeconds = elapsedNs / 1e9;
      this.metrics.observe({
        method: req.method,
        route,
        statusCode: res.statusCode,
        durationSeconds,
      });
    });
    next();
  }
}
