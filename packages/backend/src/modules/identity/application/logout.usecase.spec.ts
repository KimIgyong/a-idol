import { AuthSession } from '@a-idol/shared';
import { LogoutUseCase } from './logout.usecase';
import type { AuthSessionRepository, TokenService } from './interfaces';

/** T-082 — user logout: idempotent server-side session revoke. */
describe('LogoutUseCase', () => {
  const NOW = new Date('2026-04-28T00:00:00Z');
  const FUTURE = new Date(NOW.getTime() + 86_400_000);

  const makeSession = (
    overrides: Partial<{ revokedAt: Date | null; expiresAt: Date }> = {},
  ): AuthSession =>
    new AuthSession({
      id: 'sid-1',
      userId: 'u-1',
      refreshTokenHash: 'h',
      deviceId: null,
      createdAt: NOW,
      expiresAt: overrides.expiresAt ?? FUTURE,
      revokedAt: overrides.revokedAt ?? null,
    });

  const makeDeps = (opts: {
    verifyOk?: boolean;
    session?: AuthSession | null;
  }) => {
    const revokedIds: string[] = [];
    const tokens: TokenService = {
      signAccess: jest.fn(),
      signRefresh: jest.fn(),
      verifyAccess: jest.fn(),
      verifyRefresh: jest.fn(async () => {
        if (opts.verifyOk === false) throw new Error('bad');
        return { sub: 'u-1', sid: 'sid-1' };
      }),
      hashRefresh: jest.fn(),
      accessExpiresInSeconds: jest.fn(),
      refreshExpiresAt: jest.fn(),
    };
    const sessions: AuthSessionRepository = {
      create: jest.fn(),
      findByIdForUser: jest.fn(async () => opts.session ?? null),
      revoke: jest.fn(async (id) => {
        revokedIds.push(id);
      }),
      rotate: jest.fn(),
    };
    return { tokens, sessions, revokedIds };
  };

  it('TC-UL-001 — 정상 token + active session → revoke + revoked:true', async () => {
    const { tokens, sessions, revokedIds } = makeDeps({
      verifyOk: true,
      session: makeSession(),
    });
    const uc = new LogoutUseCase(sessions, tokens);
    const out = await uc.execute({ refreshToken: 'good' });
    expect(out).toEqual({ revoked: true });
    expect(revokedIds).toEqual(['sid-1']);
  });

  it('TC-UL-002 — invalid token (verify throws) → silent revoked:false', async () => {
    const { tokens, sessions } = makeDeps({ verifyOk: false });
    const uc = new LogoutUseCase(sessions, tokens);
    const out = await uc.execute({ refreshToken: 'bad' });
    expect(out).toEqual({ revoked: false });
    expect(sessions.revoke).not.toHaveBeenCalled();
  });

  it('TC-UL-003 — session 없음 → revoked:false', async () => {
    const { tokens, sessions } = makeDeps({ verifyOk: true, session: null });
    const uc = new LogoutUseCase(sessions, tokens);
    const out = await uc.execute({ refreshToken: 'good' });
    expect(out).toEqual({ revoked: false });
  });

  it('TC-UL-004 — 이미 revoked 된 session → revoked:false (idempotent)', async () => {
    const { tokens, sessions } = makeDeps({
      verifyOk: true,
      session: makeSession({ revokedAt: NOW }),
    });
    const uc = new LogoutUseCase(sessions, tokens);
    const out = await uc.execute({ refreshToken: 'good' });
    expect(out).toEqual({ revoked: false });
    expect(sessions.revoke).not.toHaveBeenCalled();
  });

  it('TC-UL-005 — 만료된 session → revoked:false', async () => {
    // 실제 시각 (`new Date()`) 대비 과거가 보장되도록 -1년.
    const longPast = new Date(Date.now() - 365 * 86_400_000);
    const { tokens, sessions } = makeDeps({
      verifyOk: true,
      session: makeSession({ expiresAt: longPast }),
    });
    const uc = new LogoutUseCase(sessions, tokens);
    const out = await uc.execute({ refreshToken: 'good' });
    expect(out).toEqual({ revoked: false });
  });
});
