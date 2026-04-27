import { CreateIdolUseCase } from './create-idol.usecase';
import type {
  AdminIdolRecord,
  AdminIdolRepository,
  AgencyRecord,
  AgencyRepository,
} from './admin-interfaces';

/** T-084 — CreateIdol use case. */
describe('CreateIdolUseCase', () => {
  const NOW = new Date('2026-04-27T00:00:00Z');

  const makeAgency = (id = 'a-1'): AgencyRecord => ({
    id,
    name: 'Star Agency',
    description: null,
    idolCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
  });

  type CreateInput = Parameters<AdminIdolRepository['create']>[0];

  const makeRepos = () => {
    const agencyState = new Map<string, AgencyRecord>();
    let lastCreate: CreateInput | null = null;

    const agencies: AgencyRepository = {
      list: jest.fn(async () => Array.from(agencyState.values())),
      findById: jest.fn(async (id) => agencyState.get(id) ?? null),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const idols: AdminIdolRepository = {
      listAll: jest.fn(),
      getListIdentity: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(async (input) => {
        lastCreate = input;
        const r: AdminIdolRecord = {
          id: 'i-1',
          agencyId: input.agencyId,
          agencyName: 'Star Agency',
          name: input.name,
          stageName: input.stageName,
          birthdate: input.birthdate,
          mbti: input.mbti,
          bio: input.bio,
          heroImageUrl: input.heroImageUrl,
          heartCount: 0,
          followCount: 0,
          publishedAt: input.publishImmediately ? NOW : null,
          deletedAt: null,
          createdAt: NOW,
          updatedAt: NOW,
        };
        return r;
      }),
      update: jest.fn(),
      setPublished: jest.fn(),
      softDelete: jest.fn(),
    };

    return { agencies, idols, agencyState, getLastCreate: () => lastCreate };
  };

  it('TC-CI-001 — agency 가 없으면 AGENCY_NOT_FOUND', async () => {
    const { agencies, idols } = makeRepos();
    const uc = new CreateIdolUseCase(idols, agencies);
    await expect(
      uc.execute({ agencyId: 'unknown', name: 'New Idol' }),
    ).rejects.toMatchObject({ code: 'AGENCY_NOT_FOUND' });
  });

  it('TC-CI-002 — name 트림, mbti 대문자 + 4자 절단', async () => {
    const { agencies, idols, agencyState, getLastCreate } = makeRepos();
    agencyState.set('a-1', makeAgency('a-1'));

    const uc = new CreateIdolUseCase(idols, agencies);
    await uc.execute({
      agencyId: 'a-1',
      name: '  Lee  ',
      mbti: ' enfp_extra ',
    });

    const c = getLastCreate();
    expect(c).not.toBeNull();
    expect(c!.name).toBe('Lee');
    expect(c!.mbti).toBe('ENFP'); // 대문자 + 4자 절단
  });

  it('TC-CI-003 — null 처리: 빈 string → null', async () => {
    const { agencies, idols, agencyState, getLastCreate } = makeRepos();
    agencyState.set('a-1', makeAgency('a-1'));

    const uc = new CreateIdolUseCase(idols, agencies);
    await uc.execute({
      agencyId: 'a-1',
      name: 'X',
      stageName: '   ',
      bio: '',
      heroImageUrl: undefined,
    });

    const c = getLastCreate()!;
    expect(c.stageName).toBeNull();
    expect(c.bio).toBeNull();
    expect(c.heroImageUrl).toBeNull();
  });

  it('TC-CI-004 — birthdate ISO → Date 변환', async () => {
    const { agencies, idols, agencyState, getLastCreate } = makeRepos();
    agencyState.set('a-1', makeAgency('a-1'));

    const uc = new CreateIdolUseCase(idols, agencies);
    await uc.execute({
      agencyId: 'a-1',
      name: 'X',
      birthdate: '2002-05-14',
    });

    const c = getLastCreate()!;
    expect(c.birthdate).toBeInstanceOf(Date);
    expect(c.birthdate?.toISOString().slice(0, 10)).toBe('2002-05-14');
  });

  it('TC-CI-005 — publishImmediately 기본값 false', async () => {
    const { agencies, idols, agencyState, getLastCreate } = makeRepos();
    agencyState.set('a-1', makeAgency('a-1'));

    const uc = new CreateIdolUseCase(idols, agencies);
    await uc.execute({ agencyId: 'a-1', name: 'X' });

    expect(getLastCreate()!.publishImmediately).toBe(false);
  });

  it('TC-CI-006 — publishImmediately=true 전달', async () => {
    const { agencies, idols, agencyState } = makeRepos();
    agencyState.set('a-1', makeAgency('a-1'));

    const uc = new CreateIdolUseCase(idols, agencies);
    const out = await uc.execute({
      agencyId: 'a-1',
      name: 'X',
      publishImmediately: true,
    });
    expect(out.publishedAt).not.toBeNull();
  });
});
