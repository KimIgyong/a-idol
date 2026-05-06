import type { AdminRole } from '@a-idol/shared';
import type { AdminUser } from '../domain/admin-user';

export interface AdminUserRepository {
  findByEmail(email: string): Promise<AdminUser | null>;
  findById(id: string): Promise<AdminUser | null>;
  touchLastLogin(id: string, at: Date): Promise<void>;
  /**
   * Admin/operator/viewer 전체 목록 — 운영자 관리 페이지용 (RPT-260426-B
   * §5). 정렬: createdAt DESC (최신 가입 순). 비밀번호 해시는 도메인이
   * 캡슐화하므로 controller 측에서 노출되지 않음.
   */
  listAll(): Promise<AdminUser[]>;
  /** FR-102 — 신규 어드민 등록. */
  create(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    role: AdminRole;
  }): Promise<AdminUser>;
  /** FR-102 — 역할 변경. 대상 미존재 시 null 반환 (use case 가 ADMIN_NOT_FOUND 으로 매핑). */
  updateRole(id: string, role: AdminRole): Promise<AdminUser | null>;
  /** FR-102 — admin 한도 / 마지막 admin 강등 검증용. */
  countByRole(role: AdminRole): Promise<number>;
}

/** T-082 (Phase D) — admin refresh token 의 server-side state. */
export interface AdminAuthSessionRecord {
  id: string;
  adminUserId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface AdminAuthSessionRepository {
  create(input: {
    /** 호출자가 minted한 sid — JWT의 sid claim과 동일. */
    id: string;
    adminUserId: string;
    refreshTokenHash: string;
    expiresAt: Date;
  }): Promise<AdminAuthSessionRecord>;
  findByIdForAdmin(sessionId: string, adminUserId: string): Promise<AdminAuthSessionRecord | null>;
  revoke(sessionId: string): Promise<void>;
  rotate(sessionId: string, newHash: string, newExpiresAt: Date): Promise<AdminAuthSessionRecord>;
}

export interface AdminTokenService {
  signAccess(input: { sub: string; role: AdminRole }): Promise<string>;
  signRefresh(input: { sub: string; role: AdminRole; sid: string }): Promise<string>;
  verifyAccess(token: string): Promise<{ sub: string; role: AdminRole }>;
  verifyRefresh(token: string): Promise<{ sub: string; role: AdminRole; sid: string }>;
  hashRefresh(token: string): Promise<string>;
  accessExpiresInSeconds(): number;
  refreshExpiresAt(from?: Date): Date;
}

export const ADMIN_USER_REPOSITORY = 'AdminUserRepository';
export const ADMIN_AUTH_SESSION_REPOSITORY = 'AdminAuthSessionRepository';
export const ADMIN_TOKEN_SERVICE = 'AdminTokenService';
