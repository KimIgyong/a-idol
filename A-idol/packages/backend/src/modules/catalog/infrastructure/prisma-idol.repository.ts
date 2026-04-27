import { Injectable } from '@nestjs/common';
import { Idol } from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { IdolRepository } from '../application/list-idols.usecase';

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
      this.prisma.idol.findMany({ where, orderBy, take: opts.take, skip: opts.skip }),
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
}
