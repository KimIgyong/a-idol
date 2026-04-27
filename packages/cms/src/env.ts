import { z } from 'zod';

const schema = z.object({
  VITE_API_BASE_URL: z.string().url().default('http://localhost:3000'),
  // Mobile app preview iframe target (Expo web build). Empty string
  // disables the preview menu — useful for prod builds where the staging
  // preview URL isn't yet configured.
  VITE_MOBILE_PREVIEW_URL: z.string().url().or(z.literal('')).default('http://localhost:8081'),
  // T-080 Sentry — DSN 비어있으면 init skip (graceful no-op).
  VITE_SENTRY_DSN: z.string().default(''),
  VITE_APP_ENV: z.string().default('development'),
  // T-080 Sentry release tagging — staging deploy.sh 가 빌드 시점에 git SHA 주입.
  VITE_GIT_SHA: z.string().default(''),
});

export const env = schema.parse({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_MOBILE_PREVIEW_URL: import.meta.env.VITE_MOBILE_PREVIEW_URL,
  VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
  VITE_APP_ENV: import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE,
  VITE_GIT_SHA: import.meta.env.VITE_GIT_SHA,
});
