import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CreateRoundUseCase,
  DeleteRoundUseCase,
  TransitionRoundUseCase,
  UpdateRoundUseCase,
} from './round.usecases';
import type {
  AuditionRecord,
  AuditionRepository,
  RoundRecord,
  RoundRepository,
} from './interfaces';
import { AUDITION_EVENTS } from './events';

/** T-084 — round usecases. State machine + parent audition guards + events. */
describe('round usecases', () => {
  const NOW = new Date('2026-04-27T00:00:00Z');
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

  const makeRound = (overrides: Partial<RoundRecord> = {}): RoundRecord => ({
    id: 'r-1',
    auditionId: 'a-1',
    name: 'R1',
    orderIndex: 1,
    status: 'SCHEDULED',
    startAt: NOW,
    endAt: PLUS_DAY,
    maxAdvancers: null,
    ...overrides,
  });

  const makeDeps = (opts: {
    audition?: AuditionRecord | null;
    round?: RoundRecord | null;
  } = {}) => {
    const touchedIds: string[] = [];
    const auditions: AuditionRepository = {
      create: jest.fn(),
      findById: jest.fn(async () => opts.audition ?? null),
      findDetail: jest.fn(),
      listAdmin: jest.fn(),
      listActive: jest.fn(),
      listFinished: jest.fn(),
      update: jest.fn(),
      setStatus: jest.fn(),
      touchUpdatedAt: jest.fn(async (id) => {
        touchedIds.push(id);
      }),
      softDelete: jest.fn(),
    };
    const rounds: RoundRepository = {
      create: jest.fn(async (input) => makeRound({
        id: 'r-new',
        auditionId: input.auditionId,
        name: input.name,
        orderIndex: input.orderIndex,
        startAt: input.startAt,
        endAt: input.endAt,
        maxAdvancers: input.maxAdvancers,
      })),
      findById: jest.fn(async () => opts.round ?? null),
      listByAudition: jest.fn(),
      update: jest.fn(async (id, patch) => {
        const cur = opts.round!;
        return makeRound({
          ...cur,
          id,
          name: patch.name ?? cur.name,
          orderIndex: patch.orderIndex ?? cur.orderIndex,
          startAt: patch.startAt ?? cur.startAt,
          endAt: patch.endAt ?? cur.endAt,
          maxAdvancers: patch.maxAdvancers !== undefined ? patch.maxAdvancers : cur.maxAdvancers,
        });
      }),
      setStatus: jest.fn(async (id, status) => makeRound({ ...opts.round!, id, status })),
      delete: jest.fn(),
    };
    const events = new EventEmitter2();
    return { auditions, rounds, events, touchedIds };
  };

  // ===== Create =====

  it('TC-RD-001 — audition 미존재 → AUDITION_NOT_FOUND', async () => {
    const { auditions, rounds } = makeDeps({ audition: null });
    const uc = new CreateRoundUseCase(auditions, rounds);
    await expect(
      uc.execute('missing', {
        name: 'R1',
        orderIndex: 1,
        startAt: NOW.toISOString(),
        endAt: PLUS_DAY.toISOString(),
      }),
    ).rejects.toMatchObject({ code: 'AUDITION_NOT_FOUND' });
  });

  it('TC-RD-002 — soft-deleted audition → AUDITION_NOT_FOUND', async () => {
    const { auditions, rounds } = makeDeps({
      audition: makeAudition({ deletedAt: NOW }),
    });
    const uc = new CreateRoundUseCase(auditions, rounds);
    await expect(
      uc.execute('a-1', {
        name: 'R1',
        orderIndex: 1,
        startAt: NOW.toISOString(),
        endAt: PLUS_DAY.toISOString(),
      }),
    ).rejects.toMatchObject({ code: 'AUDITION_NOT_FOUND' });
  });

  it('TC-RD-003 — FINISHED audition → AUDITION_INVALID_TRANSITION', async () => {
    const { auditions, rounds } = makeDeps({
      audition: makeAudition({ status: 'FINISHED' }),
    });
    const uc = new CreateRoundUseCase(auditions, rounds);
    await expect(
      uc.execute('a-1', {
        name: 'R1',
        orderIndex: 1,
        startAt: NOW.toISOString(),
        endAt: PLUS_DAY.toISOString(),
      }),
    ).rejects.toMatchObject({ code: 'AUDITION_INVALID_TRANSITION' });
  });

  it('TC-RD-004 — endAt <= startAt → AUDITION_INVALID_DATE_RANGE', async () => {
    const { auditions, rounds } = makeDeps({
      audition: makeAudition({ status: 'DRAFT' }),
    });
    const uc = new CreateRoundUseCase(auditions, rounds);
    await expect(
      uc.execute('a-1', {
        name: 'R1',
        orderIndex: 1,
        startAt: PLUS_DAY.toISOString(),
        endAt: NOW.toISOString(),
      }),
    ).rejects.toMatchObject({ code: 'AUDITION_INVALID_DATE_RANGE' });
  });

  it('TC-RD-005 — 정상 create: round 반환 + parent touchUpdatedAt 호출', async () => {
    const { auditions, rounds, touchedIds } = makeDeps({
      audition: makeAudition({ status: 'DRAFT' }),
    });
    const uc = new CreateRoundUseCase(auditions, rounds);
    const out = await uc.execute('a-1', {
      name: '  R1  ',
      orderIndex: 1,
      startAt: NOW.toISOString(),
      endAt: PLUS_DAY.toISOString(),
    });
    expect(out.name).toBe('R1');
    expect(touchedIds).toEqual(['a-1']);
  });

  // ===== Update =====

  it('TC-RD-006 — Update: round 미존재 → ROUND_NOT_FOUND', async () => {
    const { auditions, rounds } = makeDeps({ round: null });
    const uc = new UpdateRoundUseCase(auditions, rounds);
    await expect(uc.execute('r-1', { name: 'X' })).rejects.toMatchObject({
      code: 'ROUND_NOT_FOUND',
    });
  });

  it('TC-RD-007 — Update: ACTIVE round → ROUND_INVALID_TRANSITION', async () => {
    const { auditions, rounds } = makeDeps({
      round: makeRound({ status: 'ACTIVE' }),
    });
    const uc = new UpdateRoundUseCase(auditions, rounds);
    await expect(uc.execute('r-1', { name: 'X' })).rejects.toMatchObject({
      code: 'ROUND_INVALID_TRANSITION',
    });
  });

  it('TC-RD-008 — Update: endAt <= startAt → AUDITION_INVALID_DATE_RANGE', async () => {
    const { auditions, rounds } = makeDeps({
      round: makeRound({ status: 'SCHEDULED' }),
    });
    const uc = new UpdateRoundUseCase(auditions, rounds);
    await expect(
      uc.execute('r-1', { startAt: PLUS_DAY.toISOString(), endAt: NOW.toISOString() }),
    ).rejects.toMatchObject({ code: 'AUDITION_INVALID_DATE_RANGE' });
  });

  it('TC-RD-009 — Update: SCHEDULED round 정상 + parent touchUpdatedAt', async () => {
    const { auditions, rounds, touchedIds } = makeDeps({
      round: makeRound({ status: 'SCHEDULED' }),
    });
    const uc = new UpdateRoundUseCase(auditions, rounds);
    const out = await uc.execute('r-1', { name: '  Renamed  ' });
    expect(out.name).toBe('Renamed');
    expect(touchedIds).toEqual(['a-1']);
  });

  // ===== Transition =====

  it('TC-RD-010 — Transition: round 미존재 → ROUND_NOT_FOUND', async () => {
    const { auditions, rounds, events } = makeDeps({ round: null });
    const uc = new TransitionRoundUseCase(auditions, rounds, events);
    await expect(uc.execute('missing', 'ACTIVE')).rejects.toMatchObject({
      code: 'ROUND_NOT_FOUND',
    });
  });

  it('TC-RD-011 — Transition: SCHEDULED→ACTIVE 인데 parent audition !ACTIVE → AUDITION_NOT_ACTIVE', async () => {
    const { auditions, rounds, events } = makeDeps({
      round: makeRound({ status: 'SCHEDULED' }),
      audition: makeAudition({ status: 'DRAFT' }),
    });
    const uc = new TransitionRoundUseCase(auditions, rounds, events);
    await expect(uc.execute('r-1', 'ACTIVE')).rejects.toMatchObject({
      code: 'AUDITION_NOT_ACTIVE',
    });
  });

  it('TC-RD-012 — Transition: SCHEDULED→ACTIVE 정상 (parent ACTIVE)', async () => {
    const { auditions, rounds, events, touchedIds } = makeDeps({
      round: makeRound({ status: 'SCHEDULED' }),
      audition: makeAudition({ status: 'ACTIVE' }),
    });
    const uc = new TransitionRoundUseCase(auditions, rounds, events);
    const out = await uc.execute('r-1', 'ACTIVE');
    expect(out.status).toBe('ACTIVE');
    expect(touchedIds).toEqual(['a-1']);
  });

  it('TC-RD-013 — Transition: ACTIVE→CLOSED + ROUND_CLOSED 이벤트 발행', async () => {
    const { auditions, rounds, events, touchedIds } = makeDeps({
      round: makeRound({ status: 'ACTIVE' }),
    });
    const captured: unknown[] = [];
    events.on(AUDITION_EVENTS.ROUND_CLOSED, (e) => captured.push(e));

    const uc = new TransitionRoundUseCase(auditions, rounds, events);
    const out = await uc.execute('r-1', 'CLOSED');
    expect(out.status).toBe('CLOSED');
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({
      roundId: 'r-1',
      auditionId: 'a-1',
    });
    expect(touchedIds).toEqual(['a-1']);
  });

  it('TC-RD-014 — Transition: 잘못된 전이 (CLOSED→ACTIVE) → ROUND_INVALID_TRANSITION', async () => {
    const { auditions, rounds, events } = makeDeps({
      round: makeRound({ status: 'CLOSED' }),
    });
    const uc = new TransitionRoundUseCase(auditions, rounds, events);
    await expect(uc.execute('r-1', 'ACTIVE')).rejects.toMatchObject({
      code: 'ROUND_INVALID_TRANSITION',
    });
  });

  // ===== Delete =====

  it('TC-RD-015 — Delete: round 미존재 → ROUND_NOT_FOUND', async () => {
    const { auditions, rounds } = makeDeps({ round: null });
    const uc = new DeleteRoundUseCase(auditions, rounds);
    await expect(uc.execute('missing')).rejects.toMatchObject({ code: 'ROUND_NOT_FOUND' });
  });

  it('TC-RD-016 — Delete: ACTIVE round → ROUND_INVALID_TRANSITION', async () => {
    const { auditions, rounds } = makeDeps({
      round: makeRound({ status: 'ACTIVE' }),
    });
    const uc = new DeleteRoundUseCase(auditions, rounds);
    await expect(uc.execute('r-1')).rejects.toMatchObject({
      code: 'ROUND_INVALID_TRANSITION',
    });
  });

  it('TC-RD-017 — Delete: SCHEDULED 정상 + parent touchUpdatedAt', async () => {
    const { auditions, rounds, touchedIds } = makeDeps({
      round: makeRound({ status: 'SCHEDULED' }),
    });
    const uc = new DeleteRoundUseCase(auditions, rounds);
    await uc.execute('r-1');
    expect(touchedIds).toEqual(['a-1']);
  });
});
