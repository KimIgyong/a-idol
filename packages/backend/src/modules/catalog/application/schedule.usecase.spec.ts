import {
  CreateScheduleUseCase,
  DeleteScheduleUseCase,
  ListSchedulesUseCase,
} from './schedule.usecase';
import type {
  AdminIdolRecord,
  AdminIdolRepository,
  IdolScheduleRecord,
  IdolScheduleRepository,
} from './admin-interfaces';

/** T-084 — Schedule use cases. */
describe('schedule usecases', () => {
  const NOW = new Date('2026-04-27T00:00:00Z');

  const makeIdol = (id = 'i-1'): AdminIdolRecord => ({
    id,
    agencyId: 'a-1',
    agencyName: 'Star',
    name: 'Lee',
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

  const makeSchedule = (overrides: Partial<IdolScheduleRecord> = {}): IdolScheduleRecord => ({
    id: 's-1',
    idolId: 'i-1',
    type: 'OTHER',
    title: 't',
    location: null,
    startAt: NOW,
    endAt: null,
    notes: null,
    createdAt: NOW,
    ...overrides,
  });

  const makeRepos = () => {
    const idolState = new Map<string, AdminIdolRecord>();
    const scheduleState = new Map<string, IdolScheduleRecord>();

    const idols: AdminIdolRepository = {
      listAll: jest.fn(),
      getListIdentity: jest.fn(),
      findById: jest.fn(async (id) => idolState.get(id) ?? null),
      create: jest.fn(),
      update: jest.fn(),
      setPublished: jest.fn(),
      softDelete: jest.fn(),
    };

    const schedules: IdolScheduleRepository = {
      listByIdol: jest.fn(async (idolId) =>
        Array.from(scheduleState.values()).filter((s) => s.idolId === idolId),
      ),
      create: jest.fn(async (input) => {
        const r = makeSchedule({
          id: `s-${scheduleState.size + 1}`,
          idolId: input.idolId,
          type: input.type,
          title: input.title,
          location: input.location,
          startAt: input.startAt,
          endAt: input.endAt,
          notes: input.notes,
        });
        scheduleState.set(r.id, r);
        return r;
      }),
      softDelete: jest.fn(async (id) => {
        scheduleState.delete(id);
      }),
      findById: jest.fn(async (id) => scheduleState.get(id) ?? null),
    };

    return { idols, schedules, idolState, scheduleState };
  };

  it('TC-SCH-001 — list missing idol → IDOL_NOT_FOUND', async () => {
    const { idols, schedules } = makeRepos();
    const uc = new ListSchedulesUseCase(schedules, idols);
    await expect(uc.execute('unknown')).rejects.toMatchObject({ code: 'IDOL_NOT_FOUND' });
  });

  it('TC-SCH-002 — list returns schedules for that idol only', async () => {
    const { idols, schedules, idolState, scheduleState } = makeRepos();
    idolState.set('i-1', makeIdol('i-1'));
    scheduleState.set('s-1', makeSchedule({ id: 's-1', idolId: 'i-1' }));
    scheduleState.set('s-2', makeSchedule({ id: 's-2', idolId: 'i-other' }));

    const uc = new ListSchedulesUseCase(schedules, idols);
    const out = await uc.execute('i-1');
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('s-1');
  });

  it('TC-SCH-003 — create missing idol → IDOL_NOT_FOUND', async () => {
    const { idols, schedules } = makeRepos();
    const uc = new CreateScheduleUseCase(schedules, idols);
    await expect(
      uc.execute('unknown', { title: 't', startAt: NOW.toISOString() }),
    ).rejects.toMatchObject({ code: 'IDOL_NOT_FOUND' });
  });

  it('TC-SCH-004 — create endAt < startAt → INVALID_SCHEDULE_RANGE', async () => {
    const { idols, schedules, idolState } = makeRepos();
    idolState.set('i-1', makeIdol('i-1'));

    const uc = new CreateScheduleUseCase(schedules, idols);
    await expect(
      uc.execute('i-1', {
        title: 't',
        startAt: '2026-05-01T10:00:00Z',
        endAt: '2026-05-01T09:00:00Z',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_SCHEDULE_RANGE' });
  });

  it('TC-SCH-005 — create defaults type=OTHER, trims title/location/notes', async () => {
    const { idols, schedules, idolState } = makeRepos();
    idolState.set('i-1', makeIdol('i-1'));

    const uc = new CreateScheduleUseCase(schedules, idols);
    const out = await uc.execute('i-1', {
      title: '  M!Countdown  ',
      location: '  Studio A  ',
      notes: '   ',
      startAt: '2026-05-01T10:00:00Z',
    });
    expect(out.type).toBe('OTHER');
    expect(out.title).toBe('M!Countdown');
    expect(out.location).toBe('Studio A');
    expect(out.notes).toBeNull();
    expect(out.endAt).toBeNull();
  });

  it('TC-SCH-006 — delete missing → SCHEDULE_NOT_FOUND', async () => {
    const { idols, schedules } = makeRepos();
    const uc = new DeleteScheduleUseCase(schedules);
    await expect(uc.execute('missing')).rejects.toMatchObject({ code: 'SCHEDULE_NOT_FOUND' });
    void idols; // suppress unused warning
  });

  it('TC-SCH-007 — delete existing soft-deletes', async () => {
    const { schedules, scheduleState } = makeRepos();
    scheduleState.set('s-1', makeSchedule({ id: 's-1' }));
    const uc = new DeleteScheduleUseCase(schedules);
    await uc.execute('s-1');
    expect(scheduleState.has('s-1')).toBe(false);
  });
});
