// T-080 — Sentry SDK 는 DSN 이 있을 때만 동적 로드. DSN 비어있으면 chunk
// 자체가 다운로드되지 않아 첫 페이지 비용 ~92KB(gzip) 절감.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { env } from '@/env';
import { queryClient } from '@/lib/query-client';
import { router } from '@/app/router';
import './index.css';

interface BoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
}

function NoopBoundary({ children }: BoundaryProps) {
  return <>{children}</>;
}

async function loadSentryBoundary(): Promise<React.ComponentType<BoundaryProps>> {
  if (!env.VITE_SENTRY_DSN) return NoopBoundary;
  const Sentry = await import('@sentry/react');
  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    environment: env.VITE_APP_ENV,
    tracesSampleRate: 0.1,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete (event.request.headers as Record<string, string>)['authorization'];
          delete (event.request.headers as Record<string, string>)['Authorization'];
        }
      }
      return event;
    },
  });
  return Sentry.ErrorBoundary as unknown as React.ComponentType<BoundaryProps>;
}

async function bootstrap() {
  const Boundary = await loadSentryBoundary();
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  root.render(
    <React.StrictMode>
      <Boundary fallback={<div style={{ padding: 24 }}>오류가 발생했습니다.</div>}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </Boundary>
    </React.StrictMode>,
  );
}

void bootstrap();
