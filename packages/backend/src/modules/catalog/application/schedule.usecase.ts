import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type {
  AdminIdolRepository,
  IdolScheduleRecord,
  IdolScheduleRepository,
  IdolScheduleType,
} from './admin-interfaces';
import {
  ADMIN_IDOL_REPOSITORY,
  IDOL_SCHEDULE_REPOSITORY,
} from './admin-interfaces';

@Injectable()
export class ListSchedulesUseCase {
  constructor(
    @Inject(IDOL_SCHEDULE_REPOSITORY) private readonly repo: IdolScheduleRepository,
    @Inject(ADMIN_IDOL_REPOSITORY) private readonly idols: AdminIdolRepository,
  ) {}

  async execute(idolId: string): Promise<IdolScheduleRecord[]> {
    const idol = await this.idols.findById(idolId, /* includeDeleted */ true);
    if (!idol) throw new DomainError(ErrorCodes.IDOL_NOT_FOUND, 'Idol not found');
    return this.repo.listByIdol(idolId);
  }
}

@Injectable()
export class CreateScheduleUseCase {
  constructor(
    @Inject(IDOL_SCHEDULE_REPOSITORY) private readonly repo: IdolScheduleRepository,
    @Inject(ADMIN_IDOL_REPOSITORY) private readonly idols: AdminIdolRepository,
  ) {}

  async execute(
    idolId: string,
    input: {
      type?: IdolScheduleType;
      title: string;
      location?: string | null;
      startAt: string;
      endAt?: string | null;
      notes?: string | null;
    },
  ): Promise<IdolScheduleRecord> {
    const idol = await this.idols.findById(idolId, /* includeDeleted */ true);
    if (!idol) throw new DomainError(ErrorCodes.IDOL_NOT_FOUND, 'Idol not found');

    const startAt = new Date(input.startAt);
    const endAt = input.endAt ? new Date(input.endAt) : null;
    if (endAt && endAt.getTime() < startAt.getTime()) {
      throw new DomainError('INVALID_SCHEDULE_RANGE', 'endAt must be after startAt');
    }

    return this.repo.create({
      idolId,
      type: input.type ?? 'OTHER',
      title: input.title.trim(),
      location: input.location?.trim() || null,
      startAt,
      endAt,
      notes: input.notes?.trim() || null,
    });
  }
}

@Injectable()
export class DeleteScheduleUseCase {
  constructor(
    @Inject(IDOL_SCHEDULE_REPOSITORY) private readonly repo: IdolScheduleRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      // Soft 404 — let controller surface as 404 via DomainError.
      throw new DomainError('SCHEDULE_NOT_FOUND', 'Schedule not found');
    }
    await this.repo.softDelete(id);
  }
}
