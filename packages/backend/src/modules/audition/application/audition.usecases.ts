import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { AuditionStatus } from '@a-idol/shared';
import {
  assertAuditionDateRange,
  assertAuditionTransition,
} from '../domain/audition';
import type {
  AuditionDetailRecord,
  AuditionEntryRecord,
  AuditionEntryRepository,
  AuditionListItem,
  AuditionRecord,
  AuditionRepository,
} from './interfaces';
import {
  AUDITION_ENTRY_REPOSITORY,
  AUDITION_REPOSITORY,
} from './interfaces';
import type { AdminIdolRepository } from '../../catalog/application/admin-interfaces';
import { ADMIN_IDOL_REPOSITORY } from '../../catalog/application/admin-interfaces';

@Injectable()
export class CreateAuditionUseCase {
  constructor(
    @Inject(AUDITION_REPOSITORY) private readonly repo: AuditionRepository,
    @Inject(AUDITION_ENTRY_REPOSITORY)
    private readonly entries: AuditionEntryRepository,
    @Inject(ADMIN_IDOL_REPOSITORY) private readonly idols: AdminIdolRepository,
  ) {}

  async execute(input: {
    name: string;
    description?: string | null;
    startAt: string;
    endAt: string;
    idolIds?: string[];
    createdBy: string;
  }): Promise<AuditionRecord> {
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    assertAuditionDateRange(startAt, endAt);

    // Verify all supplied idols exist (fail fast, no partial write).
    if (input.idolIds && input.idolIds.length > 0) {
      for (const idolId of input.idolIds) {
        const idol = await this.idols.findById(idolId);
        if (!idol) {
          throw new DomainError(
            ErrorCodes.IDOL_NOT_FOUND,
            `Idol ${idolId} not found`,
          );
        }
      }
    }

    const record = await this.repo.create({
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      startAt,
      endAt,
      createdBy: input.createdBy,
    });

    if (input.idolIds && input.idolIds.length > 0) {
      await this.entries.addMany(record.id, input.idolIds);
    }

    return record;
  }
}

@Injectable()
export class ListAuditionsUseCase {
  constructor(
    @Inject(AUDITION_REPOSITORY) private readonly repo: AuditionRepository,
  ) {}

  executeAdmin(): Promise<AuditionListItem[]> {
    return this.repo.listAdmin();
  }

  executePublic(): Promise<AuditionListItem[]> {
    return this.repo.listActive();
  }

  /** SCR-012 — public 지난 오디션 목록 (FINISHED). */
  executeFinished(): Promise<AuditionListItem[]> {
    return this.repo.listFinished();
  }
}

@Injectable()
export class GetAuditionUseCase {
  constructor(
    @Inject(AUDITION_REPOSITORY) private readonly repo: AuditionRepository,
  ) {}

  async execute(id: string, opts: { publicOnly?: boolean } = {}): Promise<AuditionDetailRecord> {
    const record = await this.repo.findDetail(id);
    if (!record || record.deletedAt) {
      throw new DomainError(ErrorCodes.AUDITION_NOT_FOUND, 'Audition not found');
    }
    // SCR-012 — public read는 ACTIVE + FINISHED 둘 다 허용 (지난 오디션 결과
    // 페이지). DRAFT / CANCELED 는 admin만.
    if (opts.publicOnly && record.status !== 'ACTIVE' && record.status !== 'FINISHED') {
      throw new DomainError(ErrorCodes.AUDITION_NOT_FOUND, 'Audition not found');
    }
    return record;
  }
}

@Injectable()
export class UpdateAuditionUseCase {
  constructor(
    @Inject(AUDITION_REPOSITORY) private readonly repo: AuditionRepository,
  ) {}

