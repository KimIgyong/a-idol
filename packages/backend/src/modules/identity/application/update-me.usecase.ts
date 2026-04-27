import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes, type User } from '@a-idol/shared';
import type { UserRepository } from './interfaces';
import { USER_REPOSITORY } from './interfaces';

/**
 * 자기 자신의 프로필/동의 필드만 업데이트. SCR-004(가입 직후 추가 정보 수집)
 * 와 설정 화면(SCR-025 후속) 두 surface에서 호출.
 *
 * 변경 가능 필드:
 *  - `avatarUrl` — 프로필 사진 URL (null로 보내면 제거)
 *  - `marketingOptIn` — PIPA/PDPA 마케팅 수신 동의
 *  - `pushOptIn` — 푸시 알림 수신 동의
 *
 * 이 외 (nickname, birthdate, email, status)는 불변. status 변경은 admin
 * tool 또는 withdraw flow가 책임.
 */
@Injectable()
export class UpdateMeUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async execute(
    userId: string,
    patch: { avatarUrl?: string | null; marketingOptIn?: boolean; pushOptIn?: boolean },
  ): Promise<User> {
    const existing = await this.users.findById(userId);
    if (!existing) {
      throw new DomainError(ErrorCodes.SESSION_NOT_FOUND, 'User not found');
    }
    return this.users.update(userId, patch);
  }
}
