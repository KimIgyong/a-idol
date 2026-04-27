import { DomainError } from '@a-idol/shared';
import {
  CreateAgencyUseCase,
  DeleteAgencyUseCase,
  ListAgenciesUseCase,
  UpdateAgencyUseCase,
} from './agency.usecase';
import type { AgencyRecord, AgencyRepository } from './admin-interfaces';

/** T-084 — Agency use cases. Hand-rolled fake repo (CLAUDE.md). */
describe('agency usecases', () => {
  const NOW = new Date('2026-04-27T00:00:00Z');

  const makeRecord = (overrides: Partial<AgencyRecord> = {}): AgencyRecord => ({
    id: 'a-1',
    name: 'Star Agency',
    description: null,
    idolCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });

  const makeRepo = (): { repo: AgencyRepository; state: Map<string, AgencyRecord> } => {
    const state = new Map<string, AgencyRecord>();
    const repo: AgencyRepository = {
      list: jest.fn(async () => Array.from(state.values())),
      findById: jest.fn(async (id) => state.get(id) ?? null),
      create: jest.fn(async (input) => {
        const r = makeRecord({
          id: `a-${state.size + 1}`,
          name: input.name,
          description: input.description,
        });
        state.set(r.id, r);
        return r;
      }),
      update: jest.fn(async (id, patch) => {
        const cur = state.get(id);
        if (!cur) throw new Error(`fake: missing ${id}`);
        const next: AgencyRecord = {
          ...cur,
          name: patch.name !== undefined ? patch.name : cur.name,
          description: patch.description !== undefined ? patch.description : cur.description,
          updatedAt: new Date(NOW.getTime() + 1000),
        };
        state.set(id, next);
        return next;
      }),
      softDelete: jest.fn(async (id) => {
        state.delete(id);
      }),
    };
    return { repo, state };
  };

  it('TC-AG-001 — list returns repo rows', async () => {
    const { repo, state } = makeRepo();
    state.set('a-1', makeRecord({ id: 'a-1', name: 'Alpha' }));
    state.set('a-2', makeRecord({ id: 'a-2', name: 'Beta' }));
    const uc = new ListAgenciesUseCase(repo);
    const out = await uc.execute();
    expect(out.map((a) => a.name)).toEqual(['Alpha', 'Beta']);
  });

  it('TC-AG-002 — create trims name + description (blank → empty string per current `?? null` policy)', async () => {
    const { repo } = makeRepo();
    const uc = new CreateAgencyUseCase(repo);
    const out = await uc.execute({ name: '  Trim Co  ', description: '   ' });
    expect(out.name).toBe('Trim Co');
    // 현 정책: `input.description?.trim() ?? null` → 빈 string 은 그대로 ('').
    // create-idol 의 `|| null` 정책과 의도적 차이는 아님 — 향후 통일 시 수정 필요.
    expect(out.description).toBe('');
  });

  it('TC-AG-003 — create with explicit null description', async () => {
    const { repo } = makeRepo();
    const uc = new CreateAgencyUseCase(repo);
    const out = await uc.execute({ name: 'X', description: null });
    expect(out.description).toBe(null);
  });

  it('TC-AG-004 — update on missing id → AGENCY_NOT_FOUND', async () => {
    const { repo } = makeRepo();
    const uc = new UpdateAgencyUseCase(repo);
    await expect(uc.execute('does-not-exist', { name: 'x' })).rejects.toMatchObject({
      code: 'AGENCY_NOT_FOUND',
    });
  });

  it('TC-AG-005 — update trims name', async () => {
    const { repo, state } = makeRepo();
    state.set('a-1', makeRecord({ id: 'a-1', name: 'Old' }));
    const uc = new UpdateAgencyUseCase(repo);
    const out = await uc.execute('a-1', { name: '  Renamed  ' });
    expect(out.name).toBe('Renamed');
  });

  it('TC-AG-006 — delete on missing id → AGENCY_NOT_FOUND', async () => {
    const { repo } = makeRepo();
    const uc = new DeleteAgencyUseCase(repo);
    await expect(uc.execute('missing')).rejects.toMatchObject({ code: 'AGENCY_NOT_FOUND' });
  });

  it('TC-AG-007 — delete refuses when idolCount > 0 → AGENCY_HAS_IDOLS', async () => {
    const { repo, state } = makeRepo();
    state.set('a-1', makeRecord({ id: 'a-1', idolCount: 3 }));
    const uc = new DeleteAgencyUseCase(repo);
    const err = await uc.execute('a-1').catch((e: unknown) => e as DomainError);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe('AGENCY_HAS_IDOLS');
    // 도메인 에러의 details 에 idolCount 가 들어있어야 admin이 진단 가능.
    expect((err as DomainError).details).toMatchObject({ idolCount: 3 });
  });

  it('TC-AG-008 — delete with idolCount=0 succeeds (soft)', async () => {
    const { repo, state } = makeRepo();
    state.set('a-1', makeRecord({ id: 'a-1', idolCount: 0 }));
    const uc = new DeleteAgencyUseCase(repo);
    await uc.execute('a-1');
    expect(state.has('a-1')).toBe(false);
  });
});
