import { ListOperatorsUseCase } from './list-operators.usecase';
import type { AdminUserRepository } from './interfaces';
import { AdminUser } from '../domain/admin-user';

/** T-084 — list-operators usecase. */
describe('ListOperatorsUseCase', () => {
  const NOW = new Date('2026-04-27T00:00:00Z');

  const makeAdmin = (id: string, role: 'admin' | 'operator' | 'viewer' = 'operator'): AdminUser =>
    AdminUser.create({
      id,
      email: `${id}@a-idol.dev`,
      passwordHash: 'h',
      displayName: `User ${id}`,
      role,
      status: 'active',
      lastLoginAt: null,
      createdAt: NOW,
    });

  it('TC-LO-001 — repo.listAll 위임 + 그대로 반환', async () => {
    const repo: AdminUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      touchLastLogin: jest.fn(),
      create: jest.fn(),
      updateRole: jest.fn(),
      countByRole: jest.fn(),
      listAll: jest.fn(async () => [
        makeAdmin('admin-1', 'admin'),
        makeAdmin('op-1', 'operator'),
        makeAdmin('vw-1', 'viewer'),
      ]),
    };
    const uc = new ListOperatorsUseCase(repo);
    const out = await uc.execute();
    expect(out).toHaveLength(3);
    expect(out.map((u) => u.role)).toEqual(['admin', 'operator', 'viewer']);
    expect(repo.listAll).toHaveBeenCalledTimes(1);
  });

  it('TC-LO-002 — empty list 그대로 통과', async () => {
    const repo: AdminUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      touchLastLogin: jest.fn(),
      create: jest.fn(),
      updateRole: jest.fn(),
      countByRole: jest.fn(),
      listAll: jest.fn(async () => []),
    };
    const uc = new ListOperatorsUseCase(repo);
    const out = await uc.execute();
    expect(out).toEqual([]);
  });
});
