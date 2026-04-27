import { ErrorCodes } from '@a-idol/shared';
import { ScheduleAutoMessageUseCase } from './schedule-auto-message.usecase';
import type {
  AutoMessageRecord,
  AutoMessageRepository,
  AutoMessageScheduler,
} from './auto-message-interfaces';
import type {
  AdminIdolRecord,
  AdminIdolRepository,
} from '../../catalog/application/admin-interfaces';

const idol: AdminIdolRecord = {
  id: 'idol-1',
  agencyId: 'ag-1',
  agencyName: 'Agency',
  name: 'Hyun',
  stageName: 'HYUN',
  birthdate: null,
  mbti: null,
  bio: null,
  heroImageUrl: null,
  heartCount: 0,
  followCount: 0,
  publishedAt: new Date(),
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeDeps(opts: { idol?: AdminIdolRecord | null } = {}) {
  const stored: AutoMessageRecord[] = [];
  const repo: AutoMessageRepository = {
    create: jest.fn(async (input) => {
      const rec: AutoMessageRecord = {
        id: `t-${stored.length + 1}`,
        idolId: input.idolId,
        idolName: 'HYUN',
        title: input.title,
        content: input.content,
        scheduledAt: input.scheduledAt,
        dispatchedAt: null,
        status: 'SCHEDULED',
        recipients: 0,
        failedReason: null,
        createdBy: input.createdBy,
        createdAt: new Date(),
      };
      stored.push(rec);
      return rec;
    }),
    findById: jest.fn(),
    list: jest.fn(),
    updateStatus: jest.fn(),
  };
  const scheduler: AutoMessageScheduler = {
    schedule: jest.fn(async () => undefined),
    cancel: jest.fn(async () => undefined),
  };
  const resolvedIdol = 'idol' in opts ? opts.idol : idol;
  const idols: AdminIdolRepository = {
    listAll: jest.fn(),
    getListIdentity: jest.fn(),
    findById: jest.fn(async () => resolvedIdol ?? null),
    create: jest.fn(),
    update: jest.fn(),
    setPublished: jest.fn(),
    softDelete: jest.fn(),
  };
  return { repo, scheduler, idols };
}

describe('ScheduleAutoMessageUseCase', () => {
  it('TC-AM001 — happy path creates record and enqueues job with correct delay', async () => {
    const d = makeDeps();
    const uc = new ScheduleAutoMessageUseCase(d.repo, d.scheduler, d.idols);
    const future = new Date(Date.now() + 60_000);
    const rec = await uc.execute({
      idolId: 'idol-1',
      title: '내일 컴백',
      content: '응원해주세요!',
      scheduledAt: future.toISOString(),
      createdBy: 'admin-1',
    });
    expect(rec.status).toBe('SCHEDULED');
    expect(d.scheduler.schedule).toHaveBeenCalledWith({
      templateId: rec.id,
      scheduledAt: future,
    });
  });

  it('TC-AM002 — rejects past schedule beyond skew tolerance', async () => {
    const d = makeDeps();
    const uc = new ScheduleAutoMessageUseCase(d.repo, d.scheduler, d.idols);
    const past = new Date(Date.now() - 60_000);
    await expect(
      uc.execute({
        idolId: 'idol-1',
        title: 't',
        content: 'c',
        scheduledAt: past.toISOString(),
        createdBy: 'admin-1',
      }),
    ).rejects.toMatchObject({ code: ErrorCodes.AUTO_MESSAGE_PAST_SCHEDULE });
    expect(d.repo.create).not.toHaveBeenCalled();
    expect(d.scheduler.schedule).not.toHaveBeenCalled();
  });

  it('TC-AM003 — rejects unknown idol', async () => {
    const d = makeDeps({ idol: null });
    const uc = new ScheduleAutoMessageUseCase(d.repo, d.scheduler, d.idols);
    await expect(
      uc.execute({
        idolId: 'idol-404',
        title: 't',
        content: 'c',
        scheduledAt: new Date(Date.now() + 10_000).toISOString(),
        createdBy: 'admin-1',
      }),
    ).rejects.toMatchObject({ code: ErrorCodes.IDOL_NOT_FOUND });
  });
});
