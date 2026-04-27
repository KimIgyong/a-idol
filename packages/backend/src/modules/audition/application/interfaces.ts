import type { AuditionStatus, RoundStatus } from '@a-idol/shared';

export interface AuditionRecord {
  id: string;
  name: string;
  description: string | null;
  status: AuditionStatus;
  startAt: Date;
  endAt: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface RoundRecord {
  id: string;
  auditionId: string;
  name: string;
  orderIndex: number;
  status: RoundStatus;
  startAt: Date;
  endAt: Date;
  maxAdvancers: number | null;
}

export interface AuditionEntryRecord {
  id: string;
  auditionId: string;
  idolId: string;
  idolName: string;
  stageName: string | null;
  heroImageUrl: string | null;
  eliminatedAt: Date | null;
  eliminatedAtRoundId: string | null;
}

export interface AuditionDetailRecord extends AuditionRecord {
  rounds: RoundRecord[];
  entries: AuditionEntryRecord[];
}

export interface AuditionListItem extends AuditionRecord {
  roundCount: number;
  entryCount: number;
}

export interface AuditionRepository {
  create(input: {
    name: string;
    description: string | null;
    startAt: Date;
    endAt: Date;
    createdBy: string;
  }): Promise<AuditionRecord>;
  findById(id: string): Promise<AuditionRecord | null>;
  findDetail(id: string): Promise<AuditionDetailRecord | null>;
  listAdmin(): Promise<AuditionListItem[]>;
  listActive(): Promise<AuditionListItem[]>;
  /** SCR-012 — public 지난 오디션. FINISHED 만, 최근 endAt 순. */
  listFinished(): Promise<AuditionListItem[]>;
  update(
    id: string,
    patch: {
      name?: string;
      description?: string | null;
      startAt?: Date;
      endAt?: Date;
    },
  ): Promise<AuditionRecord>;
  setStatus(id: string, status: AuditionStatus): Promise<AuditionRecord>;
  /**
   * Bump `updatedAt` to now without mutating any other field. Used by the
   * Round usecases to invalidate the parent audition's ETag when a child
   * (round / entry) transitions — Prisma `@updatedAt` on `audition` does
   * not cascade from related tables. See ADR-021 staleness note on
   * `/auditions/:id`.
   */
  touchUpdatedAt(id: string): Promise<void>;
  softDelete(id: string): Promise<void>;
}

export interface RoundRepository {
  create(input: {
    auditionId: string;
    name: string;
    orderIndex: number;
    startAt: Date;
    endAt: Date;
    maxAdvancers: number | null;
  }): Promise<RoundRecord>;
  findById(id: string): Promise<RoundRecord | null>;
  listByAudition(auditionId: string): Promise<RoundRecord[]>;
  update(
    id: string,
    patch: {
      name?: string;
      orderIndex?: number;
      startAt?: Date;
      endAt?: Date;
      maxAdvancers?: number | null;
    },
  ): Promise<RoundRecord>;
  setStatus(id: string, status: RoundStatus): Promise<RoundRecord>;
  delete(id: string): Promise<void>;
}

export interface AuditionEntryRepository {
  addMany(auditionId: string, idolIds: string[]): Promise<AuditionEntryRecord[]>;
  remove(auditionId: string, idolId: string): Promise<void>;
  listByAudition(auditionId: string): Promise<AuditionEntryRecord[]>;
}

export const AUDITION_REPOSITORY = 'AuditionRepository';
export const ROUND_REPOSITORY = 'RoundRepository';
export const AUDITION_ENTRY_REPOSITORY = 'AuditionEntryRepository';
