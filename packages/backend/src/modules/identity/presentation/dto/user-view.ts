import type { User, UserDto, AuthResponseDto, AuthTokensDto } from '@a-idol/shared';

export function toUserDto(user: User): UserDto {
  const raw = user.toJSON() as {
    id: string;
    provider: 'email' | 'apple' | 'google' | 'kakao';
    email: string | null;
    nickname: string;
    avatarUrl: string | null;
    status: 'active' | 'suspended' | 'withdrawn';
    marketingOptIn: boolean;
    pushOptIn: boolean;
    createdAt: Date;
  };
  return {
    id: raw.id,
    provider: raw.provider,
    email: raw.email,
    nickname: raw.nickname,
    avatarUrl: raw.avatarUrl,
    status: raw.status,
    marketingOptIn: raw.marketingOptIn,
    pushOptIn: raw.pushOptIn,
    createdAt: raw.createdAt.toISOString(),
  };
}

export function toAuthResponse(
  user: User,
  tokens: { accessToken: string; refreshToken: string; expiresIn: number },
): AuthResponseDto {
  return {
    user: toUserDto(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
  };
}

export type { AuthResponseDto, AuthTokensDto };
