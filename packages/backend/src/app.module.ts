import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { resolveRequestId } from './shared/logger/correlation';
import { ConfigModule } from './config/config.module';
import { AppConfig } from './config/config.schema';
import { PrismaModule } from './shared/prisma/prisma.module';
import { QueueModule } from './shared/queue/queue.module';
import { RedisModule } from './shared/redis/redis.module';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './shared/metrics/metrics.module';
import { IdentityModule } from './modules/identity/identity.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { FandomModule } from './modules/fandom/fandom.module';
import { AdminOpsModule } from './modules/admin-ops/admin-ops.module';
import { ChatModule } from './modules/chat/chat.module';
import { AuditionModule } from './modules/audition/audition.module';
import { VoteModule } from './modules/vote/vote.module';
import { CommerceModule } from './modules/commerce/commerce.module';
import { PhotocardModule } from './modules/photocard/photocard.module';
import { DesignAssetsModule } from './modules/design-assets/design-assets.module';
import { ProjectDocsModule } from './modules/project-docs/project-docs.module';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot(),
    // Serve generated idol image assets (SVG placeholders today, real JPGs later)
    // at `/api/uploads/*` — matches the URL pattern the persona export carries.
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/api/uploads',
      serveStaticOptions: {
        index: false,
        fallthrough: true,
        setHeaders: (res, path) => {
          if (path.endsWith('.svg')) res.setHeader('Content-Type', 'image/svg+xml');
        },
      },
    }),
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (cfg: AppConfig) => ({
        pinoHttp: {
          level: cfg.logLevel,
          transport:
            cfg.nodeEnv === 'development'
              ? {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    colorize: true,
                    translateTime: 'SYS:HH:MM:ss.l',
                    messageFormat: '[{reqId}] {msg}',
                    ignore: 'pid,hostname,req,res,responseTime',
                  },
                }
              : undefined,
          autoLogging: {
            ignore: (req: { url?: string }) => req.url === '/health',
          },
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          // Correlation ID: see resolveRequestId — honors caller's
          // X-Request-ID or mints a UUID, attaches to every log line as
          // `reqId`, and echoes back on the response header.
          genReqId: resolveRequestId,
        },
      }),
    }),
    // T-082 (RPT-260426-D Phase D) — 글로벌 rate-limit. /minute/IP 기준
    // 기본 200 — 일반 사용자 정상 트래픽은 충분히 흡수, scraper/abusive bot 차단.
    // `THROTTLE_LIMIT_PER_MINUTE` env로 override (k6 staging 부하 측정 시 100k로
    // 상향). /health 와 /metrics 는 K8s liveness probe + Prometheus scrape
    // 트래픽이라 skip — 둘 다 read-only이며 자체 보호 (metrics는 ingress ACL).
    // 더 엄격한 throttle은 라우트별 `@Throttle` 데코레이터로 override
    // (예: vote `cast` = 30/min).
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (cfg: AppConfig) => [
        {
          name: 'default',
          ttl: 60_000,
          limit: cfg.throttleLimitPerMinute,
        },
      ],
    }),
    PrismaModule,
    QueueModule,
    RedisModule,
    HealthModule,
    MetricsModule,
    IdentityModule,
    CatalogModule,
    FandomModule,
    AdminOpsModule,
    ChatModule,
    AuditionModule,
    VoteModule,
    PhotocardModule,
    CommerceModule,
    DesignAssetsModule,
    ProjectDocsModule,
  ],
  providers: [
    // 글로벌 ThrottlerGuard — 모든 요청에 default rate-limit 적용. 라우트별
    // `@Throttle` 데코레이터(@SkipThrottle 포함)로 override.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
