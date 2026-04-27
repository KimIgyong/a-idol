import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { HealthResponseDto } from '@a-idol/shared';
import { PrismaService } from '../../shared/prisma/prisma.service';

@ApiTags('health')
@Controller({ path: 'health', version: [] })
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(): Promise<HealthResponseDto & { db: 'up' | 'down' }> {
    let db: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
    } catch {
      db = 'down';
    }
    return {
      status: 'ok',
      version: process.env.npm_package_version ?? '0.1.0',
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
      db,
    };
  }
}
