import { ErrorCodes, User, type AuthSession } from '@a-idol/shared';
import { LoginWithEmailUseCase } from './login-with-email.usecase';
import type {
  AuthSessionRepository,
  LoginAttemptThrottle,
  PasswordHasher,
  TokenService,
  UserRepository,
} from './interfaces';

/**
 * Mint a fake `User` that also has a toJSON() override matching what
 * PrismaUserRepository injects — login reads `passwordHash` via that
 * backdoor to keep the hash out of the User domain entity shape.
 */
function makeUser(overrides: {
  id?: string;
  email?: string | null;
  passwordHash?: string | null;
}): User {
  const user = User.create({
    id: overrides.id ?? 'uid-1',
    provider: 'email',
    providerUserId: overrides.email ?? 'uid-1',
    email: overrides.email ?? 'demo@a-idol.dev',
    nickname: 'demo',
    avatarUrl: null,
    birthdate: new Date('2000-01-01'),
    status: 'active',
    marketingOptIn: false,
    pushOptIn: true,
    createdAt: new Date(),
  });
  // `??` coerces explicit `null` to the default; check via `in` so
  // passing `passwordHash: null` (social-login user) is preserved.
  const passwordHash =
    'passwordHash' in overrides ? overrides.passwordHash : 'stored-hash';
  Object.defineProperty(user, 'toJSON', {
    value: () => ({ passwordHash }),
    enumerable: false,
  });
  return user;
}

function makeDeps(opts: {
  user?: User | null;
  verifyResult?: boolean;
} = {}) {
  const userRepo: UserRepository = {
    findByEmail: jest.fn(async () => opts.user === undefined ? makeUser({}) : opts.user),
    findByProvider: jest.fn(async () => null),
    findById: jest.fn(async () => null),
    create: jest.fn(),
    update: jest.fn(),
  };
  const sessionRepo: AuthSessionRepository = {
    create: jest.fn(async () => ({ id: 'sess-1' }) as unknown as AuthSession),
    findByIdForUser: jest.fn(async () => null),
    revoke: jest.fn(async () => undefined),
    rotate: jest.fn(async () => ({}) as unknown as AuthSession),
  };
  const hasher: PasswordHasher = {
    hash: jest.fn(async () => 'hashed'),
    verify: jest.fn(async () => opts.verifyResult ?? true),
  };
  const tokens: TokenService = {
    signAccess: jest.fn(async () => 'access.jwt'),
    signRefresh: jest.fn(async () => 'refresh.jwt'),
    verifyAccess: jest.fn(),
    verifyRefresh: jest.fn(),
    hashRefresh: jest.fn(async (t: string) => `h:${t}`),
    accessExpiresInSeconds: () => 900,
    refreshExpiresAt: () => new Date(Date.now() + 14 * 86400_000),
  };
  const attempts: LoginAttemptThrottle = {
    recordFailure: jest.fn(async () => undefined),
    clearFailures: jest.fn(async () => undefined),
    status: jest.fn(async () => ({ locked: false, retryAfterSec: 0 })),
  };
  return { userRepo, sessionRepo, hasher, tokens, attempts };
}

