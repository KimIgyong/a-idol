import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type {
  AdminIdolRecord,
  AdminIdolRepository,
  AgencyRepository,
} from './admin-interfaces';
import { ADMIN_IDOL_REPOSITORY, AGENCY_REPOSITORY } from './admin-interfaces';

@Injectable()
export class CreateIdolUseCase {
  constructor(
    @Inject(ADMIN_IDOL_REPOSITORY) private readonly repo: AdminIdolRepository,
    @Inject(AGENCY_REPOSITORY) private readonly agencies: AgencyRepository,
  ) {}

  async execute(input: {
    agencyId: string;
    name: string;
    stageName?: string | null;
    mbti?: string | null;
    bio?: string | null;
    heroImageUrl?: string | null;
    birthdate?: string | null;
    publishImmediately?: boolean;
  }): Promise<AdminIdolRecord> {
    const agency = await this.agencies.findById(input.agencyId);
    if (!agency) throw new DomainError(ErrorCodes.AGENCY_NOT_FOUND, 'Agency not found');

    return this.repo.create({
      agencyId: input.agencyId,
      name: input.name.trim(),
      stageName: input.stageName?.trim() || null,
      mbti: input.mbti?.trim().toUpperCase().slice(0, 4) || null,
      bio: input.bio?.trim() || null,
      heroImageUrl: input.heroImageUrl?.trim() || null,
      birthdate: input.birthdate ? new Date(input.birthdate) : null,
      publishImmediately: !!input.publishImmediately,
    });
  }
}
