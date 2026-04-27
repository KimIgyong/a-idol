import { ErrorCodes, type AuthSession } from '@a-idol/shared';
import { RefreshTokenUseCase } from './refresh-token.usecase';
import type {
  AuthSessionRepository,
  TokenService,
  UserRepository,
} from './interfaces';

/**
 * Session stub — the usecase only calls `.isActive()` + reads
 * `.id` / `.refreshTokenHash`. We mint a minimal object that satisfies
 * that surface without pulling in the full AuthSession entity.
 */
function makeSession(opts: {
  id?: string;
  hash?: string;
  active?: boolean;
}): AuthSession {
  return {
    id: opts.id ?? 'sess-1',
    refreshTokenHash: opts.hash ?? 'h:refresh.jwt',
    isActive: () => opts.active ?? true,
  } as unknown as AuthSession;
}

function makeDeps(opts: {
  verifyThrows?: boolean;
  session?: AuthSession | null;
} = {}) {
  const userRepo: UserRepository = {
    findByEmail: jest.fn(),
    findByProvider: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const sessionRepo: AuthSessionRepository = {
    create: jest.fn(),
    findByIdForUser: jest.fn(async () =>
      'session' in opts ? opts.session ?? null : makeSession({}),
    ),
    revoke: jest.fn(async () => undefined),
    rotate: jest.fn(async () => makeSession({})),
  };
  const tokens: TokenService = {
    signAccess: jest.fn(async () => 'new-access.jwt'),
    signRefresh: jest.fn(async () => 'new-refresh.jwt'),
    verifyAccess: jest.fn(),
    verifyRefresh: jest.fn(async () => {
      if (opts.verifyThrows) throw new Error('jwt expired');
      return { sub: 'uid-1', sid: 'sess-1' };
    }),
    hashRefresh: jest.fn(async (t: string) => `h:${t}`),
    accessExpiresInSeconds: () => 900,
    refreshExpiresAt: () => new Date(Date.now() + 14 * 86400_000),
  };
  return { userRepo, sessionRepo, tokens };
}

describe('RefreshTokenUseCase', () => {
  it('TC-REFRESH-001 — valid refresh → rotates session + returns new tokens', async () => {
    const d = makeDeps();
    const uc = new RefreshTokenUseCase(d.userRepo, d.sessionRepo, d.tokens);
    const res = await uc.execute({ refreshToken: 'refresh.jwt' });
    expect(res.accessToken).toBe('new-access.jwt');
    expect(res.refreshToken).toBe('new-refresh.jwt');
    expect(d.sessionRepo.rotate).toHaveBeenCalledWith(
      'sess-1',
      'h:new-refresh.jwt',
      expect.any(Date),
    );
    expect(d.sessionRepo.revoke).not.toHaveBeenCalled();
  });

  it('TC-REFRESH-002 — signature / expiry failure → INVALID_REFRESH_TOKEN', async () => {
    const d = makeDeps({ verifyThrows: true });
    const uc = new RefreshTokenUseCase(d.userRepo, d.sessionRepo, d.tokens);
    await expect(
      uc.execute({ refreshToken: 'bogus' }),
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_REFRESH_TOKEN });
    expect(d.sessionRepo.findByIdForUser).not.toHaveBeenCalled();
  });

  it('TC-REFRESH-003 — session not found → INVALID_REFRESH_TOKEN', async () => {
    const d = makeDeps({ session: null });
    const uc = new RefreshTokenUseCase(d.userRepo, d.sessionRepo, d.tokens);
    await expect(
      uc.execute({ refreshToken: 'refresh.jwt' }),
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_REFRESH_TOKEN });
  });

  it('TC-REFRESH-004 — session revoked → INVALID_REFRESH_TOKEN', async () => {
    const d = makeDeps({ session: makeSession({ active: false }) });
    const uc = new RefreshTokenUseCase(d.userRepo, d.sessionRepo, d.tokens);
    await expect(
      uc.execute({ refreshToken: 'refresh.jwt' }),
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_REFRESH_TOKEN });
  });

  it('TC-REFRESH-005 — hash mismatch (token reuse) → revokes session + INVALID_REFRESH_TOKEN (defensive)', async () => {
    // Session has a hash for a DIFFERENT refresh token. This is what
    // happens if an attacker captures an old refresh token and replays it
    // after the legitimate user already rotated. We revoke defensively.
    const d = makeDeps({
      session: makeSession({ hash: 'h:different-token' }),
    });
    const uc = new RefreshTokenUseCase(d.userRepo, d.sessionRepo, d.tokens);
    await expect(
      uc.execute({ refreshToken: 'refresh.jwt' }),
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_REFRESH_TOKEN });
    expect(d.sessionRepo.revoke).toHaveBeenCalledWith('sess-1');
    expect(d.sessionRepo.rotate).not.toHaveBeenCalled();
  });
});
