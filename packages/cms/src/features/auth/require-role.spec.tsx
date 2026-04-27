import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import type { AdminAuthResponseDto } from '@a-idol/shared';
import { RequireRole } from './require-role';
import { useAuthStore } from './auth-store';

const NOW_ISO = '2026-04-28T00:00:00.000Z';

const makeSession = (role: 'admin' | 'operator' | 'viewer'): AdminAuthResponseDto => ({
  accessToken: 'tok',
  refreshToken: 'rtok',
  expiresIn: 900,
  user: {
    id: 'admin-1',
    email: 'admin@a-idol.dev',
    displayName: 'X',
    role,
    status: 'active',
    lastLoginAt: NOW_ISO,
    createdAt: NOW_ISO,
  },
});

/** T-082 RBAC — RequireRole 가드. React 18 + RTL 는 async commit → findBy* 사용. */
describe('<RequireRole>', () => {
  beforeEach(() => {
    useAuthStore.setState({ session: null });
  });

  it('TC-RR-001 — null session: 자식 렌더 안 됨, "접근 권한이 없습니다" 카드 노출', () => {
    render(
      <RequireRole allow={['admin']}>
        <div>secret-area</div>
      </RequireRole>,
    );
    expect(screen.getByText(/접근 권한이 없습니다/)).toBeInTheDocument();
    expect(screen.queryByText('secret-area')).not.toBeInTheDocument();
  });

  it('TC-RR-002 — 허용된 role: 자식 그대로 렌더', () => {
    useAuthStore.setState({ session: makeSession('admin') });
    render(
      <RequireRole allow={['admin']}>
        <div>secret-area</div>
      </RequireRole>,
    );
    expect(screen.getByText('secret-area')).toBeInTheDocument();
    expect(screen.queryByText(/접근 권한이 없습니다/)).not.toBeInTheDocument();
  });

  it('TC-RR-003 — operator 가 admin 전용 페이지 접근 → 거부', () => {
    useAuthStore.setState({ session: makeSession('operator') });
    render(
      <RequireRole allow={['admin']}>
        <div>analytics-only</div>
      </RequireRole>,
    );
    expect(screen.getByText(/현재 권한: operator/)).toBeInTheDocument();
    expect(screen.queryByText('analytics-only')).not.toBeInTheDocument();
  });

  it('TC-RR-004 — multiple allow: admin OR operator 모두 통과', () => {
    useAuthStore.setState({ session: makeSession('operator') });
    render(
      <RequireRole allow={['admin', 'operator']}>
        <div>shared-area</div>
      </RequireRole>,
    );
    expect(screen.getByText('shared-area')).toBeInTheDocument();
  });

  it('TC-RR-005 — viewer 가 admin/operator 전용 페이지 → 거부 + 권한 안내 문구', () => {
    useAuthStore.setState({ session: makeSession('viewer') });
    render(
      <RequireRole allow={['admin', 'operator']}>
        <div>nope</div>
      </RequireRole>,
    );
    expect(screen.getByText(/admin · operator 권한이 필요합니다/)).toBeInTheDocument();
    expect(screen.queryByText('nope')).not.toBeInTheDocument();
  });
});
