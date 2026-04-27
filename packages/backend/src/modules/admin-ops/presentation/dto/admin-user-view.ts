import type { AdminAuthResponseDto, AdminUserDto, AuthTokensDto } from '@a-idol/shared';
import type { AdminUser } from '../../domain/admin-user';

export function toAdminUserDto(admin: AdminUser): AdminUserDto {
  return {
    id: admin.id,
    email: admin.email,
    displayName: admin.displayName,
    role: admin.role,
    status: admin.status,
    lastLoginAt: admin.lastLoginAt?.toISOString() ?? null,
    createdAt: admin.createdAt.toISOString(),
  };
}

export function toAdminAuthResponse(
  admin: AdminUser,
  tokens: { accessToken: string; refreshToken: string; expiresIn: number },
): AdminAuthResponseDto {
  return {
    user: toAdminUserDto(admin),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
  };
}

export type { AdminAuthResponseDto, AuthTokensDto };
