import { ErrorCodes } from '@a-idol/shared';
import { SoftDeleteIdolUseCase, UpdateIdolUseCase } from './admin-idol.usecase';
import type {
  AdminIdolRecord,
  AdminIdolRepository,
  AgencyRecord,
  AgencyRepository,
} from './admin-interfaces';
import type { IdolMetaCache } from './idol-meta-cache.interface';

function makeCache(): IdolMetaCache {
  return {
    getMany: jest.fn(async () => new Map()),
    invalidate: jest.fn(async () => undefined),
  };
}

const baseIdol: AdminIdolRecord = {
  id: 'idol-1',
  agencyId: 'ag-1',
  agencyName: 'Agency 1',
  name: 'Hyun',
  stageName: 'HYUN',
  birthdate: new Date('2002-05-14'),
  mbti: 'INFJ',
  bio: 'original bio',
  heroImageUrl: null,
  heartCount: 100,
  followCount: 5,
  publishedAt: new Date('2026-04-01'),
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-04-01'),
};

function makeRepos(idol: AdminIdolRecord | null, agencies: AgencyRecord[] = []) {
  const idolRepo: AdminIdolRepository = {
    listAll: jest.fn(async () => ({ items: idol ? [idol] : [], total: idol ? 1 : 0 })),
    getListIdentity: jest.fn(async () => ({ total: idol ? 1 : 0, maxUpdatedAt: idol?.updatedAt ?? null })),
    findById: jest.fn(async () => idol),
    create: jest.fn(async () => idol as AdminIdolRecord),
    update: jest.fn(async (_id, patch) => ({
      ...(idol as AdminIdolRecord),
      ...patch,
      mbti: patch.mbti === undefined ? idol!.mbti : patch.mbti,
      bio: patch.bio === undefined ? idol!.bio : patch.bio,
    })),
    setPublished: jest.fn(async (_id, publishedAt) => ({
      ...(idol as AdminIdolRecord),
      publishedAt,
    })),
    softDelete: jest.fn(async () => undefined),
  };
  const agencyRepo: AgencyRepository = {
    list: jest.fn(async () => agencies),
    findById: jest.fn(async (id: string) => agencies.find((a) => a.id === id) ?? null),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };
  return { idolRepo, agencyRepo };
}

describe('UpdateIdolUseCase', () => {
  it('TC-AC001 — applies trimmed text patches and uppercases mbti', async () => {
    const { idolRepo, agencyRepo } = makeRepos({ ...baseIdol });
    const uc = new UpdateIdolUseCase(idolRepo, agencyRepo, makeCache());
    await uc.execute('idol-1', { name: '  Hyunwoo  ', mbti: '  enfp ', bio: '  new bio  ' });
    expect(idolRepo.update).toHaveBeenCalledWith('idol-1', expect.objectContaining({
      name: 'Hyunwoo',
      mbti: 'ENFP',
      bio: 'new bio',
    }));
  });

  it('TC-AC002 — empty bio → null; skipping undefined fields preserves existing', async () => {
    const { idolRepo, agencyRepo } = makeRepos({ ...baseIdol });
    const uc = new UpdateIdolUseCase(idolRepo, agencyRepo, makeCache());
    await uc.execute('idol-1', { bio: '   ' });
    expect(idolRepo.update).toHaveBeenCalledWith('idol-1', expect.objectContaining({
      bio: null,
    }));
    const call = (idolRepo.update as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    // undefined (= "no change" for Prisma) because the test patch did not set `name`.
    expect(call.name).toBeUndefined();
  });

  it('TC-AC003 — unknown idol → IDOL_NOT_FOUND', async () => {
    const { idolRepo, agencyRepo } = makeRepos(null);
    const uc = new UpdateIdolUseCase(idolRepo, agencyRepo, makeCache());
    await expect(uc.execute('idol-x', { name: 'x' })).rejects.toMatchObject({
      code: ErrorCodes.IDOL_NOT_FOUND,
    });
    expect(idolRepo.update).not.toHaveBeenCalled();
  });

  it('TC-AC004 — changing agencyId to a missing agency → AGENCY_NOT_FOUND', async () => {
    const { idolRepo, agencyRepo } = makeRepos({ ...baseIdol }, []);
    const uc = new UpdateIdolUseCase(idolRepo, agencyRepo, makeCache());
    await expect(uc.execute('idol-1', { agencyId: 'ag-missing' })).rejects.toMatchObject({
      code: ErrorCodes.AGENCY_NOT_FOUND,
    });
    expect(idolRepo.update).not.toHaveBeenCalled();
  });

  it('TC-AC005 — successful update invalidates the idol meta cache (write-through)', async () => {
    const { idolRepo, agencyRepo } = makeRepos({ ...baseIdol });
    const cache = makeCache();
    const uc = new UpdateIdolUseCase(idolRepo, agencyRepo, cache);
    await uc.execute('idol-1', { name: 'New Name' });
    expect(cache.invalidate).toHaveBeenCalledWith(['idol-1']);
  });

  it('TC-AC006 — validation failure (IDOL_NOT_FOUND) must NOT touch the cache', async () => {
    const { idolRepo, agencyRepo } = makeRepos(null);
    const cache = makeCache();
    const uc = new UpdateIdolUseCase(idolRepo, agencyRepo, cache);
    await expect(uc.execute('idol-x', { name: 'x' })).rejects.toMatchObject({
      code: ErrorCodes.IDOL_NOT_FOUND,
    });
    expect(cache.invalidate).not.toHaveBeenCalled();
  });
});

describe('SoftDeleteIdolUseCase', () => {
  it('TC-AC007 — successful soft delete invalidates the idol meta cache', async () => {
    const { idolRepo } = makeRepos({ ...baseIdol });
    const cache = makeCache();
    const uc = new SoftDeleteIdolUseCase(idolRepo, cache);
    await uc.execute('idol-1');
    expect(idolRepo.softDelete).toHaveBeenCalledWith('idol-1');
    expect(cache.invalidate).toHaveBeenCalledWith(['idol-1']);
  });

  it('TC-AC008 — unknown idol throws IDOL_NOT_FOUND without touching cache', async () => {
    const { idolRepo } = makeRepos(null);
    const cache = makeCache();
    const uc = new SoftDeleteIdolUseCase(idolRepo, cache);
    await expect(uc.execute('idol-x')).rejects.toMatchObject({
      code: ErrorCodes.IDOL_NOT_FOUND,
    });
    expect(idolRepo.softDelete).not.toHaveBeenCalled();
    expect(cache.invalidate).not.toHaveBeenCalled();
  });
});
