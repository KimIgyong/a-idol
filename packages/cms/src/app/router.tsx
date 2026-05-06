import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { LoginPage } from '@/features/auth/login-page';
import { RequireRole } from '@/features/auth/require-role';

// 라우트별 동적 import — bundler 가 chunk 분리 (vite production build).
// 진입에 필요한 LoginPage / AppShell / RequireRole 만 즉시 로드.
const lazyNamed = <T extends string>(path: () => Promise<Record<T, React.ComponentType>>, key: T) =>
  lazy(async () => {
    const mod = await path();
    return { default: mod[key] };
  });

const DashboardPage = lazyNamed(() => import('@/features/dashboard/dashboard-page'), 'DashboardPage');
const AgenciesPage = lazyNamed(() => import('@/features/agencies/agencies-page'), 'AgenciesPage');
const IdolsPage = lazyNamed(() => import('@/features/idols/idols-page'), 'IdolsPage');
const AutoMessagesPage = lazyNamed(() => import('@/features/auto-messages/auto-messages-page'), 'AutoMessagesPage');
const AuditionsPage = lazyNamed(() => import('@/features/auditions/auditions-page'), 'AuditionsPage');
const PhotocardsPage = lazyNamed(() => import('@/features/photocards/photocards-page'), 'PhotocardsPage');
const CommercePage = lazyNamed(() => import('@/features/commerce/commerce-page'), 'CommercePage');
const OperatorsPage = lazyNamed(() => import('@/features/operators/operators-page'), 'OperatorsPage');
const PreviewPage = lazyNamed(() => import('@/features/preview/preview-page'), 'PreviewPage');
const DesignAssetsPage = lazyNamed(() => import('@/features/design-assets/design-assets-page'), 'DesignAssetsPage');

const ProjectLayout = lazyNamed(() => import('@/features/project/project-layout'), 'ProjectLayout');
const ProjectOverviewPage = lazyNamed(() => import('@/features/project/project-overview-page'), 'ProjectOverviewPage');
const DocsListPage = lazyNamed(() => import('@/features/project/docs-list-page'), 'DocsListPage');
const DocDetailPage = lazyNamed(() => import('@/features/project/doc-detail-page'), 'DocDetailPage');
const DocEditPage = lazyNamed(() => import('@/features/project/doc-edit-page'), 'DocEditPage');
const DeliverablesPage = lazyNamed(() => import('@/features/project/deliverables-page'), 'DeliverablesPage');
const WbsPage = lazyNamed(() => import('@/features/project/wbs-page'), 'WbsPage');
const TasksPage = lazyNamed(() => import('@/features/project/tasks-page'), 'TasksPage');
const IssuesPage = lazyNamed(() => import('@/features/project/issues-page'), 'IssuesPage');

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: '/dashboard',
        element: <DashboardPage />,
      },
      {
        path: '/idols',
        element: (
          <RequireRole allow={['admin', 'operator']}>
            <IdolsPage />
          </RequireRole>
        ),
      },
      {
        path: '/agencies',
        element: (
          <RequireRole allow={['admin', 'operator']}>
            <AgenciesPage />
          </RequireRole>
        ),
      },
      {
        path: '/auditions',
        element: (
          <RequireRole allow={['admin', 'operator']}>
            <AuditionsPage />
          </RequireRole>
        ),
      },
      {
        path: '/announcements',
        element: (
          <RequireRole allow={['admin', 'operator']}>
            <AutoMessagesPage />
          </RequireRole>
        ),
      },
      {
        path: '/photocards',
        element: (
          <RequireRole allow={['admin', 'operator']}>
            <PhotocardsPage />
          </RequireRole>
        ),
      },
      {
        path: '/commerce',
        element: (
          <RequireRole allow={['admin', 'operator']}>
            <CommercePage />
          </RequireRole>
        ),
      },
      {
        path: '/analytics',
        element: (
          <RequireRole allow={['admin']}>
            <DashboardPage />
          </RequireRole>
        ),
      },
      {
        path: '/operators',
        element: (
          <RequireRole allow={['admin']}>
            <OperatorsPage />
          </RequireRole>
        ),
      },
      {
        path: '/preview',
        element: (
          <RequireRole allow={['admin', 'operator']}>
            <PreviewPage />
          </RequireRole>
        ),
      },
      {
        path: '/design-assets',
        element: (
          <RequireRole allow={['admin', 'operator']}>
            <DesignAssetsPage />
          </RequireRole>
        ),
      },
      {
        path: '/project',
        element: (
          <RequireRole allow={['admin', 'operator']}>
            <ProjectLayout />
          </RequireRole>
        ),
        children: [
          { index: true, element: <ProjectOverviewPage /> },
          { path: 'docs', element: <DocsListPage /> },
          { path: 'docs/:slug', element: <DocDetailPage /> },
          {
            path: 'docs/:slug/edit',
            element: (
              <RequireRole allow={['admin']}>
                <DocEditPage />
              </RequireRole>
            ),
          },
          { path: 'deliverables', element: <DeliverablesPage /> },
          { path: 'wbs', element: <WbsPage /> },
          { path: 'tasks', element: <TasksPage /> },
          { path: 'issues', element: <IssuesPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
