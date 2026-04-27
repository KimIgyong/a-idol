// Cross-package DTO contracts. These are the wire shapes returned by the backend
// and consumed by the mobile app / CMS / tests.

export interface UserDto {
  id: string;
  email: string | null;
  nickname: string;
  avatarUrl: string | null;
  provider: 'email' | 'apple' | 'google' | 'kakao';
  status: 'active' | 'suspended' | 'withdrawn';
  createdAt: string; // ISO timestamp
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponseDto extends AuthTokensDto {
  user: UserDto;
}

export interface IdolCardDto {
  id: string;
  name: string;
  stageName: string | null;
  heroImageUrl: string | null;
  heartCount: number;
  followCount: number;
  publishedAt: string | null;
}

export interface PaginatedResponseDto<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

export interface HealthResponseDto {
  status: 'ok';
  version: string;
  uptimeSeconds: number;
  timestamp: string;
}
