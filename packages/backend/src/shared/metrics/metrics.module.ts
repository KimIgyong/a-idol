import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsMiddleware } from './metrics.middleware';
import { MetricsService } from './metrics.service';

/**
 * T-080 — Prometheus 메트릭. `MetricsService` 는 cross-cutting observability
 * 라 `@Global()` — identity / admin-ops 등 다른 모듈에서 import 없이 inject.
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, MetricsMiddleware],
  exports: [MetricsService],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
