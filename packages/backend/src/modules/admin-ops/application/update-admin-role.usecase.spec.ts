import { UpdateAdminRoleUseCase } from './update-admin-role.usecase';
import type { AdminUserRepository } from './interfaces';
import { AdminUser } from '../domain/admin-user';

/** TC-UR — FR-102-B UpdateAdminRoleUseCase. */
describe('UpdateAdminRoleUseCase', () => {
  const NOW = new Date('2026-05-06T00:00:00Z');

  const makeAdmin = (id: string, role: 'admin' | 'operator' | 'viewer' = 'operator') =>
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

  const makeRepo = (overrides: Partial<AdminUserRepository> = {}): AdminUserRepository => ({
    findByEmail: jest.fn(),
    findById: jest.fn(async () => null),
    touchLastLogin: jest.fn(),
    listAll: jest.fn(),
    create: jest.fn(),
    updateRole: jest.fn(async (id, role) => makeAdmin(id, role)),
    countByRole: jest.fn(async () => 2),
    ...overrides,
  });

  it('TC-UR-001 — happy: operator → admin (admin 카운트 < 3)', async () => {
    const repo = makeRepo({
      findById: jest.fn(async () => makeAdmin('target-1', 'operator')),
      countByRole: jest.fn(async () => 1),
    });
    const uc = new UpdateAdminRoleUseCase(repo);
    const out = await uc.execute({
      actorId: 'admin-root',
      targetId: 'target-1',
      role: 'admin',
    });
    expect(out.role).toBe('admin');
    expect(repo.countByRole).toHaveBeenCalledWith('admin');
    expect(repo.updateRole).toHaveBeenCalledWith('target-1', 'admin');
  });

  it('TC-UR-002 — happy: admin → operator (admin 잔여수 ≥ 2)', async () => {
    const repo = makeRepo({
      findById: jest.fn(async () => makeAdmin('target-1', 'admin')),
      countByRole: jest.fn(async () => 2),
    });
    const uc = new UpdateAdminRoleUseCase(repo);
    const out = await uc.execute({
      actorId: 'admin-root',
      targetId: 'target-1',
      role: 'operator',
    });
    expect(out.role).toBe('operator');
  });

  it('TC-UR-003 — 자기 자신 변경 → ADMIN_SELF_MODIFICATION_FORBIDDEN', async () => {
    const repo = makeRepo();
    const uc = new UpdateAdminRoleUseCase(repo);
    await expect(
      uc.execute({ actorId: 'me', targetId: 'me', role: 'operator' }),
    ).rejects.toMatchObject({ code: 'ADMIN_SELF_MODIFICATION_FORBIDDEN' });
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('TC-UR-004 — 대상 미존재 → ADMIN_NOT_FOUND', async () => {
    const repo = makeRepo({ findById: jest.fn(async () => null) });
    const uc = new UpdateAdminRoleUseCase(repo);
    await expect(
      uc.execute({ actorId: 'admin-root', targetId: 'missing', role: 'operator' }),
    ).rejects.toMatchObject({ code: 'ADMIN_NOT_FOUND' });
    expect(repo.updateRole).not.toHaveBeenCalled();
  });

  it('TC-UR-005 — 동일 role → 멱등 no-op (현재 도메인 그대로 반환, updateRole 호출 X)', async () => {
    const target = makeAdmin('target-1', 'operator');
    const repo = makeRepo({ findById: jest.fn(async () => target) });
    const uc = new UpdateAdminRoleUseCase(repo);
    const out = await uc.execute({
      actorId: 'admin-root',
      targetId: 'target-1',
      role: 'operator',
    });
    expect(out).toBe(target);
    expect(repo.updateRole).not.toHaveBeenCalled();
    expect(repo.countByRole).not.toHaveBeenCalled();
  });

  it('TC-UR-006 — 마지막 admin 강등 → ADMIN_LAST_ADMIN_DEMOTION', async () => {
    const repo = makeRepo({
      findById: jest.fn(async () => makeAdmin('last-admin', 'admin')),
      countByRole: jest.fn(async () => 1),
    });
    const uc = new UpdateAdminRoleUseCase(repo);
    await expect(
      uc.execute({ actorId: 'admin-root', targetId: 'last-admin', role: 'operator' }),
    ).rejects.toMatchObject({ code: 'ADMIN_LAST_ADMIN_DEMOTION' });
    expect(repo.updateRole).not.toHaveBeenCalled();
  });

  it('TC-UR-007 — admin 승격이지만 카운트 = 3 → ADMIN_LIMIT_EXCEEDED', async () => {
    const repo = makeRepo({
      findById: jest.fn(async () => makeAdmin('target-1', 'operator')),
      countByRole: jest.fn(async () => 3),
    });
    const uc = new UpdateAdminRoleUseCase(repo);
    await expect(
      uc.execute({ actorId: 'admin-root', targetId: 'target-1', role: 'admin' }),
    ).rejects.toMatchObject({ code: 'ADMIN_LIMIT_EXCEEDED' });
  });

  it('TC-UR-008 — findById 후 updateRole 사이 동시성 삭제 → ADMIN_NOT_FOUND', async () => {
    const repo = makeRepo({
      findById: jest.fn(async () => makeAdmin('target-1', 'operator')),
      updateRole: jest.fn(async () => null),
      countByRole: jest.fn(async () => 1),
    });
    const uc = new UpdateAdminRoleUseCase(repo);
    await expect(
      uc.execute({ actorId: 'admin-root', targetId: 'target-1', role: 'admin' }),
    ).rejects.toMatchObject({ code: 'ADMIN_NOT_FOUND' });
  });
});
