import { GetAdminMeUseCase } from './get-admin-me.usecase';
import type { AdminUserRepository } from './interfaces';
import { AdminUser } from '../domain/admin-user';

/** T-084 — get-admin-me usecase. */
describe('GetAdminMeUseCase', () => {
  const NOW = new Date('2026-04-27T00:00:00Z');

  const makeAdmin = (id = 'admin-1') =>
    AdminUser.create({
      id,
      email: `${id}@a-idol.dev`,
      passwordHash: 'h',
      displayName: 'Root',
      role: 'admin',
      status: 'active',
      lastLoginAt: null,
      createdAt: NOW,
    });

  it('TC-GA-001 — repo 에서 찾으면 admin 반환', async () => {
    const admin = makeAdmin('admin-1');
    const repo: AdminUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(async () => admin),
      touchLastLogin: jest.fn(),
      listAll: jest.fn(),
    };
    const uc = new GetAdminMeUseCase(repo);
    const out = await uc.execute('admin-1');
    expect(out.id).toBe('admin-1');
  });

  it('TC-GA-002 — 없으면 SESSION_NOT_FOUND', async () => {
    const repo: AdminUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(async () => null),
      touchLastLogin: jest.fn(),
      listAll: jest.fn(),
    };
    const uc = new GetAdminMeUseCase(repo);
    await expect(uc.execute('missing')).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
  });
});
