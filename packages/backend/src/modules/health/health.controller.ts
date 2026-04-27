import { Controller, Get, Inject, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Redis } from 'ioredis';
import type { HealthResponseDto } from '@a-idol/shared';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { REDIS_CLIENT } from '../../shared/redis/redis.module';

@ApiTags('health')
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  async get(): Promise<HealthResponseDto> {
    const [db, redis] = await Promise.all([this.pingDb(), this.pingRedis()]);
    const status: 'ok' | 'degraded' = db === 'up' && redis === 'up' ? 'ok' : 'degraded';
    return {
      status,
      version: process.env.npm_package_version ?? '0.1.0',
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
      db,
      redis,
    };
  }

  private async pingDb(): Promise<'up' | 'down'> {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async pingRedis(): Promise<'up' | 'down'> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}
