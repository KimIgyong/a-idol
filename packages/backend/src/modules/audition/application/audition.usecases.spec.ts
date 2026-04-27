import {
  AddEntriesUseCase,
  CreateAuditionUseCase,
  DeleteAuditionUseCase,
  GetAuditionUseCase,
  ListAuditionsUseCase,
  RemoveEntryUseCase,
  TransitionAuditionUseCase,
  UpdateAuditionUseCase,
} from './audition.usecases';
import type {
  AuditionDetailRecord,
  AuditionEntryRepository,
  AuditionRecord,
  AuditionRepository,
} from './interfaces';
import type { AdminIdolRecord, AdminIdolRepository } from '../../catalog/application/admin-interfaces';

/** T-084 — audition.usecases (Create/List/Get/Update/Transition/Delete + Entries). */
describe('audition.usecases', () => {
  const NOW = new Date('2026-04-28T00:00:00Z');
  const PLUS_DAY = new Date(NOW.getTime() + 86_400_000);

  const makeAudition = (overrides: Partial<AuditionRecord> = {}): AuditionRecord => ({
    id: 'a-1',
    name: 'A',
    description: null,
    status: 'DRAFT',
    startAt: NOW,
    endAt: PLUS_DAY,
    createdBy: 'admin-1',
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  });

  const makeIdol = (id = 'i-1'): AdminIdolRecord => ({
    id,
    agencyId: 'ag-1',
    agencyName: 'X',
    name: 'lee',
    stageName: null,
    birthdate: null,
    mbti: null,
    bio: null,
    heroImageUrl: null,
    heartCount: 0,
    followCount: 0,
    publishedAt: null,
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  });

  const makeRepos = (opts: {
    audition?: AuditionRecord | null;
    detail?: AuditionDetailRecord | null;
    idols?: Map<string, AdminIdolRecord>;
  } = {}) => {
    const created: AuditionRecord[] = [];
    const updated: Array<{ id: string; patch: Parameters<AuditionRepository['update']>[1] }> = [];
    const status: Array<{ id: string; status: string }> = [];
    const touched: string[] = [];
    const softDeleted: string[] = [];
    const addedEntries: Array<{ auditionId: string; idolIds: string[] }> = [];
    const removed: Array<{ auditionId: string; idolId: string }> = [];

    const repo: AuditionRepository = {
      create: jest.fn(async (input) => {
        const r = makeAudition({ id: 'a-new', ...input });
        created.push(r);
        return r;
      }),
      findById: jest.fn(async () => opts.audition ?? null),
      findDetail: jest.fn(async () => opts.detail ?? null),
      listAdmin: jest.fn(),
      listActive: jest.fn(),
      listFinished: jest.fn(),
      update: jest.fn(async (id, patch) => {
        updated.push({ id, patch });
        return makeAudition({ ...(opts.audition ?? {}), id, ...patch });
      }),
      setStatus: jest.fn(async (id, st) => {
        status.push({ id, status: st });
        return makeAudition({ ...(opts.audition ?? {}), id, status: st });
      }),
      touchUpdatedAt: jest.fn(async (id) => {
        touched.push(id);
      }),
      softDelete: jest.fn(async (id) => {
        softDeleted.push(id);
      }),
    };

    const entriesRepo: AuditionEntryRepository = {
      addMany: jest.fn(async (auditionId, idolIds) => {
        addedEntries.push({ auditionId, idolIds });
        return idolIds.map((idolId) => ({
          id: `e-${idolId}`,
          auditionId,
          idolId,
          idolName: 'lee',
          stageName: null,
          heroImageUrl: null,
          eliminatedAt: null,
          eliminatedAtRoundId: null,
        }));
      }),
      remove: jest.fn(async (auditionId, idolId) => {
        removed.push({ auditionId, idolId });
      }),
      listByAudition: jest.fn(),
    };

    const idolsRepo: AdminIdolRepository = {
      listAll: jest.fn(),
      getListIdentity: jest.fn(),
      findById: jest.fn(async (id) => opts.idols?.get(id) ?? null),
      create: jest.fn(),
      update: jest.fn(),
      setPublished: jest.fn(),
      softDelete: jest.fn(),
    };

    return { repo, entriesRepo, idolsRepo, created, updated, status, touched, softDeleted, addedEntries, removed };
  };

  // ===== Create =====

  it('TC-AU-001 — endAt <= startAt → AUDITION_INVALID_DATE_RANGE', async () => {
    const { repo, entriesRepo, idolsRepo } = makeRepos();
    const uc = new CreateAuditionUseCase(repo, entriesRepo, idolsRepo);
    await expect(
      uc.execute({
        name: 'X',
        startAt: PLUS_DAY.toISOString(),
        endAt: NOW.toISOString(),
        createdBy: 'admin-1',
      }),
    ).rejects.toMatchObject({ code: 'AUDITION_INVALID_DATE_RANGE' });
  });

  it('TC-AU-002 — idolIds 중 미존재 → IDOL_NOT_FOUND (no partial write)', async () => {
    const { repo, entriesRepo, idolsRepo } = makeRepos({ idols: new Map() });
    const uc = new CreateAuditionUseCase(repo, entriesRepo, idolsRepo);
    await expect(
      uc.execute({
        name: 'X',
        startAt: NOW.toISOString(),
        endAt: PLUS_DAY.toISOString(),
        idolIds: ['unknown'],
        createdBy: 'admin-1',
      }),
    ).rejects.toMatchObject({ code: 'IDOL_NOT_FOUND' });
    // create 미실행 (validate-first)
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('TC-AU-003 — 정상 + idolIds 시 entries.addMany 호출', async () => {
    const idols = new Map([
      ['i-1', makeIdol('i-1')],
      ['i-2', makeIdol('i-2')],
    ]);
    const { repo, entriesRepo, idolsRepo, addedEntries } = makeRepos({ idols });
    const uc = new CreateAuditionUseCase(repo, entriesRepo, idolsRepo);
    const out = await uc.execute({
      name: '  Trim Me  ',
      description: '  desc  ',
      startAt: NOW.toISOString(),
      endAt: PLUS_DAY.toISOString(),
      idolIds: ['i-1', 'i-2'],
      createdBy: 'admin-1',
    });
    expect(out.name).toBe('Trim Me');
    expect(addedEntries).toEqual([{ auditionId: 'a-new', idolIds: ['i-1', 'i-2'] }]);
  });

  it('TC-AU-004 — idolIds 빈 배열 → entries.addMany 호출 안 함', async () => {
    const { repo, entriesRepo, idolsRepo, addedEntries } = makeRepos();
    const uc = new CreateAuditionUseCase(repo, entriesRepo, idolsRepo);
    await uc.execute({
      name: 'X',
      startAt: NOW.toISOString(),
      endAt: PLUS_DAY.toISOString(),
      idolIds: [],
      createdBy: 'admin-1',
    });
    expect(addedEntries).toEqual([]);
  });

  // ===== List =====

  it('TC-AU-005 — listAdmin/listPublic/listFinished repo 위임', async () => {
    const repo: AuditionRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findDetail: jest.fn(),
      listAdmin: jest.fn(async () => []),
      listActive: jest.fn(async () => []),
      listFinished: jest.fn(async () => []),
      update: jest.fn(),
      setStatus: jest.fn(),
      touchUpdatedAt: jest.fn(),
      softDelete: jest.fn(),
    };
    const uc = new ListAuditionsUseCase(repo);
    await uc.executeAdmin();
    await uc.executePublic();
    await uc.executeFinished();
    expect(repo.listAdmin).toHaveBeenCalled();
    expect(repo.listActive).toHaveBeenCalled();
    expect(repo.listFinished).toHaveBeenCalled();
  });

  // ===== Get =====

  it('TC-AU-006 — Get: detail 미존재 → AUDITION_NOT_FOUND', async () => {
    const { repo } = makeRepos({ detail: null });
    const uc = new GetAuditionUseCase(repo);
    await expect(uc.execute('a-1')).rejects.toMatchObject({ code: 'AUDITION_NOT_FOUND' });
  });

  it('TC-AU-007 — Get: deletedAt 있으면 AUDITION_NOT_FOUND', async () => {
    const detail: AuditionDetailRecord = {
      ...makeAudition({ deletedAt: NOW }),
      rounds: [],
      entries: [],
    };
    const { repo } = makeRepos({ detail });
    const uc = new GetAuditionUseCase(repo);
    await expect(uc.execute('a-1')).rejects.toMatchObject({ code: 'AUDITION_NOT_FOUND' });
  });

  it('TC-AU-008 — Get publicOnly: DRAFT → 404 (privacy)', async () => {
    const detail: AuditionDetailRecord = {
      ...makeAudition({ status: 'DRAFT' }),
      rounds: [],
      entries: [],
    };
    const { repo } = makeRepos({ detail });
    const uc = new GetAuditionUseCase(repo);
    await expect(uc.execute('a-1', { publicOnly: true })).rejects.toMatchObject({
      code: 'AUDITION_NOT_FOUND',
    });
  });

  it('TC-AU-009 — Get publicOnly: ACTIVE / FINISHED 노출', async () => {
    for (const st of ['ACTIVE', 'FINISHED'] as const) {
      const detail: AuditionDetailRecord = {
        ...makeAudition({ status: st }),
        rounds: [],
        entries: [],
      };
      const { repo } = makeRepos({ detail });
      const uc = new GetAuditionUseCase(repo);
      const out = await uc.execute('a-1', { publicOnly: true });
      expect(out.status).toBe(st);
    }
  });

  // ===== Update =====

  it('TC-AU-010 — Update: 미존재 → AUDITION_NOT_FOUND', async () => {
    const { repo } = makeRepos({ audition: null });
    const uc = new UpdateAuditionUseCase(repo);
    await expect(uc.execute('a-1', { name: 'X' })).rejects.toMatchObject({
      code: 'AUDITION_NOT_FOUND',
    });
  });

  it('TC-AU-011 — Update: FINISHED → AUDITION_INVALID_TRANSITION', async () => {
    const { repo } = makeRepos({ audition: makeAudition({ status: 'FINISHED' }) });
    const uc = new UpdateAuditionUseCase(repo);
    await expect(uc.execute('a-1', { name: 'X' })).rejects.toMatchObject({
      code: 'AUDITION_INVALID_TRANSITION',
    });
  });

  it('TC-AU-012 — Update: endAt <= startAt → AUDITION_INVALID_DATE_RANGE', async () => {
    const { repo } = makeRepos({ audition: makeAudition({ status: 'DRAFT' }) });
    const uc = new UpdateAuditionUseCase(repo);
    await expect(
      uc.execute('a-1', { startAt: PLUS_DAY.toISOString(), endAt: NOW.toISOString() }),
    ).rejects.toMatchObject({ code: 'AUDITION_INVALID_DATE_RANGE' });
  });

  it('TC-AU-013 — Update: name trim, description=null 명시 시 null', async () => {
    const { repo, updated } = makeRepos({ audition: makeAudition({ status: 'DRAFT' }) });
    const uc = new UpdateAuditionUseCase(repo);
    await uc.execute('a-1', { name: '  Renamed  ', description: null });
    expect(updated[0].patch).toMatchObject({ name: 'Renamed', description: null });
  });

  // ===== Transition =====

  it('TC-AU-014 — Transition: DRAFT → ACTIVE 정상', async () => {
    const { repo, status } = makeRepos({ audition: makeAudition({ status: 'DRAFT' }) });
    const uc = new TransitionAuditionUseCase(repo);
    const out = await uc.execute('a-1', 'ACTIVE');
    expect(out.status).toBe('ACTIVE');
    expect(status).toEqual([{ id: 'a-1', status: 'ACTIVE' }]);
  });

  it('TC-AU-015 — Transition: 잘못된 전이 (FINISHED→ACTIVE) → AUDITION_INVALID_TRANSITION', async () => {
    const { repo } = makeRepos({ audition: makeAudition({ status: 'FINISHED' }) });
    const uc = new TransitionAuditionUseCase(repo);
    await expect(uc.execute('a-1', 'ACTIVE')).rejects.toMatchObject({
      code: 'AUDITION_INVALID_TRANSITION',
    });
  });

  it('TC-AU-016 — Transition: 미존재 → AUDITION_NOT_FOUND', async () => {
    const { repo } = makeRepos({ audition: null });
    const uc = new TransitionAuditionUseCase(repo);
    await expect(uc.execute('missing', 'ACTIVE')).rejects.toMatchObject({
      code: 'AUDITION_NOT_FOUND',
    });
  });

  // ===== Delete =====

  it('TC-AU-017 — Delete: 미존재 → AUDITION_NOT_FOUND', async () => {
    const { repo } = makeRepos({ audition: null });
    const uc = new DeleteAuditionUseCase(repo);
    await expect(uc.execute('a-1')).rejects.toMatchObject({ code: 'AUDITION_NOT_FOUND' });
  });

  it('TC-AU-018 — Delete: ACTIVE 거부 → AUDITION_MUST_BE_DRAFT', async () => {
    const { repo } = makeRepos({ audition: makeAudition({ status: 'ACTIVE' }) });
    const uc = new DeleteAuditionUseCase(repo);
    await expect(uc.execute('a-1')).rejects.toMatchObject({
      code: 'AUDITION_MUST_BE_DRAFT',
    });
  });

  it('TC-AU-019 — Delete: DRAFT 정상 softDelete', async () => {
    const { repo, softDeleted } = makeRepos({ audition: makeAudition({ status: 'DRAFT' }) });
    const uc = new DeleteAuditionUseCase(repo);
    await uc.execute('a-1');
    expect(softDeleted).toEqual(['a-1']);
  });

  // ===== AddEntries =====

  it('TC-AU-020 — AddEntries: 미존재 → AUDITION_NOT_FOUND', async () => {
    const { repo, entriesRepo, idolsRepo } = makeRepos({ audition: null });
    const uc = new AddEntriesUseCase(repo, entriesRepo, idolsRepo);
    await expect(uc.execute('missing', ['i-1'])).rejects.toMatchObject({
      code: 'AUDITION_NOT_FOUND',
    });
  });

  it('TC-AU-021 — AddEntries: FINISHED 거부 → AUDITION_INVALID_TRANSITION', async () => {
    const idols = new Map([['i-1', makeIdol('i-1')]]);
    const { repo, entriesRepo, idolsRepo } = makeRepos({
      audition: makeAudition({ status: 'FINISHED' }),
      idols,
    });
    const uc = new AddEntriesUseCase(repo, entriesRepo, idolsRepo);
    await expect(uc.execute('a-1', ['i-1'])).rejects.toMatchObject({
      code: 'AUDITION_INVALID_TRANSITION',
    });
  });

  it('TC-AU-022 — AddEntries: idol 미존재 → IDOL_NOT_FOUND', async () => {
    const { repo, entriesRepo, idolsRepo } = makeRepos({
      audition: makeAudition({ status: 'DRAFT' }),
      idols: new Map(),
    });
    const uc = new AddEntriesUseCase(repo, entriesRepo, idolsRepo);
    await expect(uc.execute('a-1', ['unknown'])).rejects.toMatchObject({
      code: 'IDOL_NOT_FOUND',
    });
  });

  it('TC-AU-023 — AddEntries: DRAFT/ACTIVE 정상 + parent touchUpdatedAt', async () => {
    const idols = new Map([['i-1', makeIdol('i-1')]]);
    const { repo, entriesRepo, idolsRepo, touched } = makeRepos({
      audition: makeAudition({ status: 'ACTIVE' }),
      idols,
    });
    const uc = new AddEntriesUseCase(repo, entriesRepo, idolsRepo);
    const out = await uc.execute('a-1', ['i-1']);
    expect(out).toHaveLength(1);
    expect(touched).toEqual(['a-1']);
  });

  // ===== RemoveEntry =====

  it('TC-AU-024 — RemoveEntry: 미존재 → AUDITION_NOT_FOUND', async () => {
    const { repo, entriesRepo } = makeRepos({ audition: null });
    const uc = new RemoveEntryUseCase(repo, entriesRepo);
    await expect(uc.execute('missing', 'i-1')).rejects.toMatchObject({
      code: 'AUDITION_NOT_FOUND',
    });
  });

  it('TC-AU-025 — RemoveEntry: ACTIVE → AUDITION_MUST_BE_DRAFT', async () => {
    const { repo, entriesRepo } = makeRepos({ audition: makeAudition({ status: 'ACTIVE' }) });
    const uc = new RemoveEntryUseCase(repo, entriesRepo);
    await expect(uc.execute('a-1', 'i-1')).rejects.toMatchObject({
      code: 'AUDITION_MUST_BE_DRAFT',
    });
  });

  it('TC-AU-026 — RemoveEntry: DRAFT 정상 + parent touchUpdatedAt', async () => {
    const { repo, entriesRepo, touched, removed } = makeRepos({
      audition: makeAudition({ status: 'DRAFT' }),
    });
    const uc = new RemoveEntryUseCase(repo, entriesRepo);
    await uc.execute('a-1', 'i-1');
    expect(removed).toEqual([{ auditionId: 'a-1', idolId: 'i-1' }]);
    expect(touched).toEqual(['a-1']);
  });
});
