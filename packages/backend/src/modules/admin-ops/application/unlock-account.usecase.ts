import { Inject, Injectable, Logger } from '@nestjs/common';
import type { LoginAttemptThrottle } from '../../identity/application/interfaces';
import { LOGIN_ATTEMPT_THROTTLE } from '../../identity/application/interfaces';

/**
 * RPT-260426-D Phase D T-082 / CS workflow §6.2 — admin이 잠긴 계정을 즉시
 * 해제. 정상 운영자가 비번 잘못 쳐서 잠긴 경우 15분 대기 우회용.
 *
 * 모든 호출은 audit log (pino info)로 기록 — 누가/언제/누구를 unlock 했는지.
 */
@Injectable()
export class UnlockAccountUseCase {
  private readonly log = new Logger(UnlockAccountUseCase.name);

  constructor(
    @Inject(LOGIN_ATTEMPT_THROTTLE)
    private readonly attempts: LoginAttemptThrottle,
  ) {}

  async execute(input: {
    targetEmail: string;
    actorAdminId: string;
  }): Promise<void> {
    await this.attempts.clearFailures(input.targetEmail);
    // Audit log — admin action 추적용. Sentry breadcrumb 도 기록.
    this.log.log(
      `account-unlock: actor=${input.actorAdminId} target=${input.targetEmail.toLowerCase()}`,
    );
  }
}
