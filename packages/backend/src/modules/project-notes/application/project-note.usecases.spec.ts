import {
  CreateProjectNoteUseCase,
  DeleteProjectNoteUseCase,
  GetProjectNoteUseCase,
  UpdateProjectNoteUseCase,
} from './project-note.usecases';
import type { ProjectNoteRepository } from './interfaces';
import type { ProjectNoteWithAuthor } from '../domain/project-note';

const NOW = new Date('2026-05-07T00:00:00Z');

function makeNote(over: Partial<ProjectNoteWithAuthor> = {}): ProjectNoteWithAuthor {
  return {
    id: over.id ?? 'note-1',
    title: over.title ?? 'T',
    body: over.body ?? '<p>body</p>',
    category: over.category ?? 'NOTE',
    pinned: over.pinned ?? false,
    authorAdminId: over.authorAdminId ?? 'author-1',
    authorName: over.authorName ?? 'Author',
    createdAt: over.createdAt ?? NOW,
    updatedAt: over.updatedAt ?? NOW,
  };
}

function makeRepo(overrides: Partial<ProjectNoteRepository> = {}): ProjectNoteRepository {
  return {
    list: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(async (input) => makeNote({ id: 'note-new', ...input })),
    update: jest.fn(async (id, input) => makeNote({ id, ...input })),
    remove: jest.fn(),
    ...overrides,
  };
}

describe('Project notes — RBAC + sanitize', () => {
  it('TC-NOT-001: create sanitizes body and persists', async () => {
    const repo = makeRepo();
    const uc = new CreateProjectNoteUseCase(repo);
    const out = await uc.execute({
      title: 'Hello',
      body: '<p>ok</p><script>alert(1)</script>',
      authorAdminId: 'a',
    });
    expect(out.body).toContain('<p>ok</p>');
    expect(out.body).not.toContain('<script>');
  });

  it('TC-NOT-002: get not-found throws NOTE_NOT_FOUND', async () => {
    const repo = makeRepo({ findById: jest.fn(async () => null) });
    const uc = new GetProjectNoteUseCase(repo);
    await expect(uc.execute('missing')).rejects.toMatchObject({ code: 'NOTE_NOT_FOUND' });
  });

  it('TC-NOT-003: update by author allowed', async () => {
    const note = makeNote({ authorAdminId: 'me' });
    const repo = makeRepo({ findById: jest.fn(async () => note) });
    const uc = new UpdateProjectNoteUseCase(repo);
    const out = await uc.execute({ id: 'me', role: 'operator' }, note.id, { title: 'X' });
    expect(out.id).toBe(note.id);
    expect(repo.update).toHaveBeenCalled();
  });

  it('TC-NOT-004: update by non-author operator → NOTE_FORBIDDEN', async () => {
    const note = makeNote({ authorAdminId: 'someone-else' });
    const repo = makeRepo({ findById: jest.fn(async () => note) });
    const uc = new UpdateProjectNoteUseCase(repo);
    await expect(
      uc.execute({ id: 'me', role: 'operator' }, note.id, { title: 'X' }),
    ).rejects.toMatchObject({ code: 'NOTE_FORBIDDEN' });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('TC-NOT-005: update by admin (non-author) allowed', async () => {
    const note = makeNote({ authorAdminId: 'someone-else' });
    const repo = makeRepo({ findById: jest.fn(async () => note) });
    const uc = new UpdateProjectNoteUseCase(repo);
    await uc.execute({ id: 'admin-id', role: 'admin' }, note.id, { title: 'X' });
    expect(repo.update).toHaveBeenCalled();
  });

  it('TC-NOT-006: delete by non-author operator → NOTE_FORBIDDEN', async () => {
    const note = makeNote({ authorAdminId: 'other' });
    const repo = makeRepo({ findById: jest.fn(async () => note) });
    const uc = new DeleteProjectNoteUseCase(repo);
    await expect(
      uc.execute({ id: 'me', role: 'operator' }, note.id),
    ).rejects.toMatchObject({ code: 'NOTE_FORBIDDEN' });
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('TC-NOT-007: update sanitizes body if provided', async () => {
    const note = makeNote({ authorAdminId: 'me' });
    const repo = makeRepo({ findById: jest.fn(async () => note) });
    const uc = new UpdateProjectNoteUseCase(repo);
    await uc.execute({ id: 'me', role: 'operator' }, note.id, {
      body: '<p>ok</p><iframe src=evil></iframe>',
    });
    const updateCall = (repo.update as jest.Mock).mock.calls[0][1] as { body?: string };
    expect(updateCall.body).toContain('<p>ok</p>');
    expect(updateCall.body).not.toContain('<iframe');
  });
});
