import { Injectable } from '@nestjs/common';
import type { AdminRole, AdminStatus } from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { AdminUser } from '../domain/admin-user';
import type { AdminUserRepository } from '../application/interfaces';

@Injectable()
export class PrismaAdminUserRepository implements AdminUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<AdminUser | null> {
    const row = await this.prisma.adminUser.findUnique({ where: { email } });
    return row ? this.toDomain(row) : null;
  }

  async findById(id: string): Promise<AdminUser | null> {
    const row = await this.prisma.adminUser.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async touchLastLogin(id: string, at: Date): Promise<void> {
    await this.prisma.adminUser.update({ where: { id }, data: { lastLoginAt: at } });
  }

  async listAll(): Promise<AdminUser[]> {
    const rows = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: {
    id: string;
    email: string;
    passwordHash: string;
    displayName: string;
    role: AdminRole;
    status: AdminStatus;
    lastLoginAt: Date | null;
    createdAt: Date;
  }): AdminUser {
    return AdminUser.create({
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      displayName: row.displayName,
      role: row.role,
      status: row.status,
      lastLoginAt: row.lastLoginAt,
      createdAt: row.createdAt,
    });
  }
}
