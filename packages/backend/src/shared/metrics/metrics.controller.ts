import { Controller, Get, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';

/**
 * `GET /metrics` — Prometheus exposition format. 어떤 스크래이퍼도 호환:
 *  - Prometheus (자체 호스팅)
 *  - Datadog Agent (`prometheus_check`)
 *  - Grafana Cloud Agent
 *  - VictoriaMetrics
 *
 * 인증 없음 — staging/prod에서는 ingress 레벨 ACL(VPC internal 또는 basic
 * auth) 권장. `runbook-ko.md` 에 별도 문서화.
 *
 * Content-Type은 prom-client가 expose하는 그대로 사용
 * (`text/plain; version=0.0.4; charset=utf-8`). Express `res` 직접 다뤄
 * Nest의 default text/plain 변경.
 */
@ApiTags('observability')
@SkipThrottle()
@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Prometheus exposition — http_requests_total, http_request_duration_seconds, http_server_errors_total + Node process metrics',
  })
  async expose(@Res() res: Response): Promise<void> {
    const { contentType, body } = await this.metrics.expose();
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.send(body);
  }
}
