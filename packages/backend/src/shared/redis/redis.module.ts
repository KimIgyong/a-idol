import { Global, Module } from '@nestjs/common';
import IORedis, { Redis } from 'ioredis';
import { AppConfig } from '../../config/config.schema';

export const REDIS_CLIENT = 'RedisClient';

/**
 * Single shared ioredis client. Separate from the BullMQ connection
 * (different lifecycle / commands) but wired to the same server.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [AppConfig],
      useFactory: (cfg: AppConfig): Redis => {
        return new IORedis(cfg.redisUrl, {
          maxRetriesPerRequest: 3,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
