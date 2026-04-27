import { NotFoundException } from '@nestjs/common';
import {
  CreateDesignAssetUseCase,
  DeleteDesignAssetUseCase,
  ListDesignAssetsUseCase,
  UpdateDesignAssetUseCase,
} from './design-asset.usecases';
import type {
  CreateDesignAssetInput,
  DesignAssetRecord,
  DesignAssetRepository,
  UpdateDesignAssetInput,
} from './interfaces';

/** T-085 — DesignAsset use cases. Hand-rolled fake repo (CLAUDE.md 정책). */
describe('design-asset usecases', () => {
  const NOW = new Date('2026-04-27T00:00:00Z');

  const makeRecord = (overrides: Partial<DesignAssetRecord> = {}): DesignAssetRecord => ({
    id: 'da-1',
    name: 'sample',
    type: 'SCREENSHOT',
    platform: 'ALL',
    status: 'PLACEHOLDER',
    fileUrl: null,
    spec: null,
    orderIndex: 0,
    caption: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });

  const makeRepo = (): {
    repo: DesignAssetRepository;
    state: Map<string, DesignAssetRecord>;
  } => {
    const state = new Map<string, DesignAssetRecord>();
    const repo: DesignAssetRepository = {
      list: jest.fn(async () => Array.from(state.values())),
      findById: jest.fn(async (id: string) => state.get(id) ?? null),
      create: jest.fn(async (input: CreateDesignAssetInput) => {
        const r = makeRecord({
          id: `da-${state.size + 1}`,
          name: input.name,
          type: input.type,
          platform: input.platform ?? 'ALL',
          status: input.status ?? 'PLACEHOLDER',
          fileUrl: input.fileUrl ?? null,
          spec: input.spec ?? null,
          orderIndex: input.orderIndex ?? 0,
          caption: input.caption ?? null,
          notes: input.notes ?? null,
        });
        state.set(r.id, r);
        return r;
      }),
      update: jest.fn(async (id: string, input: UpdateDesignAssetInput) => {
        const cur = state.get(id);
        if (!cur) throw new Error(`fake: missing ${id}`);
        const next: DesignAssetRecord = {
          ...cur,
          name: input.name ?? cur.name,
          status: input.status ?? cur.status,
          fileUrl: input.fileUrl !== undefined ? input.fileUrl : cur.fileUrl,
          updatedAt: new Date(NOW.getTime() + 1000),
        };
        state.set(id, next);
        return next;
      }),
      remove: jest.fn(async (id: string) => {
        state.delete(id);
      }),
    };
    return { repo, state };
  };

  it('TC-DA-001 — list returns repo rows in order', async () => {
    const { repo, state } = makeRepo();
    state.set('da-1', makeRecord({ id: 'da-1', name: 'a' }));
    state.set('da-2', makeRecord({ id: 'da-2', name: 'b', orderIndex: 1 }));
    const uc = new ListDesignAssetsUseCase(repo);
    const out = await uc.execute();
    expect(out.map((x) => x.name)).toEqual(['a', 'b']);
  });

  it('TC-DA-002 — create defaults platform=ALL, status=PLACEHOLDER, orderIndex=0', async () => {
    const { repo } = makeRepo();
    const uc = new CreateDesignAssetUseCase(repo);
    const out = await uc.execute({
      name: 'splash',
      type: 'SPLASH',
      createdBy: 'admin-1',
    });
    expect(out).toMatchObject({
      name: 'splash',
      type: 'SPLASH',
      platform: 'ALL',
      status: 'PLACEHOLDER',
      orderIndex: 0,
    });
  });

  it('TC-DA-003 — update on missing id → NotFoundException', async () => {
    const { repo } = makeRepo();
    const uc = new UpdateDesignAssetUseCase(repo);
    await expect(
      uc.execute('does-not-exist', { status: 'DRAFT', updatedBy: 'admin-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('TC-DA-004 — update existing transitions status', async () => {
    const { repo, state } = makeRepo();
    state.set('da-1', makeRecord({ id: 'da-1', status: 'PLACEHOLDER' }));
    const uc = new UpdateDesignAssetUseCase(repo);
    const out = await uc.execute('da-1', { status: 'DRAFT', updatedBy: 'admin-1' });
    expect(out.status).toBe('DRAFT');
  });

  it('TC-DA-005 — delete on missing id → NotFoundException', async () => {
    const { repo } = makeRepo();
    const uc = new DeleteDesignAssetUseCase(repo);
    await expect(uc.execute('does-not-exist')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('TC-DA-006 — delete existing removes from store', async () => {
    const { repo, state } = makeRepo();
    state.set('da-1', makeRecord({ id: 'da-1' }));
    const uc = new DeleteDesignAssetUseCase(repo);
    await uc.execute('da-1');
    expect(state.has('da-1')).toBe(false);
  });
});
