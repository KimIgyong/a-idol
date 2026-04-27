import { CancelAutoMessageUseCase } from './cancel-auto-message.usecase';
import type {
  AutoMessageRecord,
  AutoMessageRepository,
  AutoMessageScheduler,
} from './auto-message-interfaces';

/** T-084 — cancel-auto-message: 상태별 분기 (DISPATCHED 거부, CANCELED idempotent). */
describe('CancelAutoMessageUseCase', () => {
  const NOW = new Date('2026-04-28T00:00:00Z');

  const makeRecord = (overrides: Partial<AutoMessageRecord> = {}): AutoMessageRecord => ({
    id: 'am-1',
    idolId: 'i-1',
    idolName: 'Lee',
    title: 't',
    content: 'c',
    scheduledAt: new Date(NOW.getTime() + 86_400_000),
    dispatchedAt: null,
    status: 'SCHEDULED',
    recipients: 0,
    failedReason: null,
    createdBy: 'admin-1',
    createdAt: NOW,
    ...overrides,
  });

  const makeDeps = (record: AutoMessageRecord | null) => {
    const updates: Array<{ id: string; status: string }> = [];
    const cancelled: string[] = [];
    const repo: AutoMessageRepository = {
      create: jest.fn(),
      findById: jest.fn(async () => record),
      list: jest.fn(),
      updateStatus: jest.fn(async (id, patch) => {
        updates.push({ id, status: patch.status });
        return makeRecord({ ...(record ?? {}), id, status: patch.status });
      }),
    };
    const scheduler: AutoMessageScheduler = {
      schedule: jest.fn(),
      cancel: jest.fn(async (id) => {
        cancelled.push(id);
      }),
    };
    return { repo, scheduler, updates, cancelled };
  };

  it('TC-CAM-001 — 미존재 → AUTO_MESSAGE_NOT_FOUND', async () => {
    const { repo, scheduler } = makeDeps(null);
    const uc = new CancelAutoMessageUseCase(repo, scheduler);
    await expect(uc.execute('missing')).rejects.toMatchObject({
      code: 'AUTO_MESSAGE_NOT_FOUND',
    });
  });

  it('TC-CAM-002 — DISPATCHED 상태 → AUTO_MESSAGE_ALREADY_DISPATCHED', async () => {
    const { repo, scheduler } = makeDeps(makeRecord({ status: 'DISPATCHED' }));
    const uc = new CancelAutoMessageUseCase(repo, scheduler);
    await expect(uc.execute('am-1')).rejects.toMatchObject({
      code: 'AUTO_MESSAGE_ALREADY_DISPATCHED',
    });
  });

  it('TC-CAM-003 — 이미 CANCELED → 그대로 반환 (no-op, scheduler.cancel 안 부름)', async () => {
    const { repo, scheduler } = makeDeps(makeRecord({ status: 'CANCELED' }));
    const uc = new CancelAutoMessageUseCase(repo, scheduler);
    const out = await uc.execute('am-1');
    expect(out.status).toBe('CANCELED');
    expect(scheduler.cancel).not.toHaveBeenCalled();
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it('TC-CAM-004 — PENDING → scheduler.cancel + status=CANCELED 갱신', async () => {
    const { repo, scheduler, cancelled, updates } = makeDeps(makeRecord({ status: 'SCHEDULED' }));
    const uc = new CancelAutoMessageUseCase(repo, scheduler);
    const out = await uc.execute('am-1');
    expect(cancelled).toEqual(['am-1']);
    expect(updates).toEqual([{ id: 'am-1', status: 'CANCELED' }]);
    expect(out.status).toBe('CANCELED');
  });
});
