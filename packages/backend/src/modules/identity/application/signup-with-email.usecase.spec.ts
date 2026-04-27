/**
 * Example unit test — kept in skeleton so `pnpm test` has something to run.
 * Full TC-001..TC-004 acceptance tests live in the WBS TestCases sheet.
 */
import { SignupWithEmailUseCase } from './signup-with-email.usecase';
import { ErrorCodes, User, type AuthProvider, type AuthSession } from '@a-idol/shared';
import type {
  AuthSessionRepository,
  BreachPasswordChecker,
  PasswordHasher,
  TokenService,
  UserRepository,
} from './interfaces';

describe('SignupWithEmailUseCase', () => {
  const makeDeps = () => {
    const users = new Map<string, User>();
    const userRepo: UserRepository = {
      findByEmail: jest.fn(async (email: string) => users.get(email) ?? null),
      findByProvider: jest.fn(async () => null),
      findById: jest.fn(async () => null),
      create: jest.fn(
        async (input: {
          provider: AuthProvider;
          providerUserId: string;
          email: string | null;
          passwordHash: string | null;
          nickname: string;
          birthdate: Date;
        }) => {
          const u = User.create({
            id: 'uid-1',
            provider: input.provider,
            providerUserId: input.providerUserId,
            email: input.email,
            nickname: input.nickname,
            avatarUrl: null,
            birthdate: input.birthdate,
            status: 'active',
            marketingOptIn: false,
            pushOptIn: true,
            createdAt: new Date(),
          });
          if (input.email) users.set(input.email, u);
          return u;
        },
      ),
      update: jest.fn(),
    };
    const sessionRepo: AuthSessionRepository = {
      create: jest.fn(async () => ({}) as unknown as AuthSession),
      findByIdForUser: jest.fn(async () => null),
      revoke: jest.fn(async () => undefined),
      rotate: jest.fn(async () => ({}) as unknown as AuthSession),
    };
    const hasher: PasswordHasher = {
      hash: jest.fn(async () => 'hashed'),
      verify: jest.fn(async () => true),
    };
    const tokens: TokenService = {
      signAccess: jest.fn(async () => 'access.jwt'),
      signRefresh: jest.fn(async () => 'refresh.jwt'),
      verifyAccess: jest.fn(async () => ({ sub: 'uid-1' })),
      verifyRefresh: jest.fn(async () => ({ sub: 'uid-1', sid: 'sid-1' })),
      hashRefresh: jest.fn(async (t: string) => `h:${t}`),
      accessExpiresInSeconds: () => 900,
      refreshExpiresAt: () => new Date(Date.now() + 14 * 86400_000),
    };
    const breachCheck: BreachPasswordChecker = {
      isBreached: jest.fn(async () => false),
    };
    return { userRepo, sessionRepo, hasher, tokens, breachCheck };
  };

  it('TC-SIGN-PWD-BREACH — breach DB가 hit하면 BREACHED_PASSWORD 던짐', async () => {
    const d = makeDeps();
    (d.breachCheck.isBreached as jest.Mock).mockResolvedValueOnce(true);
    const uc = new SignupWithEmailUseCase(d.userRepo, d.sessionRepo, d.hasher, d.tokens, d.breachCheck);
    await expect(
      uc.execute({
        email: 'leaked@x.com',
        password: 'integration-pw-1234',
        nickname: 'leak',
        birthdate: new Date('2000-01-01'),
      }),
    ).rejects.toMatchObject({ code: ErrorCodes.BREACHED_PASSWORD });
    expect(d.userRepo.create).not.toHaveBeenCalled();
  });

  it('TC-001 — creates a new user and returns tokens', async () => {
    const d = makeDeps();
    const uc = new SignupWithEmailUseCase(d.userRepo, d.sessionRepo, d.hasher, d.tokens, d.breachCheck);
    const res = await uc.execute({
      email: 'demo@a-idol.dev',
      password: 'password123',
      nickname: 'demo',
      birthdate: new Date('2000-01-01'),
    });
    expect(res.user.email).toBe('demo@a-idol.dev');
    expect(res.accessToken).toBe('access.jwt');
    expect(d.sessionRepo.create).toHaveBeenCalled();
  });

  it('TC-002 — rejects duplicate email', async () => {
    const d = makeDeps();
    const uc = new SignupWithEmailUseCase(d.userRepo, d.sessionRepo, d.hasher, d.tokens, d.breachCheck);
    await uc.execute({
      email: 'dup@a-idol.dev',
      password: 'password123',
      nickname: 'a',
      birthdate: new Date('2000-01-01'),
    });
    await expect(
      uc.execute({
        email: 'dup@a-idol.dev',
        password: 'password123',
        nickname: 'b',
        birthdate: new Date('2000-01-01'),
      }),
    ).rejects.toMatchObject({ code: ErrorCodes.EMAIL_ALREADY_EXISTS });
  });

  it('TC-003 — rejects under-age signup', async () => {
    const d = makeDeps();
    const uc = new SignupWithEmailUseCase(d.userRepo, d.sessionRepo, d.hasher, d.tokens, d.breachCheck);
    const today = new Date();
    const thirteen = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
    await expect(
      uc.execute({
        email: 'k@a-idol.dev',
        password: 'password123',
        nickname: 'k',
        birthdate: thirteen,
      }),
    ).rejects.toMatchObject({ code: ErrorCodes.UNDER_AGE });
  });
});
