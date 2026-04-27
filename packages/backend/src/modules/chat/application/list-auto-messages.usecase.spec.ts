import { ListAutoMessagesUseCase } from './list-auto-messages.usecase';
import type { AutoMessageRepository } from './auto-message-interfaces';

/** T-084 — list-auto-messages: page/size 클램프 + skip 계산. */
describe('ListAutoMessagesUseCase', () => {
  const makeRepo = (): {
    repo: AutoMessageRepository;
    lastOpts: () => Parameters<AutoMessageRepository['list']>[0] | null;
  } => {
    let captured: Parameters<AutoMessageRepository['list']>[0] | null = null;
    const repo: AutoMessageRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      list: jest.fn(async (opts) => {
        captured = opts;
        return { items: [], total: 0 };
      }),
      updateStatus: jest.fn(),
    };
    return { repo, lastOpts: () => captured };
  };

  it('TC-LAM-001 — page=1, size=20 → take=20, skip=0', async () => {
    const { repo, lastOpts } = makeRepo();
    const uc = new ListAutoMessagesUseCase(repo);
    await uc.execute({ page: 1, size: 20 });
    expect(lastOpts()).toMatchObject({ take: 20, skip: 0 });
  });

  it('TC-LAM-002 — page=3, size=10 → skip=20', async () => {
    const { repo, lastOpts } = makeRepo();
    const uc = new ListAutoMessagesUseCase(repo);
    await uc.execute({ page: 3, size: 10 });
    expect(lastOpts()).toMatchObject({ take: 10, skip: 20 });
  });

  it('TC-LAM-003 — page<1 클램프 → page=1', async () => {
    const { repo, lastOpts } = makeRepo();
    const uc = new ListAutoMessagesUseCase(repo);
    await uc.execute({ page: 0, size: 10 });
    expect(lastOpts()).toMatchObject({ skip: 0 });
  });

  it('TC-LAM-004 — size>100 클램프 → 100', async () => {
    const { repo, lastOpts } = makeRepo();
    const uc = new ListAutoMessagesUseCase(repo);
    await uc.execute({ page: 1, size: 999 });
    expect(lastOpts()?.take).toBe(100);
  });

  it('TC-LAM-005 — size<1 클램프 → 1', async () => {
    const { repo, lastOpts } = makeRepo();
    const uc = new ListAutoMessagesUseCase(repo);
    await uc.execute({ page: 1, size: 0 });
    expect(lastOpts()?.take).toBe(1);
  });

  it('TC-LAM-006 — idolId / status filter 그대로 전달', async () => {
    const { repo, lastOpts } = makeRepo();
    const uc = new ListAutoMessagesUseCase(repo);
    await uc.execute({ idolId: 'i-1', status: 'SCHEDULED', page: 1, size: 10 });
    expect(lastOpts()).toMatchObject({ idolId: 'i-1', status: 'SCHEDULED' });
  });
});
