import { UploadAttachmentUseCase } from './attachment.usecases';
import type { AttachmentRepository, StoragePort } from './interfaces';
import type { AttachmentRecord } from '../domain/attachment';
import { ALLOWED_MIME_TYPES } from '../domain/attachment';

function makeRepo(overrides: Partial<AttachmentRepository> = {}): AttachmentRepository {
  return {
    create: jest.fn(async (input): Promise<AttachmentRecord> => ({
      id: 'att-1',
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storageKey: input.storageKey,
      uploadedById: input.uploadedById,
      createdAt: new Date('2026-05-07T00:00:00Z'),
    })),
    findById: jest.fn(),
    linkToOwner: jest.fn(),
    remove: jest.fn(),
    ...overrides,
  };
}

function makeStorage(overrides: Partial<StoragePort> = {}): StoragePort {
  return {
    save: jest.fn(async () => ({ storageKey: 'key-1' })),
    read: jest.fn(),
    remove: jest.fn(),
    ...overrides,
  };
}

describe('UploadAttachmentUseCase', () => {
  it('TC-ATT-001: happy path image', async () => {
    const repo = makeRepo();
    const storage = makeStorage();
    const uc = new UploadAttachmentUseCase(storage, repo);
    const out = await uc.execute({
      ownerType: 'ISSUE',
      filename: 'a.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(1024),
      uploadedById: 'admin-1',
    });
    expect(out.filename).toBe('a.png');
    expect(storage.save).toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalled();
  });

  it('TC-ATT-002: rejects oversize → ATTACHMENT_TOO_LARGE', async () => {
    const repo = makeRepo();
    const storage = makeStorage();
    const uc = new UploadAttachmentUseCase(storage, repo);
    await expect(
      uc.execute({
        ownerType: 'ISSUE',
        filename: 'a.png',
        mimeType: 'image/png',
        buffer: Buffer.alloc(30 * 1024 * 1024),
        uploadedById: 'admin-1',
      }),
    ).rejects.toMatchObject({ code: 'ATTACHMENT_TOO_LARGE' });
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('TC-ATT-003: rejects SVG (not in whitelist) → ATTACHMENT_MIME_NOT_ALLOWED', async () => {
    const repo = makeRepo();
    const storage = makeStorage();
    const uc = new UploadAttachmentUseCase(storage, repo);
    await expect(
      uc.execute({
        ownerType: 'ISSUE',
        filename: 'a.svg',
        mimeType: 'image/svg+xml',
        buffer: Buffer.alloc(100),
        uploadedById: 'admin-1',
      }),
    ).rejects.toMatchObject({ code: 'ATTACHMENT_MIME_NOT_ALLOWED' });
  });

  it('TC-ATT-004: SVG MIME explicitly excluded from whitelist', () => {
    expect(ALLOWED_MIME_TYPES).not.toContain('image/svg+xml');
  });
});
