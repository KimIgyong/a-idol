import { LogoutAdminUseCase } from './logout-admin.usecase';
import type {
  AdminAuthSessionRecord,
  AdminAuthSessionRepository,
  AdminTokenService,
} from './interfaces';

/** T-082 — logout-admin: idempotent server-side session revoke. */
describe('LogoutAdminUseCase', () => {
  const NOW = new Date('2026-04-27T00:00:00Z');

  const makeSession = (overrides: Partial<AdminAuthSessionRecord> = {}): AdminAuthSessionRecord => ({
    id: 'sid-1',
    adminUserId: 'admin-1',
    refreshTokenHash: 'h',
    expiresAt: new Date(NOW.getTime() + 14 * 86_400_000),
    revokedAt: null,
    ...overrides,
  });

  const makeDeps = (opts: {
    verifyOk?: boolean;
    session?: AdminAuthSessionRecord | null;
  }) => {
    const revokedIds: string[] = [];
    const tokens: AdminTokenService = {
      signAccess: jest.fn(),
      signRefresh: jest.fn(),
      verifyAccess: jest.fn(),
      verifyRefresh: jest.fn(async () => {
        if (opts.verifyOk === false) throw new Error('bad');
        return { sub: 'admin-1', role: 'admin' as const, sid: 'sid-1' };
      }),
      hashRefresh: jest.fn(),
      accessExpiresInSeconds: jest.fn(),
      refreshExpiresAt: jest.fn(),
    };
    const sessions: AdminAuthSessionRepository = {
      create: jest.fn(),
      findByIdForAdmin: jest.fn(async () => opts.session ?? null),
      revoke: jest.fn(async (id) => {
        revokedIds.push(id);
      }),
      rotate: jest.fn(),
    };
    return { tokens, sessions, revokedIds };
  };

  it('TC-LA-001 — 정상 token + active session → revoke + revoked:true', async () => {
    const { tokens, sessions, revokedIds } = makeDeps({ verifyOk: true, session: makeSession() });
    const uc = new LogoutAdminUseCase(tokens, sessions);
    const out = await uc.execute({ refreshToken: 'good.jws' });
    expect(out).toEqual({ revoked: true });
    expect(revokedIds).toEqual(['sid-1']);
  });

  it('TC-LA-002 — invalid token (verifyRefresh throws) → silent revoked:false', async () => {
    const { tokens, sessions } = makeDeps({ verifyOk: false });
    const uc = new LogoutAdminUseCase(tokens, sessions);
    const out = await uc.execute({ refreshToken: 'bad' });
    expect(out).toEqual({ revoked: false });
    expect(sessions.revoke).not.toHaveBeenCalled();
  });

  it('TC-LA-003 — 이미 revoked 된 session → revoked:false (idempotent)', async () => {
    const { tokens, sessions } = makeDeps({
      verifyOk: true,
      session: makeSession({ revokedAt: NOW }),
    });
    const uc = new LogoutAdminUseCase(tokens, sessions);
    const out = await uc.execute({ refreshToken: 'good.jws' });
    expect(out).toEqual({ revoked: false });
    expect(sessions.revoke).not.toHaveBeenCalled();
  });

  it('TC-LA-004 — session 미존재 → revoked:false', async () => {
    const { tokens, sessions } = makeDeps({ verifyOk: true, session: null });
    const uc = new LogoutAdminUseCase(tokens, sessions);
    const out = await uc.execute({ refreshToken: 'good.jws' });
    expect(out).toEqual({ revoked: false });
  });
});
