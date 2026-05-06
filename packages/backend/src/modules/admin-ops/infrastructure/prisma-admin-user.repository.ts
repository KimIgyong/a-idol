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

  async create(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    role: AdminRole;
  }): Promise<AdminUser> {
    const row = await this.prisma.adminUser.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        role: input.role,
      },
    });
    return this.toDomain(row);
  }

  async updateRole(id: string, role: AdminRole): Promise<AdminUser | null> {
    try {
      const row = await this.prisma.adminUser.update({ where: { id }, data: { role } });
      return this.toDomain(row);
    } catch (err) {
      // P2025 — record not found
      if ((err as { code?: string }).code === 'P2025') return null;
      throw err;
    }
  }

  async countByRole(role: AdminRole): Promise<number> {
    return this.prisma.adminUser.count({ where: { role } });
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