  async execute(
    id: string,
    patch: {
      name?: string;
      description?: string | null;
      startAt?: string;
      endAt?: string;
    },
  ): Promise<AuditionRecord> {
    const existing = await this.repo.findById(id);
    if (!existing || existing.deletedAt) {
      throw new DomainError(ErrorCodes.AUDITION_NOT_FOUND, 'Audition not found');
    }
    if (existing.status !== 'DRAFT' && existing.status !== 'ACTIVE') {
      throw new DomainError(
        ErrorCodes.AUDITION_INVALID_TRANSITION,
        'Cannot edit a finished or canceled audition',
      );
    }

    const startAt = patch.startAt ? new Date(patch.startAt) : existing.startAt;
    const endAt = patch.endAt ? new Date(patch.endAt) : existing.endAt;
    assertAuditionDateRange(startAt, endAt);

    return this.repo.update(id, {
      name: patch.name?.trim(),
      description:
        patch.description === undefined ? undefined : patch.description?.trim() ?? null,
      startAt: patch.startAt ? startAt : undefined,
      endAt: patch.endAt ? endAt : undefined,
    });
  }
}

@Injectable()
export class TransitionAuditionUseCase {
  constructor(
    @Inject(AUDITION_REPOSITORY) private readonly repo: AuditionRepository,
  ) {}

  async execute(id: string, target: AuditionStatus): Promise<AuditionRecord> {
    const existing = await this.repo.findById(id);
    if (!existing || existing.deletedAt) {
      throw new DomainError(ErrorCodes.AUDITION_NOT_FOUND, 'Audition not found');
    }
    assertAuditionTransition(existing.status, target);
    return this.repo.setStatus(id, target);
  }
}

@Injectable()
export class DeleteAuditionUseCase {
  constructor(
    @Inject(AUDITION_REPOSITORY) private readonly repo: AuditionRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing || existing.deletedAt) {
      throw new DomainError(ErrorCodes.AUDITION_NOT_FOUND, 'Audition not found');
    }
    if (existing.status !== 'DRAFT') {
      throw new DomainError(
        ErrorCodes.AUDITION_MUST_BE_DRAFT,
        'Only DRAFT auditions can be deleted',
      );
    }
    await this.repo.softDelete(id);
  }
}

@Injectable()
export class AddEntriesUseCase {
  constructor(
    @Inject(AUDITION_REPOSITORY) private readonly repo: AuditionRepository,
    @Inject(AUDITION_ENTRY_REPOSITORY)
    private readonly entries: AuditionEntryRepository,
    @Inject(ADMIN_IDOL_REPOSITORY) private readonly idols: AdminIdolRepository,
  ) {}

  async execute(auditionId: string, idolIds: string[]): Promise<AuditionEntryRecord[]> {
    const audition = await this.repo.findById(auditionId);
    if (!audition || audition.deletedAt) {
      throw new DomainError(ErrorCodes.AUDITION_NOT_FOUND, 'Audition not found');
    }
    // Only DRAFT allows bulk add; once ACTIVE it should require stricter UX.
    if (audition.status !== 'DRAFT' && audition.status !== 'ACTIVE') {
      throw new DomainError(
        ErrorCodes.AUDITION_INVALID_TRANSITION,
        'Cannot add entries to a finished or canceled audition',
      );
    }
    for (const idolId of idolIds) {
      const idol = await this.idols.findById(idolId);
      if (!idol) {
        throw new DomainError(
          ErrorCodes.IDOL_NOT_FOUND,
          `Idol ${idolId} not found`,
        );
      }
    }
    const added = await this.entries.addMany(auditionId, idolIds);
    // ADR-021: entry count is part of /auditions/:id ETag — bump parent.
    await this.repo.touchUpdatedAt(auditionId);
    return added;
  }
}

@Injectable()
export class RemoveEntryUseCase {
  constructor(
    @Inject(AUDITION_REPOSITORY) private readonly repo: AuditionRepository,
    @Inject(AUDITION_ENTRY_REPOSITORY)
    private readonly entries: AuditionEntryRepository,
  ) {}

  async execute(auditionId: string, idolId: string): Promise<void> {
    const audition = await this.repo.findById(auditionId);
    if (!audition || audition.deletedAt) {
      throw new DomainError(ErrorCodes.AUDITION_NOT_FOUND, 'Audition not found');
    }
    if (audition.status !== 'DRAFT') {
      throw new DomainError(
        ErrorCodes.AUDITION_MUST_BE_DRAFT,
        'Can only remove entries while the audition is DRAFT',
      );
    }
    await this.entries.remove(auditionId, idolId);
    await this.repo.touchUpdatedAt(auditionId);
  }
}
