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
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
