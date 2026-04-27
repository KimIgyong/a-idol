import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule } from './config/config.module';
import { AppConfig } from './config/config.schema';
import { PrismaModule } from './shared/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { CatalogModule } from './modules/catalog/catalog.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (cfg: AppConfig) => ({
        pinoHttp: {
          level: cfg.logLevel,
          transport:
            cfg.nodeEnv === 'development'
              ? {
                  target: 'pino-pretty',
                  options: { singleLine: true, colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
                }
              : undefined,
          autoLogging: {
            ignore: (req: { url?: string }) => req.url === '/health',
          },
          redact: ['req.headers.authorization', 'req.headers.cookie'],
        },
      }),
    }),
    PrismaModule,
    HealthModule,
    IdentityModule,
    CatalogModule,
  ],
})
export class AppModule {}
