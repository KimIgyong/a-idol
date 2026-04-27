import { UnlockAccountUseCase } from './unlock-account.usecase';
import type { LoginAttemptThrottle } from '../../identity/application/interfaces';

/** T-082 / CS workflow §6.2 — admin이 잠긴 계정 즉시 해제. */
describe('UnlockAccountUseCase', () => {
  const makeThrottle = (): { throttle: LoginAttemptThrottle; cleared: string[] } => {
    const cleared: string[] = [];
    const throttle: LoginAttemptThrottle = {
      recordFailure: jest.fn(),
      clearFailures: jest.fn(async (email) => {
        cleared.push(email);
      }),
      status: jest.fn(),
    };
    return { throttle, cleared };
  };

  it('TC-UA-001 — clearFailures 호출 (정확한 email)', async () => {
    const { throttle, cleared } = makeThrottle();
    const uc = new UnlockAccountUseCase(throttle);
    await uc.execute({ targetEmail: 'user@example.com', actorAdminId: 'admin-1' });
    expect(cleared).toEqual(['user@example.com']);
  });

  it('TC-UA-002 — return value 는 void (Promise resolved)', async () => {
    const { throttle } = makeThrottle();
    const uc = new UnlockAccountUseCase(throttle);
    const ret = await uc.execute({ targetEmail: 'x@y.com', actorAdminId: 'admin-1' });
    expect(ret).toBeUndefined();
  });

  it('TC-UA-003 — 같은 email 여러번 호출해도 idempotent (단순 forwarding)', async () => {
    const { throttle, cleared } = makeThrottle();
    const uc = new UnlockAccountUseCase(throttle);
    await uc.execute({ targetEmail: 'a@b.com', actorAdminId: 'admin-1' });
    await uc.execute({ targetEmail: 'a@b.com', actorAdminId: 'admin-1' });
    expect(cleared).toEqual(['a@b.com', 'a@b.com']);
    expect(throttle.clearFailures).toHaveBeenCalledTimes(2);
  });
});
