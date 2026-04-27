import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Building2,
  FolderKanban,
  Images,
  LayoutDashboard,
  Mic2,
  Palette,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { hasRole, useAuthStore } from '@/features/auth/auth-store';
import { useLogout } from '@/features/auth/use-logout';

// `adminOnly` 메뉴는 admin role에만 노출. operator/viewer는 라우트 가드
// (RequireRole)에서도 막히지만, sidebar에서 미리 숨겨야 UX 일관성.
type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
};

const NAV: readonly NavItem[] = [
  { to: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { to: '/idols', label: '아이돌 관리', icon: Mic2 },
  { to: '/agencies', label: '소속사', icon: Building2 },
  { to: '/auditions', label: '오디션', icon: Trophy },
  { to: '/announcements', label: '자동 메시지', icon: Bell },
  { to: '/photocards', label: '포토카드', icon: Images },
  { to: '/commerce', label: '상품/결제', icon: ShoppingBag },
  { to: '/design-assets', label: '디자인 자산', icon: Palette },
  { to: '/project', label: '프로젝트 관리', icon: FolderKanban },
  { to: '/preview', label: '앱 미리보기', icon: Smartphone },
  { to: '/analytics', label: '분석', icon: BarChart3, adminOnly: true },
  { to: '/operators', label: '운영자 관리', icon: ShieldCheck, adminOnly: true },
];

export function AppShell() {
  const session = useAuthStore((s) => s.session);
  const { logout, pending: logoutPending } = useLogout();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-6 py-5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500" />
          <div>
            <div className="text-sm font-bold leading-none">A-idol CMS</div>
            <div className="mt-1 text-[11px] text-slate-500">관리자 콘솔</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-2">
          {NAV.filter((item) => !item.adminOnly || hasRole(session, 'admin')).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-brand-50 font-semibold text-brand-700'
                    : 'text-ink-700 hover:bg-slate-50',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <div className="mb-2 text-xs text-slate-500">
            <div className="font-semibold text-ink-700">{session.user.displayName}</div>
            <div className="truncate">{session.user.email}</div>
            <div className="mt-1 uppercase tracking-wide text-slate-400">{session.user.role}</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => void logout()}
            disabled={logoutPending}
          >
            {logoutPending ? '로그아웃 중...' : '로그아웃'}
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
