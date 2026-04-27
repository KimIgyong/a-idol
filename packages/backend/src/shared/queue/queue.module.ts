import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppConfig } from '../../config/config.schema';

export const AUTO_MESSAGE_QUEUE = 'auto-message';
export const CHAT_QUOTA_RESET_QUEUE = 'chat-quota-reset';
export const RANKING_SNAPSHOT_QUEUE = 'ranking-snapshot';
export const LEADERBOARD_AUDIT_QUEUE = 'leaderboard-audit';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (cfg: AppConfig) => {
        const url = new URL(cfg.redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            // redis db from the URL's path (`/0` → 0)
            db: url.pathname && url.pathname !== '/' ? Number(url.pathname.slice(1)) : 0,
            password: url.password || undefined,
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: AUTO_MESSAGE_QUEUE },
      { name: CHAT_QUOTA_RESET_QUEUE },
      { name: RANKING_SNAPSHOT_QUEUE },
      { name: LEADERBOARD_AUDIT_QUEUE },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
