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
}

export interface AuthSessionRepository {
  create(input: {
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
export const TOKEN_SERVICE = 'TokenService';
