import { NavLink, Outlet } from 'react-router-dom';
import { FileText, Folder, ListTodo, ListChecks, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';

const SUB_NAV = [
  { to: '/project', label: '개요', icon: Folder, end: true },
  { to: '/project/docs', label: '문서 (ADR/설계)', icon: ScrollText },
  { to: '/project/deliverables', label: '산출물', icon: FileText },
  { to: '/project/wbs', label: 'WBS', icon: ListChecks },
  { to: '/project/tasks', label: '작업 태스크', icon: ListTodo },
];

export function ProjectLayout() {
  return (
    <div className="flex h-full">
      <aside className="w-56 border-r border-slate-200 bg-slate-50 px-3 py-4">
        <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          프로젝트 관리
        </div>
        <nav>
          {SUB_NAV.map((item) => (
            <NavLink
              key={item.to}
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
          ))}
        </nav>
      </aside>
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
