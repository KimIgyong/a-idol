import type { AttachmentOwnerType } from '@prisma/client';

export interface AttachmentRecord {
  id: string;
  ownerType: AttachmentOwnerType;
  ownerId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedById: string;
  createdAt: Date;
}

export const ALLOWED_MIME_TYPES: ReadonlyArray<string> = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/zip',
  'text/csv',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;
