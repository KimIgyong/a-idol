/**
 * T-080 — Mobile Sentry init. expo-router entry보다 먼저 실행되어야 native
 * crash 도 capture. DSN 비어있으면 init skip (graceful no-op).
 *
 * EXPO_PUBLIC_SENTRY_DSN env var는 EAS build 시 inline되어 JS bundle에 들어감.
 * SENTRY 운영 가이드는 [`docs/ops/staging-infra-checklist-ko.md`](../../../docs/ops/staging-infra-checklist-ko.md) §2.4 참조.
 */
import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
    tracesSampleRate: 0.1,
    // Native crash + JS error 모두 capture.
    // Performance tracing은 navigation 자동 instrument.
    enableAutoPerformanceTracing: true,
    // PII 자동 redact — JWT / 쿠키 등.
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

export { Sentry };
