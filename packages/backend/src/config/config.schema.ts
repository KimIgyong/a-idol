import { z } from 'zod';

/**
 * Zod schema for validated, typed environment config.
 * Import `AppConfig` (the provider token + class) in providers.
 */
export const configSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  port: z.coerce.number().int().positive().default(3000),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  databaseUrl: z.string().url(),
  redisUrl: z.string().url(),
  jwtAccessSecret: z.string().min(24),
  jwtAccessExpiresIn: z.string().default('15m'),
  jwtRefreshSecret: z.string().min(24),
  jwtRefreshExpiresIn: z.string().default('14d'),
  bcryptRounds: z.coerce.number().int().min(4).max(15).default(10),
  corsOrigins: z.string().transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
  // T-082 — 글로벌 default ThrottlerGuard limit. dev/prod=200, k6 부하 측정
  // window 동안 staging에서 100k 정도로 상향 가능. ttl은 60s 고정 (window
  // semantics 변경은 throttle 동작 자체를 흔드는 일이라 별도 슬라이스).
  throttleLimitPerMinute: z.coerce.number().int().positive().default(200),
  // T-080 — Sentry DSN. 비어있으면 SDK init skip (graceful — pino error
  // 로그만 사용). staging/prod 에서 설정.
  sentryDsn: z.string().default(''),
  /** 트랜잭션 sampling rate. 0 = 비활성, 1 = 100%. cost control용 0.1 default. */
  sentryTracesSampleRate: z.coerce.number().min(0).max(1).default(0.1),
});

export type AppConfigShape = z.infer<typeof configSchema>;

export class AppConfig implements AppConfigShape {
  nodeEnv!: AppConfigShape['nodeEnv'];
  port!: number;
  logLevel!: AppConfigShape['logLevel'];
  databaseUrl!: string;
  redisUrl!: string;
  jwtAccessSecret!: string;
  jwtAccessExpiresIn!: string;
  jwtRefreshSecret!: string;
  jwtRefreshExpiresIn!: string;
  bcryptRounds!: number;
  corsOrigins!: string[];
  throttleLimitPerMinute!: number;
  sentryDsn!: string;
  sentryTracesSampleRate!: number;
}

export const loadConfig = (): AppConfig => {
  const raw = {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    logLevel: process.env.LOG_LEVEL,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
    jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
    bcryptRounds: process.env.BCRYPT_ROUNDS,
    corsOrigins: process.env.CORS_ORIGINS ?? '',
    throttleLimitPerMinute: process.env.THROTTLE_LIMIT_PER_MINUTE,
    sentryDsn: process.env.SENTRY_DSN,
    sentryTracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE,
  };

  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('❌ Invalid environment configuration:');
    for (const issue of parsed.error.issues) {
      // eslint-disable-next-line no-console
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return Object.assign(new AppConfig(), parsed.data);
};
