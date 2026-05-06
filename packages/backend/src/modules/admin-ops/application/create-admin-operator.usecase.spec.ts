import { CreateAdminOperatorUseCase } from './create-admin-operator.usecase';
import type { AdminUserRepository } from './interfaces';
import { AdminUser } from '../domain/admin-user';

/** TC-CA — FR-102-A CreateAdminOperatorUseCase. */
describe('CreateAdminOperatorUseCase', () => {
  const NOW = new Date('2026-05-06T00:00:00Z');

  const makeAdmin = (
    id: string,
    role: 'admin' | 'operator' | 'viewer' = 'operator',
    email = `${id}@a-idol.dev`,
  ) =>
    AdminUser.create({
      id,
      email,
      passwordHash: 'h',
      displayName: `User ${id}`,
      role,
      status: 'active',
      lastLoginAt: null,
      createdAt: NOW,
    });

  const makeRepo = (overrides: Partial<AdminUserRepository> = {}): AdminUserRepository => ({
    findByEmail: jest.fn(async () => null),
    findById: jest.fn(),
    touchLastLogin: jest.fn(),
    listAll: jest.fn(),
    create: jest.fn(async (input) =>
      makeAdmin('created-1', input.role, input.email),
    ),
    updateRole: jest.fn(),
    countByRole: jest.fn(async () => 0),
    ...overrides,
  });

  it('TC-CA-001 — happy path: operator 역할로 생성', async () => {
    const repo = makeRepo();
    const uc = new CreateAdminOperatorUseCase(repo);
    const out = await uc.execute({
      actorId: 'admin-root',
      email: 'ops2@a-idol.dev',
      displayName: 'Yuna Park',
      passwordHash: 'hash-x',
      role: 'operator',
    });
    expect(out.email).toBe('ops2@a-idol.dev');
    expect(out.role).toBe('operator');
    expect(repo.create).toHaveBeenCalledWith({
      email: 'ops2@a-idol.dev',
      passwordHash: 'hash-x',
      displayName: 'Yuna Park',
      role: 'operator',
    });
    expect(repo.countByRole).not.toHaveBeenCalled();
  });

  it('TC-CA-002 — admin 역할로 생성 시 카운트 검증 (현재 < 3 → 통과)', async () => {
    const repo = makeRepo({ countByRole: jest.fn(async () => 2) });
    const uc = new CreateAdminOperatorUseCase(repo);
    await uc.execute({
      actorId: 'admin-root',
      email: 'admin2@a-idol.dev',
      displayName: 'Mina',
      passwordHash: 'h',
      role: 'admin',
    });
    expect(repo.countByRole).toHaveBeenCalledWith('admin');
    expect(repo.create).toHaveBeenCalled();
  });

  it('TC-CA-003 — admin 카운트 = 3 이면 ADMIN_LIMIT_EXCEEDED', async () => {
    const repo = makeRepo({ countByRole: jest.fn(async () => 3) });
    const uc = new CreateAdminOperatorUseCase(repo);
    await expect(
      uc.execute({
        actorId: 'admin-root',
        email: 'admin4@a-idol.dev',
        displayName: 'X',
        passwordHash: 'h',
        role: 'admin',
      }),
    ).rejects.toMatchObject({ code: 'ADMIN_LIMIT_EXCEEDED' });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('TC-CA-004 — 이메일 중복 시 ADMIN_EMAIL_DUPLICATE', async () => {
    const repo = makeRepo({
      findByEmail: jest.fn(async () => makeAdmin('existing', 'operator', 'dup@a-idol.dev')),
    });
    const uc = new CreateAdminOperatorUseCase(repo);
    await expect(
      uc.execute({
        actorId: 'admin-root',
        email: 'dup@a-idol.dev',
        displayName: 'Y',
        passwordHash: 'h',
        role: 'operator',
      }),
    ).rejects.toMatchObject({ code: 'ADMIN_EMAIL_DUPLICATE' });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('TC-CA-005 — 이메일 중복 검증이 admin-카운트 검증보다 먼저 (admin 한도 차도 dup 우선)', async () => {
    const repo = makeRepo({
      findByEmail: jest.fn(async () => makeAdmin('existing')),
      countByRole: jest.fn(async () => 3),
    });
    const uc = new CreateAdminOperatorUseCase(repo);
    await expect(
      uc.execute({
        actorId: 'admin-root',
        email: 'dup@a-idol.dev',
        displayName: 'Z',
        passwordHash: 'h',
        role: 'admin',
      }),
    ).rejects.toMatchObject({ code: 'ADMIN_EMAIL_DUPLICATE' });
    expect(repo.countByRole).not.toHaveBeenCalled();
  });
});
