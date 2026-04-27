/**
 * Example unit test — kept in skeleton so `pnpm test` has something to run.
 * Full TC-001..TC-004 acceptance tests live in the WBS TestCases sheet.
 */
import { SignupWithEmailUseCase } from './signup-with-email.usecase';
import { DomainError, ErrorCodes, User } from '@a-idol/shared';

describe('SignupWithEmailUseCase', () => {
  const makeDeps = () => {
    const users = new Map<string, any>();
    const userRepo = {
      findByEmail: jest.fn(async (email: string) => users.get(email) ?? null),
      findByProvider: jest.fn(async () => null),
      findById: jest.fn(async () => null),
      create: jest.fn(async (input: any) => {
        const u = User.create({
          id: 'uid-1',
          provider: input.provider,
          providerUserId: input.providerUserId,
          email: input.email,
          nickname: input.nickname,
          avatarUrl: null,
          birthdate: input.birthdate,
          status: 'active',
          createdAt: new Date(),
        });
        users.set(input.email, u);
        return u;
      }),
    };
    const sessionRepo = {
      create: jest.fn(async () => ({} as any)),
      findByIdForUser: jest.fn(),
      revoke: jest.fn(),
      rotate: jest.fn(),
    };
    const hasher = { hash: jest.fn(async () => 'hashed'), verify: jest.fn() };
    const tokens = {
      signAccess: jest.fn(async () => 'access.jwt'),
      signRefresh: jest.fn(async () => 'refresh.jwt'),
      verifyAccess: jest.fn(),
      verifyRefresh: jest.fn(),
      hashRefresh: jest.fn(async (t: string) => `h:${t}`),
      accessExpiresInSeconds: () => 900,
      refreshExpiresAt: () => new Date(Date.now() + 14 * 86400_000),
    };
    return { userRepo, sessionRepo, hasher, tokens };
  };

  it('TC-001 — creates a new user and returns tokens', async () => {
    const d = makeDeps();
    const uc = new SignupWithEmailUseCase(d.userRepo, d.sessionRepo, d.hasher as any, d.tokens as any);
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
    const uc = new SignupWithEmailUseCase(d.userRepo, d.sessionRepo, d.hasher as any, d.tokens as any);
    await uc.execute({ email: 'dup@a-idol.dev', password: 'password123', nickname: 'a', birthdate: new Date('2000-01-01') });
    await expect(
      uc.execute({ email: 'dup@a-idol.dev', password: 'password123', nickname: 'b', birthdate: new Date('2000-01-01') }),
    ).rejects.toMatchObject({ code: ErrorCodes.EMAIL_ALREADY_EXISTS });
  });

  it('TC-003 — rejects under-age signup', async () => {
    const d = makeDeps();
    const uc = new SignupWithEmailUseCase(d.userRepo, d.sessionRepo, d.hasher as any, d.tokens as any);
    const today = new Date();
    const thirteen = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
    await expect(
      uc.execute({ email: 'k@a-idol.dev', password: 'password123', nickname: 'k', birthdate: thirteen }),
    ).rejects.toMatchObject({ code: ErrorCodes.UNDER_AGE });
  });
});
