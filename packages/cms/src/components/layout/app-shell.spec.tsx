import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { AdminAuthResponseDto } from '@a-idol/shared';
import { AppShell } from './app-shell';
import { useAuthStore } from '@/features/auth/auth-store';

const NOW_ISO = '2026-04-28T00:00:00.000Z';

const makeSession = (role: 'admin' | 'operator' | 'viewer'): AdminAuthResponseDto => ({
  accessToken: 'tok',
  refreshToken: 'rtok',
  expiresIn: 900,
  user: {
    id: 'u-1',
    email: `${role}@a-idol.dev`,
    displayName: `${role} user`,
    role,
    status: 'active',
    lastLoginAt: NOW_ISO,
    createdAt: NOW_ISO,
  },
});

/** AppShell sidebar NAV filter — adminOnly 메뉴는 admin role 만 노출. */
describe('<AppShell>', () => {
  beforeEach(() => {
    useAuthStore.setState({ session: null });
  });

  const renderShell = () =>
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>login-page</div>} />
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

  it('TC-SHELL-001 — 비로그인 시 /login 으로 redirect', () => {
    renderShell();
    expect(screen.getByText('login-page')).toBeInTheDocument();
  });

  it('TC-SHELL-002 — admin: 전체 NAV (adminOnly 포함)', () => {
    useAuthStore.setState({ session: makeSession('admin') });
    renderShell();
    expect(screen.getByText('대시보드')).toBeInTheDocument();
    expect(screen.getByText('아이돌 관리')).toBeInTheDocument();
    // adminOnly 메뉴
    expect(screen.getByText('분석')).toBeInTheDocument();
    expect(screen.getByText('운영자 관리')).toBeInTheDocument();
    // 공통 메뉴
    expect(screen.getByText('디자인 자산')).toBeInTheDocument();
    expect(screen.getByText('프로젝트 관리')).toBeInTheDocument();
  });

  it('TC-SHELL-003 — operator: adminOnly 메뉴 (분석/운영자 관리) 숨김', () => {
    useAuthStore.setState({ session: makeSession('operator') });
    renderShell();
    expect(screen.getByText('대시보드')).toBeInTheDocument();
    expect(screen.getByText('아이돌 관리')).toBeInTheDocument();
    expect(screen.getByText('디자인 자산')).toBeInTheDocument();
    // adminOnly 메뉴 숨김
    expect(screen.queryByText('분석')).not.toBeInTheDocument();
    expect(screen.queryByText('운영자 관리')).not.toBeInTheDocument();
  });

  it('TC-SHELL-004 — 사이드바에 user displayName + role 노출', () => {
    useAuthStore.setState({ session: makeSession('operator') });
    renderShell();
    expect(screen.getByText('operator user')).toBeInTheDocument();
    expect(screen.getByText('operator@a-idol.dev')).toBeInTheDocument();
    expect(screen.getByText('operator')).toBeInTheDocument(); // role badge
  });
});
