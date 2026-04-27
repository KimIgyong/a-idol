import { RefreshAdminTokenUseCase } from './refresh-admin-token.usecase';
import type {
  AdminAuthSessionRecord,
  AdminAuthSessionRepository,
  AdminTokenService,
  AdminUserRepository,
} from './interfaces';
import { AdminUser } from '../domain/admin-user';

/** T-082 — refresh rotation + reuse-detection. */
describe('RefreshAdminTokenUseCase', () => {
  const NOW = new Date('2026-04-27T00:00:00Z');

  const makeAdmin = (status: 'active' | 'suspended' = 'active') =>
    AdminUser.create({
      id: 'admin-1',
      email: 'admin@a-idol.dev',
      passwordHash: 'h',
      displayName: 'Root',
      role: 'admin',
      status,
      lastLoginAt: NOW,
      createdAt: NOW,
    });

  const makeSession = (overrides: Partial<AdminAuthSessionRecord> = {}): AdminAuthSessionRecord => ({
    id: 'sid-1',
    adminUserId: 'admin-1',
    refreshTokenHash: 'good-hash',
    expiresAt: new Date(NOW.getTime() + 14 * 86_400_000),
    revokedAt: null,
    ...overrides,
  });

  const makeDeps = (opts: {
    verifyOk?: boolean;
    submittedHash?: string;
    session?: AdminAuthSessionRecord | null;
    admin?: AdminUser | null;
  }) => {
    const revokedIds: string[] = [];
    const rotated: Array<{ id: string; hash: string }> = [];
    const tokens: AdminTokenService = {
      signAccess: jest.fn(async () => 'new-access'),
      signRefresh: jest.fn(async () => 'new-refresh'),
      verifyAccess: jest.fn(),
      verifyRefresh: jest.fn(async () => {
        if (opts.verifyOk === false) throw new Error('bad');
        return { sub: 'admin-1', role: 'admin' as const, sid: 'sid-1' };
      }),
      hashRefresh: jest.fn(async (token) => (token === 'new-refresh' ? 'new-hash' : opts.submittedHash ?? 'good-hash')),
      accessExpiresInSeconds: jest.fn(() => 900),
      refreshExpiresAt: jest.fn(() => new Date(NOW.getTime() + 14 * 86_400_000)),
    };
    const sessions: AdminAuthSessionRepository = {
      create: jest.fn(),
      findByIdForAdmin: jest.fn(async () => opts.session ?? null),
      revoke: jest.fn(async (id) => {
        revokedIds.push(id);
      }),
      rotate: jest.fn(async (id, hash) => {
        rotated.push({ id, hash });
        return makeSession({ id, refreshTokenHash: hash });
      }),
    };
    const repo: AdminUserRepository = {
      findByEmail: jest.fn(),
      // null vs undefined 구분 — 'admin' 키가 명시적 null 이면 그걸 사용 (계정 삭제 시뮬).
      findById: jest.fn(async () =>
        Object.prototype.hasOwnProperty.call(opts, 'admin') ? opts.admin ?? null : makeAdmin(),
      ),
      touchLastLogin: jest.fn(),
      listAll: jest.fn(),
    };
    return { tokens, sessions, repo, revokedIds, rotated };
  };

  it('TC-RA-001 — 정상 token + active session → 새 access/refresh + rotate', async () => {
    const { tokens, sessions, repo, rotated } = makeDeps({
      verifyOk: true,
      session: makeSession(),
      admin: makeAdmin('active'),
    });
    const uc = new RefreshAdminTokenUseCase(repo, tokens, sessions);
    const out = await uc.execute({ refreshToken: 'good.jws' });
    expect(out.accessToken).toBe('new-access');
    expect(out.refreshToken).toBe('new-refresh');
    expect(out.expiresIn).toBe(900);
    expect(rotated).toEqual([{ id: 'sid-1', hash: 'new-hash' }]);
  });

  it('TC-RA-002 — verifyRefresh fail → INVALID_REFRESH_TOKEN', async () => {
    const { tokens, sessions, repo } = makeDeps({ verifyOk: false });
    const uc = new RefreshAdminTokenUseCase(repo, tokens, sessions);
    await expect(uc.execute({ refreshToken: 'bad' })).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });
  });

  it('TC-RA-003 — session 미존재 → INVALID_REFRESH_TOKEN', async () => {
    const { tokens, sessions, repo } = makeDeps({ verifyOk: true, session: null });
    const uc = new RefreshAdminTokenUseCase(repo, tokens, sessions);
    await expect(uc.execute({ refreshToken: 'jws' })).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });
  });

  it('TC-RA-004 — revoked session → INVALID_REFRESH_TOKEN', async () => {
    const { tokens, sessions, repo } = makeDeps({
      verifyOk: true,
      session: makeSession({ revokedAt: NOW }),
    });
    const uc = new RefreshAdminTokenUseCase(repo, tokens, sessions);
    await expect(uc.execute({ refreshToken: 'jws' })).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });
  });

  it('TC-RA-005 — expired session → INVALID_REFRESH_TOKEN', async () => {
    const { tokens, sessions, repo } = makeDeps({
      verifyOk: true,
      session: makeSession({ expiresAt: new Date(NOW.getTime() - 1000) }),
    });
    const uc = new RefreshAdminTokenUseCase(repo, tokens, sessions);
    await expect(uc.execute({ refreshToken: 'jws' })).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });
  });

  it('TC-RA-006 — hash mismatch (reuse 의심) → defensive revoke + INVALID_REFRESH_TOKEN', async () => {
    const { tokens, sessions, repo, revokedIds } = makeDeps({
      verifyOk: true,
      session: makeSession({ refreshTokenHash: 'real-hash' }),
      submittedHash: 'wrong-hash', // hashRefresh on submitted token returns this
    });
    const uc = new RefreshAdminTokenUseCase(repo, tokens, sessions);
    await expect(uc.execute({ refreshToken: 'reused' })).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });
    expect(revokedIds).toEqual(['sid-1']); // defensive revoke 이루어짐
  });

  it('TC-RA-007 — admin 계정 삭제됨 → INVALID_REFRESH_TOKEN', async () => {
    const { tokens, sessions, repo } = makeDeps({
      verifyOk: true,
      session: makeSession(),
      admin: null,
    });
    const uc = new RefreshAdminTokenUseCase(repo, tokens, sessions);
    await expect(uc.execute({ refreshToken: 'jws' })).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });
  });

  it('TC-RA-008 — suspended admin → INVALID_CREDENTIAL (assertCanLogin)', async () => {
    const { tokens, sessions, repo } = makeDeps({
      verifyOk: true,
      session: makeSession(),
      admin: makeAdmin('suspended'),
    });
    const uc = new RefreshAdminTokenUseCase(repo, tokens, sessions);
    await expect(uc.execute({ refreshToken: 'jws' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIAL',
    });
  });
});
