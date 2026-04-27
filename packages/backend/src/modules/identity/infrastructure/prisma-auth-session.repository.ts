import { Injectable } from '@nestjs/common';
import { AuthSession } from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { AuthSessionRepository } from '../application/interfaces';

@Injectable()
export class PrismaAuthSessionRepository implements AuthSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    id: string;
    userId: string;
    refreshTokenHash: string;
    deviceId: string | null;
    expiresAt: Date;
  }): Promise<AuthSession> {
    const row = await this.prisma.authSession.create({
      data: {
        id: input.id,
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        deviceId: input.deviceId ?? undefined,
        expiresAt: input.expiresAt,
      },
    });
    return this.toDomain(row);
  }

  async findByIdForUser(sessionId: string, userId: string): Promise<AuthSession | null> {
    const row = await this.prisma.authSession.findFirst({
      where: { id: sessionId, userId },
    });
    return row ? this.toDomain(row) : null;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async rotate(sessionId: string, newHash: string, newExpiresAt: Date): Promise<AuthSession> {
    const row = await this.prisma.authSession.update({
      where: { id: sessionId },
      data: { refreshTokenHash: newHash, expiresAt: newExpiresAt },
    });
    return this.toDomain(row);
  }

  private toDomain(row: {
    id: string;
    userId: string;
    refreshTokenHash: string;
    deviceId: string | null;
    createdAt: Date;
    expiresAt: Date;
    revokedAt: Date | null;
  }): AuthSession {
    return new AuthSession({
      id: row.id,
      userId: row.userId,
      refreshTokenHash: row.refreshTokenHash,
      deviceId: row.deviceId,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
    });
  }
}
