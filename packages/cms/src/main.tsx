// T-080 — Sentry init은 다른 import 보다 먼저. DSN 비어있으면 skip (graceful).
import * as Sentry from '@sentry/react';
import { env } from '@/env';
if (env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    environment: env.VITE_APP_ENV,
    tracesSampleRate: 0.1,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    replaysSessionSampleRate: 0.0, // 일반 세션은 미녹화 (cost / privacy)
    replaysOnErrorSampleRate: 1.0, // 에러 발생 시 직전 30s 만 녹화
    // PII 자동 redact — admin token / email 등 노출 방지.
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
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from '@/lib/query-client';
import { router } from '@/app/router';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);

// Sentry ErrorBoundary — react tree 안의 unhandled error 자동 capture. DSN
// 미설정 시 NoopBoundary 로 대체 (그냥 children 통과).
function NoopBoundary({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
const Boundary = env.VITE_SENTRY_DSN ? Sentry.ErrorBoundary : NoopBoundary;

root.render(
  <React.StrictMode>
    <Boundary fallback={<div style={{ padding: 24 }}>오류가 발생했습니다.</div>}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </Boundary>
  </React.StrictMode>,
);
