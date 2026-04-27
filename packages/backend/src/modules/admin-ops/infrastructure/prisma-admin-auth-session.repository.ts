import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  AdminAuthSessionRecord,
  AdminAuthSessionRepository,
} from '../application/interfaces';

@Injectable()
export class PrismaAdminAuthSessionRepository implements AdminAuthSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    id: string;
    adminUserId: string;
    refreshTokenHash: string;
    expiresAt: Date;
  }): Promise<AdminAuthSessionRecord> {
    const row = await this.prisma.adminAuthSession.create({
      data: {
        id: input.id,
        adminUserId: input.adminUserId,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
      },
    });
    return this.toRecord(row);
  }

  async findByIdForAdmin(
    sessionId: string,
    adminUserId: string,
  ): Promise<AdminAuthSessionRecord | null> {
    const row = await this.prisma.adminAuthSession.findFirst({
      where: { id: sessionId, adminUserId },
    });
    return row ? this.toRecord(row) : null;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.adminAuthSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async rotate(
    sessionId: string,
    newHash: string,
    newExpiresAt: Date,
  ): Promise<AdminAuthSessionRecord> {
    const row = await this.prisma.adminAuthSession.update({
      where: { id: sessionId },
      data: { refreshTokenHash: newHash, expiresAt: newExpiresAt },
    });
    return this.toRecord(row);
  }

  private toRecord(row: {
    id: string;
    adminUserId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
  }): AdminAuthSessionRecord {
    return {
      id: row.id,
      adminUserId: row.adminUserId,
      refreshTokenHash: row.refreshTokenHash,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
    };
  }
}
