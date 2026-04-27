import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { AgencyRecord, AgencyRepository } from './admin-interfaces';
import { AGENCY_REPOSITORY } from './admin-interfaces';

@Injectable()
export class ListAgenciesUseCase {
  constructor(@Inject(AGENCY_REPOSITORY) private readonly repo: AgencyRepository) {}

  execute(): Promise<AgencyRecord[]> {
    return this.repo.list();
  }
}

@Injectable()
export class CreateAgencyUseCase {
  constructor(@Inject(AGENCY_REPOSITORY) private readonly repo: AgencyRepository) {}

  execute(input: { name: string; description?: string | null }): Promise<AgencyRecord> {
    return this.repo.create({
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
    });
  }
}

@Injectable()
export class UpdateAgencyUseCase {
  constructor(@Inject(AGENCY_REPOSITORY) private readonly repo: AgencyRepository) {}

  async execute(
    id: string,
    patch: { name?: string; description?: string | null },
  ): Promise<AgencyRecord> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new DomainError(ErrorCodes.AGENCY_NOT_FOUND, 'Agency not found');
    return this.repo.update(id, {
      name: patch.name?.trim(),
      description: patch.description === undefined ? undefined : patch.description?.trim() ?? null,
    });
  }
}

@Injectable()
export class DeleteAgencyUseCase {
  constructor(@Inject(AGENCY_REPOSITORY) private readonly repo: AgencyRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new DomainError(ErrorCodes.AGENCY_NOT_FOUND, 'Agency not found');
    if (existing.idolCount > 0) {
      throw new DomainError(
        ErrorCodes.AGENCY_HAS_IDOLS,
        'Cannot delete an agency that still has idols assigned',
        { idolCount: existing.idolCount },
      );
    }
    await this.repo.softDelete(id);
  }
}
