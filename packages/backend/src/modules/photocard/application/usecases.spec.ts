import {
  AddPhotocardTemplateUseCase,
  CreatePhotocardSetUseCase,
  GetPhotocardSetUseCase,
  ListMyPhotocardsUseCase,
  ListPhotocardSetsUseCase,
  UpdatePhotocardSetUseCase,
} from './usecases';
import type {
  PhotocardRepository,
  PhotocardSetRecord,
  PhotocardTemplateRecord,
  UserPhotocardRecord,
} from './interfaces';

/** T-084 — photocard usecases. Repo 위임이 다수 + Get 404 / AddTemplate defaults / Create null coercion. */
describe('photocard usecases', () => {
  const makeSet = (overrides: Partial<PhotocardSetRecord> = {}): PhotocardSetRecord => ({
    id: 's-1',
    name: 'HYUN 1st',
    description: null,
    idolId: null,
    idolName: null,
    isActive: true,
    templates: [],
    ...overrides,
  });

  const makeTemplate = (overrides: Partial<PhotocardTemplateRecord> = {}): PhotocardTemplateRecord => ({
    id: 't-1',
    setId: 's-1',
    name: 'card-a',
    imageUrl: null,
    rarity: 'COMMON',
    dropWeight: 10,
    isActive: true,
    ...overrides,
  });

  const makeRepo = (overrides: Partial<PhotocardRepository> = {}): PhotocardRepository => ({
    listSets: jest.fn(async () => []),
    findSetById: jest.fn(async () => null),
    createSet: jest.fn(),
    updateSet: jest.fn(),
    addTemplate: jest.fn(),
    grantFromSet: jest.fn(),
    listUserInventory: jest.fn(async () => []),
    ...overrides,
  });

  // ===== List sets =====

  it('TC-PC-001 — listSets activeOnly=true → repo.listSets({activeOnly:true})', async () => {
    const sets = [makeSet({ id: 's-1' }), makeSet({ id: 's-2' })];
    const repo = makeRepo({ listSets: jest.fn(async () => sets) });
    const uc = new ListPhotocardSetsUseCase(repo);
    const out = await uc.execute({ activeOnly: true });
    expect(out).toBe(sets);
    expect(repo.listSets).toHaveBeenCalledWith({ activeOnly: true });
  });

  // ===== Get set =====

  it('TC-PC-002 — getSet 미존재 → PHOTOCARD_SET_NOT_FOUND', async () => {
    const repo = makeRepo({ findSetById: jest.fn(async () => null) });
    const uc = new GetPhotocardSetUseCase(repo);
    await expect(uc.execute('missing')).rejects.toMatchObject({
      code: 'PHOTOCARD_SET_NOT_FOUND',
    });
  });

  it('TC-PC-003 — getSet 정상 → record 반환', async () => {
    const set = makeSet({ id: 's-9', templates: [makeTemplate()] });
    const repo = makeRepo({ findSetById: jest.fn(async () => set) });
    const uc = new GetPhotocardSetUseCase(repo);
    const out = await uc.execute('s-9');
    expect(out.id).toBe('s-9');
    expect(out.templates).toHaveLength(1);
  });

  // ===== List my photocards =====

  it('TC-PC-004 — listMy default take=100 위임', async () => {
    const inventory: UserPhotocardRecord[] = [
      {
        templateId: 't-1',
        templateName: 'a',
        imageUrl: null,
        rarity: 'COMMON',
        setId: 's-1',
        setName: 'set',
        count: 2,
        firstObtainedAt: new Date('2026-04-27T00:00:00Z'),
        lastObtainedAt: new Date('2026-04-28T00:00:00Z'),
      },
    ];
    const repo = makeRepo({ listUserInventory: jest.fn(async () => inventory) });
    const uc = new ListMyPhotocardsUseCase(repo);
    const out = await uc.execute('u-1');
    expect(out).toBe(inventory);
    expect(repo.listUserInventory).toHaveBeenCalledWith('u-1', 100);
  });

  it('TC-PC-005 — listMy take 명시 시 그대로 전달', async () => {
    const repo = makeRepo();
    const uc = new ListMyPhotocardsUseCase(repo);
    await uc.execute('u-1', 25);
    expect(repo.listUserInventory).toHaveBeenCalledWith('u-1', 25);
  });

  // ===== Create set =====

  it('TC-PC-006 — createSet null coercion (description / idolId 미지정 → null)', async () => {
    const repo = makeRepo({
      createSet: jest.fn(async (input) => makeSet({ id: 's-new', ...input })),
    });
    const uc = new CreatePhotocardSetUseCase(repo);
    await uc.execute({ name: 'New Set' });
    expect(repo.createSet).toHaveBeenCalledWith({
      name: 'New Set',
      description: null,
      idolId: null,
    });
  });

  it('TC-PC-007 — createSet 명시값은 그대로 보존', async () => {
    const repo = makeRepo({
      createSet: jest.fn(async (input) => makeSet({ id: 's-new', ...input })),
    });
    const uc = new CreatePhotocardSetUseCase(repo);
    await uc.execute({ name: 'X', description: 'desc', idolId: 'i-1' });
    expect(repo.createSet).toHaveBeenCalledWith({
      name: 'X',
      description: 'desc',
      idolId: 'i-1',
    });
  });

  // ===== Update set =====

  it('TC-PC-008 — updateSet 패치 그대로 위임 (boundary 검증은 controller/dto)', async () => {
    const repo = makeRepo({
      updateSet: jest.fn(async (id, patch) => makeSet({ id, ...patch, templates: [] })),
    });
    const uc = new UpdatePhotocardSetUseCase(repo);
    await uc.execute('s-1', { isActive: false });
    expect(repo.updateSet).toHaveBeenCalledWith('s-1', { isActive: false });
  });

  // ===== Add template =====

  it('TC-PC-009 — addTemplate defaults: rarity=COMMON, dropWeight=10, imageUrl=null', async () => {
    const repo = makeRepo({
      addTemplate: jest.fn(async (setId, input) => makeTemplate({ setId, ...input })),
    });
    const uc = new AddPhotocardTemplateUseCase(repo);
    await uc.execute('s-1', { name: 'first' });
    expect(repo.addTemplate).toHaveBeenCalledWith('s-1', {
      name: 'first',
      imageUrl: null,
      rarity: 'COMMON',
      dropWeight: 10,
    });
  });

  it('TC-PC-010 — addTemplate 명시 rarity / dropWeight 보존', async () => {
    const repo = makeRepo({
      addTemplate: jest.fn(async (setId, input) => makeTemplate({ setId, ...input })),
    });
    const uc = new AddPhotocardTemplateUseCase(repo);
    await uc.execute('s-1', {
      name: 'rare-card',
      rarity: 'LEGENDARY',
      dropWeight: 1,
      imageUrl: 'https://x/y.png',
    });
    expect(repo.addTemplate).toHaveBeenCalledWith('s-1', {
      name: 'rare-card',
      imageUrl: 'https://x/y.png',
      rarity: 'LEGENDARY',
      dropWeight: 1,
    });
  });
});
