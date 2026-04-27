import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  CreateProjectDocUseCase,
  DeleteProjectDocUseCase,
  GetProjectDocUseCase,
  ListProjectDocsUseCase,
  UpdateProjectDocUseCase,
} from './project-doc.usecases';
import type {
  CreateProjectDocInput,
  ListProjectDocsFilter,
  ProjectDocRecord,
  ProjectDocRepository,
  UpdateProjectDocInput,
} from './interfaces';

/** T-088 — ProjectDocument use cases. Hand-rolled fake repo (CLAUDE.md 정책). */
describe('project-doc usecases', () => {
  const NOW = new Date('2026-04-27T00:00:00Z');

  const makeRecord = (overrides: Partial<ProjectDocRecord> = {}): ProjectDocRecord => ({
    id: 'pd-1',
    slug: 'test-doc',
    title: 'Test Doc',
    category: 'DELIVERABLE',
    status: 'DRAFT',
    sourceType: 'INLINE',
    sourcePath: null,
    summary: null,
    content: '# v1',
    tags: null,
    orderIndex: 0,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });

  const makeRepo = (): {
    repo: ProjectDocRepository;
    state: Map<string, ProjectDocRecord>;
    bySlug: Map<string, string>;
  } => {
    const state = new Map<string, ProjectDocRecord>();
    const bySlug = new Map<string, string>();
    const repo: ProjectDocRepository = {
      list: jest.fn(async (filter?: ListProjectDocsFilter) => {
        let rows = Array.from(state.values());
        if (filter?.category) rows = rows.filter((r) => r.category === filter.category);
        if (filter?.status) rows = rows.filter((r) => r.status === filter.status);
        return rows;
      }),
      findById: jest.fn(async (id: string) => state.get(id) ?? null),
      findBySlug: jest.fn(async (slug: string) => {
        const id = bySlug.get(slug);
        return id ? state.get(id) ?? null : null;
      }),
      create: jest.fn(async (input: CreateProjectDocInput) => {
        const r = makeRecord({
          id: `pd-${state.size + 1}`,
          slug: input.slug,
          title: input.title,
          category: input.category,
          status: input.status ?? 'DRAFT',
          sourceType: input.sourceType ?? 'INLINE',
          sourcePath: input.sourcePath ?? null,
          summary: input.summary ?? null,
          content: input.content,
          tags: input.tags ?? null,
          orderIndex: input.orderIndex ?? 0,
          version: 1,
        });
        state.set(r.id, r);
        bySlug.set(r.slug, r.id);
        return r;
      }),
      update: jest.fn(async (id: string, input: UpdateProjectDocInput) => {
        const cur = state.get(id);
        if (!cur) throw new Error(`fake: missing ${id}`);
        const contentChanged = input.content !== undefined && input.content !== cur.content;
        if (input.slug && input.slug !== cur.slug) {
          bySlug.delete(cur.slug);
          bySlug.set(input.slug, cur.id);
        }
        const next: ProjectDocRecord = {
          ...cur,
          slug: input.slug ?? cur.slug,
          title: input.title ?? cur.title,
          status: input.status ?? cur.status,
          content: input.content ?? cur.content,
          version: contentChanged ? cur.version + 1 : cur.version,
          updatedAt: new Date(NOW.getTime() + 1000),
        };
        state.set(id, next);
        return next;
      }),
      remove: jest.fn(async (id: string) => {
        const cur = state.get(id);
        if (cur) bySlug.delete(cur.slug);
        state.delete(id);
      }),
    };
    return { repo, state, bySlug };
  };

  it('TC-PD-001 — list with category filter', async () => {
    const { repo, state, bySlug } = makeRepo();
    const a = makeRecord({ id: 'pd-1', slug: 'adr-x', category: 'ADR' });
    const b = makeRecord({ id: 'pd-2', slug: 'del-y', category: 'DELIVERABLE' });
    state.set('pd-1', a);
    state.set('pd-2', b);
    bySlug.set('adr-x', 'pd-1');
    bySlug.set('del-y', 'pd-2');

    const uc = new ListProjectDocsUseCase(repo);
    const adrs = await uc.execute({ category: 'ADR' });
    expect(adrs).toHaveLength(1);
    expect(adrs[0].slug).toBe('adr-x');
  });

  it('TC-PD-002 — get by slug returns record', async () => {
    const { repo, state, bySlug } = makeRepo();
    state.set('pd-1', makeRecord({ id: 'pd-1', slug: 'wbs' }));
    bySlug.set('wbs', 'pd-1');

    const uc = new GetProjectDocUseCase(repo);
    const out = await uc.execute('wbs');
    expect(out.slug).toBe('wbs');
  });

  it('TC-PD-003 — get by missing slug → NotFoundException', async () => {
    const { repo } = makeRepo();
    const uc = new GetProjectDocUseCase(repo);
    await expect(uc.execute('nonexistent')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('TC-PD-004 — create starts at version=1, returns record', async () => {
    const { repo } = makeRepo();
    const uc = new CreateProjectDocUseCase(repo);
    const out = await uc.execute({
      slug: 'new-doc',
      title: 'New',
      category: 'DELIVERABLE',
      content: '# v1',
      createdBy: 'admin-1',
    });
    expect(out).toMatchObject({ slug: 'new-doc', version: 1 });
  });

  it('TC-PD-005 — duplicate slug on create → ConflictException', async () => {
    const { repo, state, bySlug } = makeRepo();
    state.set('pd-1', makeRecord({ id: 'pd-1', slug: 'dup' }));
    bySlug.set('dup', 'pd-1');

    const uc = new CreateProjectDocUseCase(repo);
    await expect(
      uc.execute({
        slug: 'dup',
        title: 'X',
        category: 'OTHER',
        content: 'x',
        createdBy: 'admin-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('TC-PD-006 — update on missing id → NotFoundException', async () => {
    const { repo } = makeRepo();
    const uc = new UpdateProjectDocUseCase(repo);
    await expect(
      uc.execute('does-not-exist', { content: 'x', updatedBy: 'admin-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('TC-PD-007 — content 변경 시 version++ (fake repo 가 미러)', async () => {
    const { repo, state, bySlug } = makeRepo();
    const cur = makeRecord({ id: 'pd-1', slug: 'doc', content: '# v1', version: 1 });
    state.set('pd-1', cur);
    bySlug.set('doc', 'pd-1');

    const uc = new UpdateProjectDocUseCase(repo);
    const updated = await uc.execute('pd-1', { content: '# v2', updatedBy: 'admin-1' });
    expect(updated.version).toBe(2);
  });

  it('TC-PD-008 — slug rename 시 새 slug 가 다른 doc 와 중복이면 Conflict', async () => {
    const { repo, state, bySlug } = makeRepo();
    state.set('pd-1', makeRecord({ id: 'pd-1', slug: 'a' }));
    state.set('pd-2', makeRecord({ id: 'pd-2', slug: 'b' }));
    bySlug.set('a', 'pd-1');
    bySlug.set('b', 'pd-2');

    const uc = new UpdateProjectDocUseCase(repo);
    await expect(
      uc.execute('pd-1', { slug: 'b', updatedBy: 'admin-1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('TC-PD-009 — delete on missing id → NotFoundException', async () => {
    const { repo } = makeRepo();
    const uc = new DeleteProjectDocUseCase(repo);
    await expect(uc.execute('does-not-exist')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('TC-PD-010 — delete existing removes from store + slug index', async () => {
    const { repo, state, bySlug } = makeRepo();
    state.set('pd-1', makeRecord({ id: 'pd-1', slug: 'doc' }));
    bySlug.set('doc', 'pd-1');

    const uc = new DeleteProjectDocUseCase(repo);
    await uc.execute('pd-1');
    expect(state.has('pd-1')).toBe(false);
    expect(bySlug.has('doc')).toBe(false);
  });
});
