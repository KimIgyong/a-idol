import { Injectable } from '@nestjs/common';
import { User, type AuthProvider } from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { UserRepository } from '../application/interfaces';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row ? this.toDomain(row) : null;
  }

  async findByProvider(provider: AuthProvider, providerUserId: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
    });
    return row ? this.toDomain(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async create(input: {
    provider: AuthProvider;
    providerUserId: string;
    email: string | null;
    passwordHash: string | null;
    nickname: string;
    birthdate: Date;
  }): Promise<User> {
    const row = await this.prisma.user.create({
      data: {
        provider: input.provider,
        providerUserId: input.providerUserId,
        email: input.email ?? undefined,
        passwordHash: input.passwordHash ?? undefined,
        nickname: input.nickname,
        birthdate: input.birthdate,
      },
    });
    return this.toDomain(row);
  }

  async update(
    id: string,
    patch: { avatarUrl?: string | null; marketingOptIn?: boolean; pushOptIn?: boolean },
  ): Promise<User> {
    const row = await this.prisma.user.update({
      where: { id },
      data: {
        avatarUrl: patch.avatarUrl === undefined ? undefined : patch.avatarUrl,
        marketingOptIn: patch.marketingOptIn,
        pushOptIn: patch.pushOptIn,
      },
    });
    return this.toDomain(row);
  }

  private toDomain(row: {
    id: string;
    provider: AuthProvider;
    providerUserId: string;
    email: string | null;
    passwordHash: string | null;
    nickname: string;
    avatarUrl: string | null;
    birthdate: Date;
    status: 'active' | 'suspended' | 'withdrawn';
    marketingOptIn: boolean;
    pushOptIn: boolean;
    createdAt: Date;
  }): User {
    // Attach passwordHash on the underlying props so login can read it via toJSON().
    // (Rehydrated entities are not supposed to expose secrets outside the module —
    // we scope this leakage to the identity bounded context.)
    const user = User.create({
      id: row.id,
      provider: row.provider,
      providerUserId: row.providerUserId,
      email: row.email,
      nickname: row.nickname,
      avatarUrl: row.avatarUrl,
      birthdate: row.birthdate,
      status: row.status,
      marketingOptIn: row.marketingOptIn,
      pushOptIn: row.pushOptIn,
      createdAt: row.createdAt,
    });
    Object.defineProperty(user, 'toJSON', {
      value: () => ({
        id: row.id,
        provider: row.provider,
        providerUserId: row.providerUserId,
        email: row.email,
        passwordHash: row.passwordHash,
        nickname: row.nickname,
        avatarUrl: row.avatarUrl,
        birthdate: row.birthdate,
        status: row.status,
        marketingOptIn: row.marketingOptIn,
        pushOptIn: row.pushOptIn,
        createdAt: row.createdAt,
      }),
      configurable: true,
    });
    return user;
  }
}
