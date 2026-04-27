import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { LoginPage } from '@/features/auth/login-page';
import { RequireRole } from '@/features/auth/require-role';
import { AgenciesPage } from '@/features/agencies/agencies-page';
import { IdolsPage } from '@/features/idols/idols-page';
import { AutoMessagesPage } from '@/features/auto-messages/auto-messages-page';
import { AuditionsPage } from '@/features/auditions/auditions-page';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { PhotocardsPage } from '@/features/photocards/photocards-page';
import { CommercePage } from '@/features/commerce/commerce-page';
import { OperatorsPage } from '@/features/operators/operators-page';
import { PreviewPage } from '@/features/preview/preview-page';
import { DesignAssetsPage } from '@/features/design-assets/design-assets-page';
import { ProjectLayout } from '@/features/project/project-layout';
import { ProjectOverviewPage } from '@/features/project/project-overview-page';
import { DocsListPage } from '@/features/project/docs-list-page';
import { DocDetailPage } from '@/features/project/doc-detail-page';
import { DocEditPage } from '@/features/project/doc-edit-page';
import { DeliverablesPage } from '@/features/project/deliverables-page';
import { WbsPage } from '@/features/project/wbs-page';
import { TasksPage } from '@/features/project/tasks-page';

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
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
