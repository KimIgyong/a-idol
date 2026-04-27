import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { RoundStatus } from '@a-idol/shared';
import { assertRoundTransition } from '../domain/round';
import type {
  AuditionRepository,
  RoundRecord,
  RoundRepository,
} from './interfaces';
import { AUDITION_REPOSITORY, ROUND_REPOSITORY } from './interfaces';
import { AUDITION_EVENTS, type RoundClosedEvent } from './events';

@Injectable()
export class CreateRoundUseCase {
  constructor(
    @Inject(AUDITION_REPOSITORY) private readonly auditions: AuditionRepository,
    @Inject(ROUND_REPOSITORY) private readonly rounds: RoundRepository,
  ) {}

  async execute(
    auditionId: string,
    input: {
      name: string;
      orderIndex: number;
      startAt: string;
      endAt: string;
      maxAdvancers?: number | null;
    },
  ): Promise<RoundRecord> {
    const audition = await this.auditions.findById(auditionId);
    if (!audition || audition.deletedAt) {
      throw new DomainError(ErrorCodes.AUDITION_NOT_FOUND, 'Audition not found');
    }
    if (audition.status !== 'DRAFT' && audition.status !== 'ACTIVE') {
      throw new DomainError(
        ErrorCodes.AUDITION_INVALID_TRANSITION,
        'Cannot add rounds to a finished or canceled audition',
      );
    }
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    if (endAt.getTime() <= startAt.getTime()) {
      throw new DomainError(
        ErrorCodes.AUDITION_INVALID_DATE_RANGE,
        'Round endAt must be after startAt',
      );
    }

    const created = await this.rounds.create({
      auditionId,
      name: input.name.trim(),
      orderIndex: input.orderIndex,
      startAt,
      endAt,
      maxAdvancers: input.maxAdvancers ?? null,
    });
    // ADR-021: propagate child-table change to parent audition so
    // /auditions/:id ETag invalidates. Fire-and-forget would be
    // acceptable here; we await for test determinism.
    await this.auditions.touchUpdatedAt(auditionId);
    return created;
  }
}

@Injectable()
export class UpdateRoundUseCase {
  constructor(
    @Inject(AUDITION_REPOSITORY) private readonly auditions: AuditionRepository,
    @Inject(ROUND_REPOSITORY) private readonly rounds: RoundRepository,
  ) {}

  async execute(
    id: string,
    patch: {
      name?: string;
      orderIndex?: number;
      startAt?: string;
      endAt?: string;
      maxAdvancers?: number | null;
    },
  ): Promise<RoundRecord> {
    const existing = await this.rounds.findById(id);
    if (!existing) {
      throw new DomainError(ErrorCodes.ROUND_NOT_FOUND, 'Round not found');
    }
    if (existing.status !== 'SCHEDULED') {
      throw new DomainError(
        ErrorCodes.ROUND_INVALID_TRANSITION,
        'Only SCHEDULED rounds can be edited',
      );
    }
    const startAt = patch.startAt ? new Date(patch.startAt) : existing.startAt;
    const endAt = patch.endAt ? new Date(patch.endAt) : existing.endAt;
    if (endAt.getTime() <= startAt.getTime()) {
      throw new DomainError(
        ErrorCodes.AUDITION_INVALID_DATE_RANGE,
        'endAt must be after startAt',
      );
    }

    const updated = await this.rounds.update(id, {
      name: patch.name?.trim(),
      orderIndex: patch.orderIndex,
      startAt: patch.startAt ? startAt : undefined,
      endAt: patch.endAt ? endAt : undefined,
      maxAdvancers:
        patch.maxAdvancers === undefined ? undefined : patch.maxAdvancers,
    });
    await this.auditions.touchUpdatedAt(existing.auditionId);
    return updated;
  }
}

@Injectable()
export class TransitionRoundUseCase {
  constructor(
    @Inject(AUDITION_REPOSITORY) private readonly auditions: AuditionRepository,
    @Inject(ROUND_REPOSITORY) private readonly rounds: RoundRepository,
    private readonly events: EventEmitter2,
  ) {}

  async execute(id: string, target: RoundStatus): Promise<RoundRecord> {
    const existing = await this.rounds.findById(id);
    if (!existing) {
      throw new DomainError(ErrorCodes.ROUND_NOT_FOUND, 'Round not found');
    }
    assertRoundTransition(existing.status, target);

    if (target === 'ACTIVE') {
      const audition = await this.auditions.findById(existing.auditionId);
      if (!audition || audition.status !== 'ACTIVE') {
        throw new DomainError(
          ErrorCodes.AUDITION_NOT_ACTIVE,
          'Parent audition must be ACTIVE before activating a round',
        );
      }
    }

    const updated = await this.rounds.setStatus(id, target);
    // ADR-021: any round status transition invalidates the parent audition
    // detail ETag. Activate/close/any future transition included.
    await this.auditions.touchUpdatedAt(existing.auditionId);

    if (target === 'CLOSED') {
      // ADR-014 follow-up: VoteModule listens for this and writes the final
      // Redis → Postgres snapshot so we have a durable end-of-round ranking.
      const evt: RoundClosedEvent = {
        roundId: updated.id,
        auditionId: updated.auditionId,
        closedAt: new Date(),
      };
      this.events.emit(AUDITION_EVENTS.ROUND_CLOSED, evt);
    }
    return updated;
  }
}

@Injectable()
export class DeleteRoundUseCase {
  constructor(
    @Inject(AUDITION_REPOSITORY) private readonly auditions: AuditionRepository,
    @Inject(ROUND_REPOSITORY) private readonly rounds: RoundRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.rounds.findById(id);
    if (!existing) {
      throw new DomainError(ErrorCodes.ROUND_NOT_FOUND, 'Round not found');
    }
    if (existing.status !== 'SCHEDULED') {
      throw new DomainError(
        ErrorCodes.ROUND_INVALID_TRANSITION,
        'Only SCHEDULED rounds can be deleted',
      );
    }
    await this.rounds.delete(id);
    await this.auditions.touchUpdatedAt(existing.auditionId);
  }
}
