import { User } from '@a-idol/shared';
import { UpdateMeUseCase } from './update-me.usecase';
import type { UserRepository } from './interfaces';

/** T-084 — update-me usecase. */
describe('UpdateMeUseCase', () => {
  const NOW = new Date('2026-04-28T00:00:00Z');

  const makeUser = (overrides: Partial<{
    avatarUrl: string | null;
    marketingOptIn: boolean;
    pushOptIn: boolean;
  }> = {}) =>
    User.create({
      id: 'u-1',
      provider: 'email',
      providerUserId: 'u-1',
      email: 'u@a-idol.dev',
      nickname: 'demo',
      avatarUrl: overrides.avatarUrl ?? null,
      birthdate: new Date('2000-01-01'),
      status: 'active',
      marketingOptIn: overrides.marketingOptIn ?? false,
      pushOptIn: overrides.pushOptIn ?? true,
      createdAt: NOW,
    });

  const makeRepo = (initial: User | null) => {
    let cur = initial;
    const repo: UserRepository = {
      findByEmail: jest.fn(),
      findByProvider: jest.fn(),
      findById: jest.fn(async () => cur),
      create: jest.fn(),
      update: jest.fn(async (_id, patch) => {
        if (!cur) throw new Error('fake: no user');
        cur = makeUser({
          avatarUrl: patch.avatarUrl !== undefined ? patch.avatarUrl : cur.avatarUrl,
          marketingOptIn: patch.marketingOptIn ?? cur.marketingOptIn,
          pushOptIn: patch.pushOptIn ?? cur.pushOptIn,
        });
        return cur;
      }),
    };
    return { repo };
  };

  it('TC-UM-001 — 사용자 미존재 → SESSION_NOT_FOUND', async () => {
    const { repo } = makeRepo(null);
    const uc = new UpdateMeUseCase(repo);
    await expect(uc.execute('missing', { avatarUrl: 'https://x' })).rejects.toMatchObject({
      code: 'SESSION_NOT_FOUND',
    });
  });

  it('TC-UM-002 — partial: marketingOptIn 만 변경, pushOptIn 그대로', async () => {
    const { repo } = makeRepo(makeUser({ marketingOptIn: false, pushOptIn: true }));
    const uc = new UpdateMeUseCase(repo);
    const out = await uc.execute('u-1', { marketingOptIn: true });
    expect(out.marketingOptIn).toBe(true);
    expect(out.pushOptIn).toBe(true);
  });

  it('TC-UM-003 — avatarUrl=null 명시적 제거', async () => {
    const { repo } = makeRepo(makeUser({ avatarUrl: 'https://x.jpg' }));
    const uc = new UpdateMeUseCase(repo);
    const out = await uc.execute('u-1', { avatarUrl: null });
    expect(out.avatarUrl).toBeNull();
  });

  it('TC-UM-004 — 빈 patch (변경 없음) 도 안전 통과', async () => {
    const { repo } = makeRepo(makeUser());
    const uc = new UpdateMeUseCase(repo);
    const out = await uc.execute('u-1', {});
    expect(out).toBeDefined();
    expect(repo.update).toHaveBeenCalledWith('u-1', {});
  });
});
