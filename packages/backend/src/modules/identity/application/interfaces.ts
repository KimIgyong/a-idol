import type { User, AuthSession, AuthProvider } from '@a-idol/shared';

/**
 * Ports (application-side interfaces) for the Identity context.
 * Infrastructure adapters implement these.
 */

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findByProvider(provider: AuthProvider, providerUserId: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(input: {
    provider: AuthProvider;
    providerUserId: string;
    email: string | null;
    passwordHash: string | null;
    nickname: string;
    birthdate: Date;
  }): Promise<User>;
  /**
   * 사용자 자기 자신의 프로필/동의 필드 업데이트. SCR-004 (가입 직후
   * 추가 정보) + 설정 화면에서 사용. 닉네임/생년월일은 변경 불가
   * (별도 admin 도구 필요).
   */
  update(
    id: string,
    patch: { avatarUrl?: string | null; marketingOptIn?: boolean; pushOptIn?: boolean },
  ): Promise<User>;
}

export interface AuthSessionRepository {
  create(input: {
    /** 호출자가 minted한 sid (refresh token의 sid claim과 동일). DB autogen
     *  대신 명시 — 안 그러면 refresh 시 sid mismatch로 401. */
    id: string;
    userId: string;
    refreshTokenHash: string;
    deviceId: string | null;
    expiresAt: Date;
  }): Promise<AuthSession>;
  findByIdForUser(sessionId: string, userId: string): Promise<AuthSession | null>;
  revoke(sessionId: string): Promise<void>;
  rotate(sessionId: string, newHash: string, newExpiresAt: Date): Promise<AuthSession>;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}

/**
 * T-082 후속 — NIST §5.1.1.2. 외부 breach DB(HIBP 등) 조회 어댑터.
 * 비활성/네트워크 실패 시 false (graceful) — DoS 방지.
 */
export interface BreachPasswordChecker {
  isBreached(password: string): Promise<boolean>;
}

/**
 * T-082 후속 — NIST §5.2.2 account lockout. credential stuffing 방어.
 * IP-기반 throttle 과 별도 — 공격자가 IP rotate 해도 같은 계정에 대한
 * 반복 실패는 차단. Redis counter + TTL.
 */
export interface LoginAttemptThrottle {
  /** 실패 1회 기록. 잠금 임계치 도달 시 isLocked가 true 반환. */
  recordFailure(email: string): Promise<void>;
  /** 로그인 성공 시 counter 리셋. */
  clearFailures(email: string): Promise<void>;
  /** 잠금 여부 + 남은 잠금 시간(초). */
  status(email: string): Promise<{ locked: boolean; retryAfterSec: number }>;
}

export interface TokenService {
  signAccess(input: { sub: string }): Promise<string>;
  signRefresh(input: { sub: string; sid: string }): Promise<string>;
  verifyAccess(token: string): Promise<{ sub: string }>;
  verifyRefresh(token: string): Promise<{ sub: string; sid: string }>;
  hashRefresh(token: string): Promise<string>;
  accessExpiresInSeconds(): number;
  refreshExpiresAt(from?: Date): Date;
}

// DI tokens
export const USER_REPOSITORY = 'UserRepository';
export const AUTH_SESSION_REPOSITORY = 'AuthSessionRepository';
export const PASSWORD_HASHER = 'PasswordHasher';
export const BREACH_PASSWORD_CHECKER = 'BreachPasswordChecker';
export const LOGIN_ATTEMPT_THROTTLE = 'LoginAttemptThrottle';
export const TOKEN_SERVICE = 'TokenService';