describe('LoginWithEmailUseCase', () => {
  it('TC-LOGIN-001 — happy path returns tokens + creates session', async () => {
    const d = makeDeps();
    const uc = new LoginWithEmailUseCase(d.userRepo, d.sessionRepo, d.hasher, d.tokens, d.attempts);
    const res = await uc.execute({
      email: 'demo@a-idol.dev',
      password: 'password123',
    });
    expect(res.accessToken).toBe('access.jwt');
    expect(res.refreshToken).toBe('refresh.jwt');
    expect(res.expiresIn).toBe(900);
    expect(d.sessionRepo.create).toHaveBeenCalledTimes(1);
    expect(d.hasher.verify).toHaveBeenCalledWith('password123', 'stored-hash');
  });

  it('TC-LOGIN-002 — unknown email → INVALID_CREDENTIAL (no timing leak via different error code)', async () => {
    const d = makeDeps({ user: null });
    const uc = new LoginWithEmailUseCase(d.userRepo, d.sessionRepo, d.hasher, d.tokens, d.attempts);
    await expect(
      uc.execute({ email: 'ghost@a-idol.dev', password: 'x' }),
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_CREDENTIAL });
    // Hasher never called — defense against enumerating accounts by timing.
    expect(d.hasher.verify).not.toHaveBeenCalled();
    expect(d.sessionRepo.create).not.toHaveBeenCalled();
  });

  it('TC-LOGIN-003 — wrong password → INVALID_CREDENTIAL and no session created', async () => {
    const d = makeDeps({ verifyResult: false });
    const uc = new LoginWithEmailUseCase(d.userRepo, d.sessionRepo, d.hasher, d.tokens, d.attempts);
    await expect(
      uc.execute({ email: 'demo@a-idol.dev', password: 'wrong' }),
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_CREDENTIAL });
    expect(d.hasher.verify).toHaveBeenCalled();
    expect(d.sessionRepo.create).not.toHaveBeenCalled();
  });

  it('TC-LOGIN-004 — social-only account (no password hash) → INVALID_CREDENTIAL before hasher runs', async () => {
    // User signed up via social (Kakao/Apple) — passwordHash is null on
    // the row. Attempting password login should NOT reveal that the email
    // exists (same error code as TC-LOGIN-002).
    const d = makeDeps({ user: makeUser({ passwordHash: null }) });
    const uc = new LoginWithEmailUseCase(d.userRepo, d.sessionRepo, d.hasher, d.tokens, d.attempts);
    await expect(
      uc.execute({ email: 'social@a-idol.dev', password: 'anything' }),
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_CREDENTIAL });
    expect(d.hasher.verify).not.toHaveBeenCalled();
  });

  it('TC-LOGIN-005 — refresh token is hashed (session stores hash, not token) + refreshExpiresAt consumed', async () => {
    const d = makeDeps();
    const uc = new LoginWithEmailUseCase(d.userRepo, d.sessionRepo, d.hasher, d.tokens, d.attempts);
    await uc.execute({ email: 'demo@a-idol.dev', password: 'x' });
    const call = (d.sessionRepo.create as jest.Mock).mock.calls[0][0];
    // Hash, not the raw refresh token
    expect(call.refreshTokenHash).toBe('h:refresh.jwt');
    expect(call.refreshTokenHash).not.toBe('refresh.jwt');
    // expiresAt was populated from tokens.refreshExpiresAt
    expect(call.expiresAt).toBeInstanceOf(Date);
    expect(call.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('TC-LOGIN-LOCK-001 — 잠긴 계정은 423 ACCOUNT_LOCKED + 비밀번호 검증 skip', async () => {
    const d = makeDeps();
    (d.attempts.status as jest.Mock).mockResolvedValueOnce({
      locked: true,
      retryAfterSec: 487,
    });
    const uc = new LoginWithEmailUseCase(d.userRepo, d.sessionRepo, d.hasher, d.tokens, d.attempts);
    await expect(
      uc.execute({ email: 'demo@a-idol.dev', password: 'whatever' }),
    ).rejects.toMatchObject({
      code: ErrorCodes.ACCOUNT_LOCKED,
      details: { retryAfterSec: 487 },
    });
    expect(d.userRepo.findByEmail).not.toHaveBeenCalled();
    expect(d.hasher.verify).not.toHaveBeenCalled();
  });

  it('TC-LOGIN-LOCK-002 — 비밀번호 틀리면 recordFailure 호출, 성공 시 clearFailures 호출', async () => {
    // 실패 path
    const d1 = makeDeps({ verifyResult: false });
    const uc1 = new LoginWithEmailUseCase(d1.userRepo, d1.sessionRepo, d1.hasher, d1.tokens, d1.attempts);
    await expect(
      uc1.execute({ email: 'demo@a-idol.dev', password: 'wrong' }),
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_CREDENTIAL });
    expect(d1.attempts.recordFailure).toHaveBeenCalledWith('demo@a-idol.dev');
    expect(d1.attempts.clearFailures).not.toHaveBeenCalled();

    // 성공 path
    const d2 = makeDeps();
    const uc2 = new LoginWithEmailUseCase(d2.userRepo, d2.sessionRepo, d2.hasher, d2.tokens, d2.attempts);
    await uc2.execute({ email: 'demo@a-idol.dev', password: 'password123' });
    expect(d2.attempts.clearFailures).toHaveBeenCalledWith('demo@a-idol.dev');
    expect(d2.attempts.recordFailure).not.toHaveBeenCalled();
  });

  it('TC-LOGIN-LOCK-003 — 존재 안 하는 이메일도 recordFailure (enumeration 방어)', async () => {
    const d = makeDeps({ user: null });
    const uc = new LoginWithEmailUseCase(d.userRepo, d.sessionRepo, d.hasher, d.tokens, d.attempts);
    await expect(
      uc.execute({ email: 'ghost@a-idol.dev', password: 'x' }),
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_CREDENTIAL });
    expect(d.attempts.recordFailure).toHaveBeenCalledWith('ghost@a-idol.dev');
  });
});
