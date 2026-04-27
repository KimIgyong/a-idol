import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  AdminIdolRecord,
  AdminIdolRepository,
} from '../application/admin-interfaces';

// Explicit select — excludes Idol.profileJson (~10 KB JSONB) which
// AdminIdolRecord doesn't surface. Admin CMS list/detail pages show
// scalar metadata only; add profileJson back if a future admin screen
// needs to render the AI persona.
const ADMIN_IDOL_SELECT = {
  id: true,
  agencyId: true,
  name: true,
  stageName: true,
  birthdate: true,
  mbti: true,
  bio: true,
  heroImageUrl: true,
  heartCount: true,
  followCount: true,
  publishedAt: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  agency: { select: { name: true } },
} satisfies Prisma.IdolSelect;

type IdolWithAgency = {
  id: string;
  agencyId: string;
  name: string;
  stageName: string | null;
  birthdate: Date | null;
  mbti: string | null;
  bio: string | null;
  heroImageUrl: string | null;
  heartCount: bigint;
  followCount: bigint;
  publishedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  agency: { name: string };
};

@Injectable()
export class PrismaAdminIdolRepository implements AdminIdolRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(opts: { take: number; skip: number; includeDeleted?: boolean }) {
    const where = opts.includeDeleted ? {} : { deletedAt: null };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.idol.findMany({
        where,
        orderBy: [{ deletedAt: 'asc' }, { createdAt: 'desc' }],
        take: opts.take,
        skip: opts.skip,
        select: ADMIN_IDOL_SELECT,
      }),
      this.prisma.idol.count({ where }),
    ]);
    return { items: rows.map((r) => this.toRecord(r)), total };
  }

  async getListIdentity(opts: { includeDeleted?: boolean }): Promise<{ total: number; maxUpdatedAt: Date | null }> {
    const where = opts.includeDeleted ? {} : { deletedAt: null };
    const [total, agg] = await this.prisma.$transaction([
      this.prisma.idol.count({ where }),
      this.prisma.idol.aggregate({ where, _max: { updatedAt: true } }),
    ]);
    return { total, maxUpdatedAt: agg._max.updatedAt ?? null };
  }

  async findById(id: string, includeDeleted = false): Promise<AdminIdolRecord | null> {
    const where = includeDeleted ? { id } : { id, deletedAt: null };
    const row = await this.prisma.idol.findFirst({
      where,
      select: ADMIN_IDOL_SELECT,
    });
    return row ? this.toRecord(row) : null;
  }

  async create(input: {
    agencyId: string;
    name: string;
    stageName: string | null;
    mbti: string | null;
    bio: string | null;
    heroImageUrl: string | null;
    birthdate: Date | null;
    publishImmediately: boolean;
  }): Promise<AdminIdolRecord> {
    const row = await this.prisma.idol.create({
      data: {
        agencyId: input.agencyId,
        name: input.name,
        stageName: input.stageName,
        mbti: input.mbti,
        bio: input.bio,
        heroImageUrl: input.heroImageUrl,
        birthdate: input.birthdate,
        publishedAt: input.publishImmediately ? new Date() : null,
        // A fan club is created alongside every idol — the mobile fan club
        // flow assumes one exists per idol (T-022). Free tier by default.
        fanClub: { create: { tier: 'official', price: 0 } },
      },
      select: ADMIN_IDOL_SELECT,
    });
    return this.toRecord(row);
  }

  async update(
    id: string,
    patch: {
      name?: string;
      stageName?: string | null;
      mbti?: string | null;
      bio?: string | null;
      heroImageUrl?: string | null;
      birthdate?: Date | null;
      agencyId?: string;
    },
  ): Promise<AdminIdolRecord> {
    const row = await this.prisma.idol.update({
      where: { id },
      data: {
        name: patch.name,
        stageName: patch.stageName === undefined ? undefined : patch.stageName,
        mbti: patch.mbti === undefined ? undefined : patch.mbti,
        bio: patch.bio === undefined ? undefined : patch.bio,
        heroImageUrl: patch.heroImageUrl === undefined ? undefined : patch.heroImageUrl,
        birthdate: patch.birthdate === undefined ? undefined : patch.birthdate,
        agencyId: patch.agencyId,
      },
      select: ADMIN_IDOL_SELECT,
    });
    return this.toRecord(row);
  }

  async setPublished(id: string, publishedAt: Date | null): Promise<AdminIdolRecord> {
    const row = await this.prisma.idol.update({
      where: { id },
      data: { publishedAt },
      select: ADMIN_IDOL_SELECT,
    });
    return this.toRecord(row);
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.idol.update({
      where: { id },
      data: { deletedAt: new Date(), publishedAt: null },
    });
  }

  private toRecord(row: IdolWithAgency): AdminIdolRecord {
    return {
      id: row.id,
      agencyId: row.agencyId,
      agencyName: row.agency.name,
      name: row.name,
      stageName: row.stageName,
      birthdate: row.birthdate,
      mbti: row.mbti,
      bio: row.bio,
      heroImageUrl: row.heroImageUrl,
      heartCount: Number(row.heartCount),
      followCount: Number(row.followCount),
      publishedAt: row.publishedAt,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
