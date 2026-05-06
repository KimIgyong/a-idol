import type { AttachmentOwnerType } from '@prisma/client';
import type { AttachmentRecord } from '../domain/attachment';

export interface StoragePort {
  /** 저장 후 storageKey 반환. 호출자가 buffer 와 파일 메타를 책임. */
  save(input: { buffer: Buffer; filename: string; mimeType: string }): Promise<{
    storageKey: string;
  }>;
  /** 다운로드용 stream/buffer. media controller 가 응답 stream 으로 변환. */
  read(storageKey: string): Promise<{ buffer: Buffer; mimeType: string }>;
  /** 삭제. 미존재 OK (idempotent). */
  remove(storageKey: string): Promise<void>;
}

export interface AttachmentRepository {
  create(input: {
    ownerType: AttachmentOwnerType;
    ownerId: string | null;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    uploadedById: string;
  }): Promise<AttachmentRecord>;
  findById(id: string): Promise<AttachmentRecord | null>;
  /** owner 가 정해지지 않은 DRAFT → 실제 owner 로 link. */
  linkToOwner(ids: string[], ownerType: AttachmentOwnerType, ownerId: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export const STORAGE_PORT = 'StoragePort';
export const ATTACHMENT_REPOSITORY = 'AttachmentRepository';
