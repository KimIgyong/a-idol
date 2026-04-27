import { User } from '@a-idol/shared';
import { GetMeUseCase } from './get-me.usecase';
import type { UserRepository } from './interfaces';

/** T-084 — get-me usecase. */
describe('GetMeUseCase', () => {
  const NOW = new Date('2026-04-28T00:00:00Z');

  const makeUser = (id = 'u-1') =>
    User.create({
      id,
      provider: 'email',
      providerUserId: id,
      email: `${id}@a-idol.dev`,
      nickname: 'demo',
      avatarUrl: null,
      birthdate: new Date('2000-01-01'),
      status: 'active',
      marketingOptIn: false,
      pushOptIn: true,
      createdAt: NOW,
    });

  it('TC-GM-001 — repo 에서 찾으면 User 반환', async () => {
    const u = makeUser('u-1');
    const repo: UserRepository = {
      findByEmail: jest.fn(),
      findByProvider: jest.fn(),
      findById: jest.fn(async () => u),
      create: jest.fn(),
      update: jest.fn(),
    };
    const uc = new GetMeUseCase(repo);
    const out = await uc.execute('u-1');
    expect(out).toBe(u);
  });

  it('TC-GM-002 — 없으면 SESSION_NOT_FOUND', async () => {
    const repo: UserRepository = {
      findByEmail: jest.fn(),
      findByProvider: jest.fn(),
      findById: jest.fn(async () => null),
      create: jest.fn(),
      update: jest.fn(),
    };
    const uc = new GetMeUseCase(repo);
    await expect(uc.execute('missing')).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
  });
});
