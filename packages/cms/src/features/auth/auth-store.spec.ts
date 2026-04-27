import { describe, it, expect, beforeEach } from 'vitest';
import type { AdminAuthResponseDto } from '@a-idol/shared';
import { hasRole, useAuthStore } from './auth-store';

const NOW_ISO = '2026-04-27T00:00:00.000Z';

const makeSession = (
  overrides: Partial<AdminAuthResponseDto['user']> = {},
): AdminAuthResponseDto => ({
  accessToken: 'access-tok',
  refreshToken: 'refresh-tok',
  expiresIn: 900,
  user: {
    id: 'admin-1',
    email: 'admin@a-idol.dev',
    displayName: 'Root',
    role: 'admin',
    status: 'active',
    lastLoginAt: NOW_ISO,
    createdAt: NOW_ISO,
    ...overrides,
  },
});

describe('useAuthStore', () => {
  beforeEach(() => {
    // 매 테스트 전 store + persisted localStorage 초기화 — 테스트 간 격리.
    useAuthStore.setState({ session: null });
    window.localStorage.clear();
  });

  it('TC-AS-001 — 초기 session 은 null', () => {
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('TC-AS-002 — setSession 후 session 갱신', () => {
    const s = makeSession();
    useAuthStore.getState().setSession(s);
    expect(useAuthStore.getState().session).toBe(s);
    expect(useAuthStore.getState().session?.user.role).toBe('admin');
  });

  it('TC-AS-003 — clear 후 session null', () => {
    useAuthStore.getState().setSession(makeSession());
    useAuthStore.getState().clear();
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('TC-AS-004 — setSession 시 localStorage 에 persist (zustand persist middleware)', () => {
    useAuthStore.getState().setSession(makeSession());
    const raw = window.localStorage.getItem('a-idol.cms.auth');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.session.accessToken).toBe('access-tok');
  });
});

describe('hasRole', () => {
  it('TC-HR-001 — null session → false', () => {
    expect(hasRole(null, 'admin')).toBe(false);
  });

  it('TC-HR-002 — role 일치 → true', () => {
    expect(hasRole(makeSession({ role: 'admin' }), 'admin')).toBe(true);
  });

  it('TC-HR-003 — multiple allowed 중 하나 일치 → true', () => {
    expect(hasRole(makeSession({ role: 'operator' }), 'admin', 'operator')).toBe(true);
  });

  it('TC-HR-004 — 미허용 role → false', () => {
    expect(hasRole(makeSession({ role: 'viewer' }), 'admin', 'operator')).toBe(false);
  });
});
