import type {
  PhotocardSetDto,
  PhotocardSetListItemDto,
  PhotocardTemplateDto,
  UserPhotocardDto,
} from '@a-idol/shared';
import type {
  PhotocardSetRecord,
  PhotocardTemplateRecord,
  UserPhotocardRecord,
} from '../../application/interfaces';

/**
 * Compute `dropPercent` server-side from `dropWeight` across the active
 * templates in a set. Single source of truth — clients never compute their
 * own. See ADR-016.
 */
export function computeDropPercents(
  templates: PhotocardTemplateRecord[],
): Map<string, number> {
  const activeTotal = templates.reduce(
    (acc, t) => acc + (t.isActive && t.dropWeight > 0 ? t.dropWeight : 0),
    0,
  );
  const out = new Map<string, number>();
  for (const t of templates) {
    const raw =
      activeTotal > 0 && t.isActive && t.dropWeight > 0
        ? (t.dropWeight / activeTotal) * 100
        : 0;
    out.set(t.id, Math.round(raw * 100) / 100);
  }
  return out;
}

export function toTemplateDto(
  r: PhotocardTemplateRecord,
  dropPercent: number,
): PhotocardTemplateDto {
  return {
    id: r.id,
    setId: r.setId,
    name: r.name,
    imageUrl: r.imageUrl,
    rarity: r.rarity,
    dropWeight: r.dropWeight,
    dropPercent,
    isActive: r.isActive,
  };
}

export function toSetDto(r: PhotocardSetRecord): PhotocardSetDto {
  const percents = computeDropPercents(r.templates);
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    idolId: r.idolId,
    idolName: r.idolName,
    isActive: r.isActive,
    templateCount: r.templates.length,
    templates: r.templates.map((t) => toTemplateDto(t, percents.get(t.id) ?? 0)),
  };
}

export function toSetListItemDto(r: PhotocardSetRecord): PhotocardSetListItemDto {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    idolId: r.idolId,
    idolName: r.idolName,
    isActive: r.isActive,
    templateCount: r.templates.length,
  };
}

export function toUserPhotocardDto(r: UserPhotocardRecord): UserPhotocardDto {
  return {
    templateId: r.templateId,
    name: r.templateName,
    imageUrl: r.imageUrl,
    rarity: r.rarity,
    setId: r.setId,
    setName: r.setName,
    count: r.count,
    firstObtainedAt: r.firstObtainedAt.toISOString(),
    lastObtainedAt: r.lastObtainedAt.toISOString(),
  };
}
