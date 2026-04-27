import { Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { PhotocardRarity, PhotocardSource } from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  GrantResult,
  PhotocardRepository,
  PhotocardSetRecord,
  PhotocardTemplateRecord,
  UserPhotocardRecord,
} from '../application/interfaces';

type TemplateRow = {
  id: string;
  setId: string;
  name: string;
  imageUrl: string | null;
  rarity: PhotocardRarity;
  dropWeight: number;
  isActive: boolean;
};

@Injectable()
export class PrismaPhotocardRepository implements PhotocardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listSets(opts: { activeOnly: boolean }): Promise<PhotocardSetRecord[]> {
    const rows = await this.prisma.photocardSet.findMany({
      where: opts.activeOnly ? { isActive: true } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        idol: { select: { name: true, stageName: true } },
        templates: true,
      },
    });
    return rows.map((r) => this.toSetRecord(r));
  }

  async findSetById(id: string): Promise<PhotocardSetRecord | null> {
    const row = await this.prisma.photocardSet.findUnique({
      where: { id },
      include: {
        idol: { select: { name: true, stageName: true } },
        templates: true,
      },
    });
    return row ? this.toSetRecord(row) : null;
  }

  async createSet(input: {
    name: string;
    description: string | null;
    idolId: string | null;
  }): Promise<PhotocardSetRecord> {
    const row = await this.prisma.photocardSet.create({
      data: {
        name: input.name,
        description: input.description,
        idolId: input.idolId,
      },
      include: {
        idol: { select: { name: true, stageName: true } },
        templates: true,
      },
    });
    return this.toSetRecord(row);
  }

  async updateSet(
    id: string,
    patch: {
      name?: string;
      description?: string | null;
      idolId?: string | null;
      isActive?: boolean;
    },
  ): Promise<PhotocardSetRecord> {
    const row = await this.prisma.photocardSet.update({
      where: { id },
      data: patch,
      include: {
        idol: { select: { name: true, stageName: true } },
        templates: true,
      },
    });
    return this.toSetRecord(row);
  }

  async addTemplate(
    setId: string,
    input: {
      name: string;
      imageUrl: string | null;
      rarity: PhotocardRarity;
      dropWeight: number;
    },
  ): Promise<PhotocardTemplateRecord> {
    const set = await this.prisma.photocardSet.findUnique({ where: { id: setId } });
    if (!set) throw new DomainError(ErrorCodes.PHOTOCARD_SET_NOT_FOUND, 'Set not found');
    const row = await this.prisma.photocardTemplate.create({
      data: {
        setId,
        name: input.name,
        imageUrl: input.imageUrl,
        rarity: input.rarity,
        dropWeight: input.dropWeight,
      },
    });
    return this.toTemplate(row);
  }

  async grantFromSet(input: {
    userId: string;
    setId: string;
    count: number;
    source: PhotocardSource;
    sourceRef: string | null;
    rng?: () => number;
  }): Promise<GrantResult> {
    const rng = input.rng ?? Math.random;
    return this.prisma.$transaction(async (tx) => {
      const set = await tx.photocardSet.findUnique({ where: { id: input.setId } });
      if (!set || !set.isActive) {
        throw new DomainError(ErrorCodes.PHOTOCARD_SET_NOT_FOUND, 'Set not found or inactive');
      }
      const templates = await tx.photocardTemplate.findMany({
        where: { setId: input.setId, isActive: true },
      });
      if (templates.length === 0) {
        throw new DomainError(
          ErrorCodes.PHOTOCARD_SET_EMPTY,
          `Set ${input.setId} has no active templates`,
        );
      }
      const picks = rollWeighted(templates, input.count, rng);
      const created = await Promise.all(
        picks.map((t) =>
          tx.userPhotocard.create({
            data: {
              userId: input.userId,
              templateId: t.id,
              source: input.source,
              sourceRef: input.sourceRef,
            },
            select: { templateId: true },
          }),
        ),
      );
      const granted = created.map((c) => {
        const t = picks.find((p) => p.id === c.templateId)!;
        return {
          templateId: t.id,
          templateName: t.name,
          rarity: t.rarity as PhotocardRarity,
        };
      });
      return { granted };
    });
  }

  async listUserInventory(userId: string, take: number): Promise<UserPhotocardRecord[]> {
    // Step 1: group by template — `take` now counts distinct templates, not
    // individual card rows, so a user with 30 copies of one card still has
    // 99 other slots. Sort by most-recently-acquired template (not first).
    const groups = await this.prisma.userPhotocard.groupBy({
      by: ['templateId'],
      where: { userId },
      _count: { _all: true },
      _min: { obtainedAt: true },
      _max: { obtainedAt: true },
      orderBy: { _max: { obtainedAt: 'desc' } },
      take,
    });
    if (groups.length === 0) return [];

    // Step 2: batch-load template + set metadata for the picked ids.
    const templates = await this.prisma.photocardTemplate.findMany({
      where: { id: { in: groups.map((g) => g.templateId) } },
      include: { set: { select: { id: true, name: true } } },
    });
    const byId = new Map(templates.map((t) => [t.id, t]));

    const out: UserPhotocardRecord[] = [];
    for (const g of groups) {
      const t = byId.get(g.templateId);
      if (!t || !g._min.obtainedAt || !g._max.obtainedAt) continue;
      out.push({
        templateId: g.templateId,
        templateName: t.name,
        imageUrl: t.imageUrl,
        rarity: t.rarity as PhotocardRarity,
        setId: t.set.id,
        setName: t.set.name,
        count: g._count._all,
        firstObtainedAt: g._min.obtainedAt,
        lastObtainedAt: g._max.obtainedAt,
      });
    }
    return out;
  }

  private toTemplate(row: TemplateRow): PhotocardTemplateRecord {
    return {
      id: row.id,
      setId: row.setId,
      name: row.name,
      imageUrl: row.imageUrl,
      rarity: row.rarity as PhotocardRarity,
      dropWeight: row.dropWeight,
      isActive: row.isActive,
    };
  }

  private toSetRecord(row: {
    id: string;
    name: string;
    description: string | null;
    idolId: string | null;
    isActive: boolean;
    idol: { name: string; stageName: string | null } | null;
    templates: TemplateRow[];
  }): PhotocardSetRecord {
    const idolName = row.idol ? row.idol.stageName ?? row.idol.name : null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      idolId: row.idolId,
      idolName,
      isActive: row.isActive,
      templates: row.templates.map((t) => this.toTemplate(t)),
    };
  }
}

/**
 * Weighted random pick with replacement: each draw builds a cumulative sum of
 * `dropWeight` across active templates and chooses by `rng() * total`.
 * Exported for unit tests.
 */
export function rollWeighted<T extends { id: string; dropWeight: number }>(
  templates: T[],
  count: number,
  rng: () => number,
): T[] {
  const total = templates.reduce((acc, t) => acc + Math.max(0, t.dropWeight), 0);
  if (total <= 0) {
    throw new DomainError(
      ErrorCodes.PHOTOCARD_SET_EMPTY,
      'Set has templates but all dropWeights are zero',
    );
  }
  const picks: T[] = [];
  for (let i = 0; i < count; i++) {
    let r = rng() * total;
    for (const t of templates) {
      r -= Math.max(0, t.dropWeight);
      if (r <= 0) {
        picks.push(t);
        break;
      }
    }
    // Safety: if rng returned exactly 1 and float precision drifted, fall back to last.
    if (picks.length !== i + 1) picks.push(templates[templates.length - 1]!);
  }
  return picks;
}
