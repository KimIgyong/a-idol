import 'reflect-metadata';
// T-080 — Sentry 는 다른 import / NestFactory 보다 먼저 init 되어야 early
// bootstrap 에러도 capture. DSN 비어있으면 SDK init skip (graceful no-op).
import * as Sentry from '@sentry/node';
const SENTRY_DSN = process.env.SENTRY_DSN ?? '';
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    // PII 자동 redact — pino redact 와 정합 (ADR-017).
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete (event.request.headers as Record<string, unknown>)['authorization'];
        }
      }
      return event;
    },
  });
}

import compression from 'compression';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppExceptionFilter } from './shared/errors/app-exception.filter';
import { AppConfig } from './config/config.schema';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  // T-082 (RPT-260426-D Phase D) — 보안 헤더 + CSP.
  //  - HSTS (max-age 1y, includeSubDomains)
  //  - X-Content-Type-Options: nosniff
  //  - X-Frame-Options: SAMEORIGIN
  //  - Referrer-Policy: no-referrer
  //  - Cross-Origin-{Opener,Resource}-Policy
  //  - Origin-Agent-Cluster
  //  - **Content-Security-Policy** (Swagger UI 호환):
  //    - script-src/style-src에 'unsafe-inline' — Swagger UI HTML 인라인 사용.
  //      외부 script-src 차단은 그대로 유효 (XSS 외부 자원 주입 방어).
  //    - img-src에 data: + https: — favicon (data URI) + 향후 외부 이미지.
  //    - connect-src 'self' — Swagger UI 가 /docs-json 만 호출.
  //    JSON 응답에는 CSP 적용해도 무해 (브라우저가 렌더링 안 함).
  //  - Cross-Origin-Embedder-Policy off — Swagger UI 자산이 별도 origin에서
  //    오는 경우 호환성 위해.
  // Sentry endpoint (browser SDK가 별도 origin 필요시) — backend 단일 SDK는
  // process 내부 호출이라 connect-src 불필요. CSP는 그대로 self-only.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: [`'self'`],
          scriptSrc: [`'self'`, `'unsafe-inline'`],
          styleSrc: [`'self'`, `'unsafe-inline'`],
          imgSrc: [`'self'`, 'data:', 'https:'],
          fontSrc: [`'self'`, 'data:'],
          connectSrc: [`'self'`],
          frameAncestors: [`'self'`],
          objectSrc: [`'none'`],
          baseUri: [`'self'`],
          formAction: [`'self'`],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  // X-Powered-By: Express 헤더 제거 (fingerprint 표면 축소). helmet은 hidePoweredBy
  // 도 default ON 이지만 명시적으로 disable해 의도를 분명히.
  app.disable('x-powered-by');

  // Response compression — gzip/deflate. Applied before other middleware so
  // even error bodies get compressed. `threshold: 1024` skips tiny payloads
  // where the framing overhead outweighs the savings. Measured impact on
  // /idols?size=20: ~4 KB payloads → ~700 B (see docs/ops/perf-baseline-ko.md).
  app.use(compression({ threshold: 1024 }));

  const cfg = app.get(AppConfig);

  app.enableCors({
    origin: cfg.corsOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AppExceptionFilter());
  // ADR-021 (2026-04-27) — API 경로 표준화: `/api/v1/...`
  // - Default version `1`을 적용한 컨트롤러는 자동으로 `/api/v1/<path>`.
  // - `health` · `metrics` 컨트롤러는 `VERSION_NEUTRAL` + global prefix
  //   exclude로 root(`/health`, `/metrics`)에 노출 — orchestrator/probe 호환.
  app.setGlobalPrefix('api', { exclude: ['/health', '/metrics'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // OpenAPI
  const config = new DocumentBuilder()
    .setTitle('A-idol API')
    .setDescription('AI Idol Fandom Platform — Backend API (MVP)')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, doc);

  await app.listen(cfg.port);
  // eslint-disable-next-line no-console
  console.log(
    `🎤  A-idol backend listening on http://localhost:${cfg.port}  (env=${cfg.nodeEnv})`,
  );
}

void bootstrap();
