import { NavLink, Outlet } from 'react-router-dom';
import { FileText, Folder, KanbanSquare, ListTodo, ListChecks, Lock, ScrollText, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/features/auth/auth-store';

interface SubNavItem {
  to: string;
  label: string;
  icon: typeof Folder;
  end?: boolean;
  adminOnly?: boolean;
}

const SUB_NAV: SubNavItem[] = [
  { to: '/project', label: '개요', icon: Folder, end: true },
  { to: '/project/issues', label: '이슈', icon: KanbanSquare },
  { to: '/project/notes', label: '노트', icon: StickyNote },
  { to: '/project/docs', label: '문서 (ADR/설계)', icon: ScrollText, adminOnly: true },
  { to: '/project/deliverables', label: '산출물', icon: FileText, adminOnly: true },
  { to: '/project/wbs', label: 'WBS', icon: ListChecks, adminOnly: true },
  { to: '/project/tasks', label: '작업 태스크', icon: ListTodo, adminOnly: true },
];

export function ProjectLayout() {
  const role = useAuthStore((s) => s.session?.user.role);
  const items = SUB_NAV.filter((item) => !item.adminOnly || role === 'admin');
  const showAdminSeparator = role === 'admin' && items.some((i) => i.adminOnly);

  return (
    <div className="flex h-full">
      <aside className="w-56 border-r border-slate-200 bg-slate-50 px-3 py-4">
        <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          프로젝트 관리
        </div>
        <nav>
          {items.map((item, idx) => {
            const prev = items[idx - 1];
            const sectionStart =
              showAdminSeparator && item.adminOnly && (!prev || !prev.adminOnly);
            return (
              <div key={item.to}>
                {sectionStart ? (
                  <div className="mb-1 mt-3 flex items-center gap-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <Lock className="h-3 w-3" />
                    admin 영역
                  </div>
                ) : null}
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'mb-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-white font-semibold text-brand-700 shadow-sm'
                        : 'text-ink-700 hover:bg-white',
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
