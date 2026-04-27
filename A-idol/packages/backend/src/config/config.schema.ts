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
