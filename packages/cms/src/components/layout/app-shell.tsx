import { Suspense } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { LanguageSwitcher } from '@/components/language-switcher';
import { hasRole, useAuthStore } from '@/features/auth/auth-store';
import { useLogout } from '@/features/auth/use-logout';

// `adminOnly` 메뉴는 admin role에만 노출. operator/viewer는 라우트 가드
// (RequireRole)에서도 막히지만, sidebar에서 미리 숨겨야 UX 일관성.
type NavItem = {
  to: string;
  /** i18n key under the `nav` namespace. */
  labelKey: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
};

const NAV: readonly NavItem[] = [
  { to: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { to: '/idols', labelKey: 'idols', icon: Mic2 },
  { to: '/agencies', labelKey: 'agencies', icon: Building2 },
  { to: '/auditions', labelKey: 'auditions', icon: Trophy },
  { to: '/announcements', labelKey: 'announcements', icon: Bell },
  { to: '/photocards', labelKey: 'photocards', icon: Images },
  { to: '/commerce', labelKey: 'commerce', icon: ShoppingBag },
  { to: '/design-assets', labelKey: 'designAssets', icon: Palette },
  { to: '/project', labelKey: 'project', icon: FolderKanban },
  { to: '/preview', labelKey: 'preview', icon: Smartphone },
  { to: '/analytics', labelKey: 'analytics', icon: BarChart3, adminOnly: true },
  { to: '/operators', labelKey: 'operators', icon: ShieldCheck, adminOnly: true },
];

export function AppShell() {
  const session = useAuthStore((s) => s.session);
  const { logout, pending: logoutPending } = useLogout();
  const location = useLocation();
  const { t } = useTranslation(['common', 'nav']);

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-6 py-5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500" />
          <div>
            <div className="text-sm font-bold leading-none">{t('common:app.title')}</div>
            <div className="mt-1 text-[11px] text-slate-500">{t('common:app.subtitle')}</div>
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
              {t(`nav:${item.labelKey}`)}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <div className="mb-2 text-xs text-slate-500">
            <div className="font-semibold text-ink-700">{session.user.displayName}</div>
            <div className="truncate">{session.user.email}</div>
            <div className="mt-1 uppercase tracking-wide text-slate-400">{session.user.role}</div>
          </div>
          <LanguageSwitcher className="mb-3" />
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => void logout()}
            disabled={logoutPending}
          >
            {logoutPending ? t('common:actions.loggingOut') : t('common:actions.logout')}
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              {t('common:loading')}
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
