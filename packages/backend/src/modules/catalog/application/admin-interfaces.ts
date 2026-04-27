/**
 * Admin-only ports for the catalog context.
 * Mobile-facing read endpoints use the existing IdolRepository in list-idols.usecase.
 */

export interface AgencyRecord {
  id: string;
  name: string;
  description: string | null;
  idolCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgencyRepository {
  list(): Promise<AgencyRecord[]>;
  findById(id: string): Promise<AgencyRecord | null>;
  create(input: { name: string; description: string | null }): Promise<AgencyRecord>;
  update(id: string, patch: { name?: string; description?: string | null }): Promise<AgencyRecord>;
  softDelete(id: string): Promise<void>;
}

export interface AdminIdolRecord {
  id: string;
  agencyId: string;
  agencyName: string;
  name: string;
  stageName: string | null;
  birthdate: Date | null;
  mbti: string | null;
  bio: string | null;
  heroImageUrl: string | null;
  heartCount: number;
  followCount: number;
  publishedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminIdolRepository {
  listAll(opts: {
    take: number;
    skip: number;
    includeDeleted?: boolean;
  }): Promise<{ items: AdminIdolRecord[]; total: number }>;
  /**
   * Cheap identity probe for the admin list ETag — parallels the public
   * IdolRepository.getListIdentity. Returns count + max(updatedAt) under
   * the same filter as listAll. Used by AdminCatalogController to support
   * conditional GET for the CMS.
   */
  getListIdentity(opts: { includeDeleted?: boolean }): Promise<{ total: number; maxUpdatedAt: Date | null }>;
  findById(id: string, includeDeleted?: boolean): Promise<AdminIdolRecord | null>;
  create(input: {
    agencyId: string;
    name: string;
    stageName: string | null;
    mbti: string | null;
    bio: string | null;
    heroImageUrl: string | null;
    birthdate: Date | null;
    publishImmediately: boolean;
  }): Promise<AdminIdolRecord>;
  update(
    id: string,
    patch: {
      name?: string;
      stageName?: string | null;
      mbti?: string | null;
      bio?: string | null;
      heroImageUrl?: string | null;
      birthdate?: Date | null;
      agencyId?: string;
    },
  ): Promise<AdminIdolRecord>;
  setPublished(id: string, publishedAt: Date | null): Promise<AdminIdolRecord>;
  softDelete(id: string): Promise<void>;
}

// -- Schedules -------------------------------------------------------------

export type IdolScheduleType =
  | 'BROADCAST'
  | 'CONCERT'
  | 'FANMEETING'
  | 'STREAMING'
  | 'OTHER';

export interface IdolScheduleRecord {
  id: string;
  idolId: string;
  type: IdolScheduleType;
  title: string;
  location: string | null;
  startAt: Date;
  endAt: Date | null;
  notes: string | null;
  createdAt: Date;
}

export interface IdolScheduleRepository {
  listByIdol(idolId: string): Promise<IdolScheduleRecord[]>;
  create(input: {
    idolId: string;
    type: IdolScheduleType;
    title: string;
    location: string | null;
    startAt: Date;
    endAt: Date | null;
    notes: string | null;
  }): Promise<IdolScheduleRecord>;
  softDelete(id: string): Promise<void>;
  findById(id: string): Promise<IdolScheduleRecord | null>;
}

export const AGENCY_REPOSITORY = 'AgencyRepository';
export const ADMIN_IDOL_REPOSITORY = 'AdminIdolRepository';
export const IDOL_SCHEDULE_REPOSITORY = 'IdolScheduleRepository';
