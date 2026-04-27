import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type {
  AdminIdolRecord,
  AdminIdolRepository,
  AgencyRepository,
} from './admin-interfaces';
import { ADMIN_IDOL_REPOSITORY, AGENCY_REPOSITORY } from './admin-interfaces';
import type { IdolMetaCache } from './idol-meta-cache.interface';
import { IDOL_META_CACHE } from './idol-meta-cache.interface';

@Injectable()
export class ListAllIdolsUseCase {
  constructor(@Inject(ADMIN_IDOL_REPOSITORY) private readonly repo: AdminIdolRepository) {}

  async execute(opts: { page: number; size: number; includeDeleted?: boolean }) {
    const page = Math.max(opts.page, 1);
    const size = Math.min(Math.max(opts.size, 1), 200);
    const { items, total } = await this.repo.listAll({
      take: size,
      skip: (page - 1) * size,
      includeDeleted: opts.includeDeleted,
    });
    const nextCursor = page * size < total ? String(page + 1) : null;
    return { items, total, nextCursor };
  }

  getIdentity(opts: { includeDeleted?: boolean }) {
    return this.repo.getListIdentity(opts);
  }
}

@Injectable()
export class GetAdminIdolUseCase {
  constructor(@Inject(ADMIN_IDOL_REPOSITORY) private readonly repo: AdminIdolRepository) {}

  async execute(id: string): Promise<AdminIdolRecord> {
    const row = await this.repo.findById(id, /* includeDeleted */ true);
    if (!row) throw new DomainError(ErrorCodes.IDOL_NOT_FOUND, 'Idol not found');
    return row;
  }
}

@Injectable()
export class UpdateIdolUseCase {
  constructor(
    @Inject(ADMIN_IDOL_REPOSITORY) private readonly repo: AdminIdolRepository,
    @Inject(AGENCY_REPOSITORY) private readonly agencies: AgencyRepository,
    @Inject(IDOL_META_CACHE) private readonly cache: IdolMetaCache,
  ) {}

  async execute(
    id: string,
    patch: {
      name?: string;
      stageName?: string | null;
      mbti?: string | null;
      bio?: string | null;
      heroImageUrl?: string | null;
      birthdate?: string | null;
      agencyId?: string;
    },
  ): Promise<AdminIdolRecord> {
    const existing = await this.repo.findById(id, /* includeDeleted */ true);
    if (!existing) throw new DomainError(ErrorCodes.IDOL_NOT_FOUND, 'Idol not found');

    if (patch.agencyId && patch.agencyId !== existing.agencyId) {
      const agency = await this.agencies.findById(patch.agencyId);
      if (!agency) throw new DomainError(ErrorCodes.AGENCY_NOT_FOUND, 'Target agency not found');
    }

    const updated = await this.repo.update(id, {
      name: patch.name?.trim(),
      stageName:
        patch.stageName === undefined ? undefined : patch.stageName?.trim() ?? null,
      mbti:
        patch.mbti === undefined
          ? undefined
          : patch.mbti?.trim().toUpperCase().slice(0, 4) || null,
      bio: patch.bio === undefined ? undefined : patch.bio?.trim() || null,
      heroImageUrl:
        patch.heroImageUrl === undefined ? undefined : patch.heroImageUrl?.trim() || null,
      birthdate:
        patch.birthdate === undefined
          ? undefined
          : patch.birthdate
            ? new Date(patch.birthdate)
            : null,
      agencyId: patch.agencyId,
    });
    // Write-through invalidation — the cached leaderboard hydration meta
    // (name / stageName / heroImageUrl) could be stale now. Without this
    // the staleness cap falls back to TTL (5 min). Invalidate unconditionally
    // since even patches that only touched bio are cheap to re-fetch, and
    // filtering by "did name change?" adds branching with little payoff.
    await this.cache.invalidate([id]);
    return updated;
  }
}

@Injectable()
export class PublishIdolUseCase {
  constructor(@Inject(ADMIN_IDOL_REPOSITORY) private readonly repo: AdminIdolRepository) {}

  async execute(id: string): Promise<AdminIdolRecord> {
    const existing = await this.repo.findById(id, /* includeDeleted */ true);
    if (!existing) throw new DomainError(ErrorCodes.IDOL_NOT_FOUND, 'Idol not found');
    return this.repo.setPublished(id, new Date());
  }
}

@Injectable()
export class UnpublishIdolUseCase {
  constructor(@Inject(ADMIN_IDOL_REPOSITORY) private readonly repo: AdminIdolRepository) {}

  async execute(id: string): Promise<AdminIdolRecord> {
    const existing = await this.repo.findById(id, /* includeDeleted */ true);
    if (!existing) throw new DomainError(ErrorCodes.IDOL_NOT_FOUND, 'Idol not found');
    return this.repo.setPublished(id, null);
  }
}

@Injectable()
export class SoftDeleteIdolUseCase {
  constructor(
    @Inject(ADMIN_IDOL_REPOSITORY) private readonly repo: AdminIdolRepository,
    @Inject(IDOL_META_CACHE) private readonly cache: IdolMetaCache,
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.repo.findById(id, /* includeDeleted */ true);
    if (!existing) throw new DomainError(ErrorCodes.IDOL_NOT_FOUND, 'Idol not found');
    await this.repo.softDelete(id);
    // Without invalidation, a lingering leaderboard entry (ZSET score from
    // before deletion) would still hydrate to the old name instead of
    // falling back to "(deleted)". Invalidate so the next /leaderboard hit
    // sees a cache miss → Prisma miss (deletedAt filter) → "(deleted)".
    await this.cache.invalidate([id]);
  }
}
