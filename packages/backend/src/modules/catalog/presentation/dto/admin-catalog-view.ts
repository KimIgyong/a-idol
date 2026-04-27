import type { AdminIdolDto, AgencyDto } from '@a-idol/shared';
import type { AdminIdolRecord, AgencyRecord } from '../../application/admin-interfaces';

export function toAgencyDto(r: AgencyRecord): AgencyDto {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    idolCount: r.idolCount,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export function toAdminIdolDto(r: AdminIdolRecord): AdminIdolDto {
  return {
    id: r.id,
    agencyId: r.agencyId,
    agencyName: r.agencyName,
    name: r.name,
    stageName: r.stageName,
    birthdate: r.birthdate ? r.birthdate.toISOString().slice(0, 10) : null,
    mbti: r.mbti,
    bio: r.bio,
    heroImageUrl: r.heroImageUrl,
    heartCount: r.heartCount,
    followCount: r.followCount,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
