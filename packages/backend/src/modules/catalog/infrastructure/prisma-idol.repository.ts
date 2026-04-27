import { Injectable } from '@nestjs/common';
import { Idol } from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { IdolDetailRow, IdolRepository } from '../application/list-idols.usecase';

@Injectable()
export class PrismaIdolRepository implements IdolRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(opts: { take: number; skip: number; sort: 'popularity' | 'name' | 'new' }) {
    const orderBy =
      opts.sort === 'name'
        ? { name: 'asc' as const }
        : opts.sort === 'new'
          ? { publishedAt: 'desc' as const }
          : { heartCount: 'desc' as const };

    const where = {
      deletedAt: null,
      publishedAt: { lte: new Date() },
    } as const;

    const [rows, total] = await this.prisma.$transaction([
      // `select` trims the JSONB `profileJson` (per-idol AI persona, often
      // 10+ KB) and other unused columns from the transport → ~70% payload
      // drop on top of gzip compression. See docs/ops/perf-baseline-ko.md
      // 2026-04-23 re-measurement.
      this.prisma.idol.findMany({
        where,
        orderBy,
        take: opts.take,
        skip: opts.skip,
        select: {
          id: true,
          agencyId: true,
          name: true,
          stageName: true,
          mbti: true,
          bio: true,
          heroImageUrl: true,
          heartCount: true,
          followCount: true,
          publishedAt: true,
        },
      }),
      this.prisma.idol.count({ where }),
    ]);

    const items = rows.map(
      (r) =>
        new Idol({
          id: r.id,
          agencyId: r.agencyId,
          name: r.name,
          stageName: r.stageName,
          mbti: r.mbti,
          bio: r.bio,
          heroImageUrl: r.heroImageUrl,
          heartCount: Number(r.heartCount),
          followCount: Number(r.followCount),
          publishedAt: r.publishedAt,
        }),
    );
    return { items, total };
  }

  async getListIdentity(): Promise<{ total: number; maxUpdatedAt: Date | null }> {
    // Same filter as listPublished — otherwise an unpublished edit would
    // invalidate caches for a dataset it isn't part of.
    const where = {
      deletedAt: null,
      publishedAt: { lte: new Date() },
    } as const;
    const [total, agg] = await this.prisma.$transaction([
      this.prisma.idol.count({ where }),
      this.prisma.idol.aggregate({ where, _max: { updatedAt: true } }),
    ]);
    return { total, maxUpdatedAt: agg._max.updatedAt ?? null };
  }

  async findByIdWithDetail(id: string): Promise<IdolDetailRow | null> {
    const row = await this.prisma.idol.findFirst({
      where: { id, deletedAt: null, publishedAt: { lte: new Date() } },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!row) return null;
    return {
      idol: new Idol({
        id: row.id,
        agencyId: row.agencyId,
        name: row.name,
        stageName: row.stageName,
        mbti: row.mbti,
        bio: row.bio,
        heroImageUrl: row.heroImageUrl,
        heartCount: Number(row.heartCount),
        followCount: Number(row.followCount),
        publishedAt: row.publishedAt,
      }),
      birthdate: row.birthdate,
      mbti: row.mbti,
      bio: row.bio,
      profile: row.profileJson ?? null,
      images: row.images.map((img) => ({
        id: img.id,
        imageType: img.imageType,
        imageUrl: img.imageUrl,
        sortOrder: img.sortOrder,
        isApproved: img.isApproved,
      })),
      updatedAt: row.updatedAt,
    };
  }
}
