import 'reflect-metadata';
import { VersioningType, ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import supertest from 'supertest';

type HttpClient = ReturnType<typeof supertest>;
import { AppModule } from '../../../src/app.module';
import { AppExceptionFilter } from '../../../src/shared/errors/app-exception.filter';
import { PrismaService } from '../../../src/shared/prisma/prisma.service';

/**
 * Integration harness — boots a real NestJS app against the docker-compose
 * Postgres + Redis, returns supertest client + Prisma for state setup /
 * assertion, and exposes a `resetUser(userId)` to wipe per-user mutable
 * rows between tests. The process-level deps (DB, Redis, BullMQ queues)
 * are shared across specs within a run; per-test isolation is by user id.
 */
export interface IntegrationApp {
  app: INestApplication;
  http: HttpClient;
  prisma: PrismaService;
  /** Fully tear-down — calls Nest `app.close()` which disconnects Prisma,
   *  closes Redis clients, and stops the BullMQ workers. */
  close: () => Promise<void>;
  /** Wipe all rows scoped to one user id. Safe to call between tests. */
  resetUser: (userId: string) => Promise<void>;
}

export async function createIntegrationApp(): Promise<IntegrationApp> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  // T-082 — main.ts와 동일한 보안 헤더 적용 (helmet + x-powered-by 제거 +
  // Swagger UI 호환 CSP).
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: [`'self'`],
          scriptSrc: [`'self'`, `'unsafe-inline'`],
          styleSrc: [`'self'`, `'unsafe-inline'`],
          imgSrc: [`'self'`, 'data:', 'https:'],
          fontSrc: [`'self'`, 'data:'],
          connectSrc: [`'self'`],
          frameAncestors: [`'self'`],
          objectSrc: [`'none'`],
          baseUri: [`'self'`],
          formAction: [`'self'`],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.disable('x-powered-by');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AppExceptionFilter());
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: false,
  });
  await app.init();

  const prisma = app.get(PrismaService);
  const http = supertest(app.getHttpServer());

  const close = async (): Promise<void> => {
    await app.close();
  };

  const resetUser = async (userId: string): Promise<void> => {
    // Order matters — foreign keys. Leaf tables first, then parents.
    // (Cascade deletes on `users` would also work, but we want to keep
    // the user row between tests.)
    await prisma.$transaction([
      prisma.vote.deleteMany({ where: { userId } }),
      prisma.userPhotocard.deleteMany({ where: { userId } }),
      prisma.roundVoteTicketLedger.deleteMany({ where: { userId } }),
      prisma.roundVoteTicketBalance.deleteMany({ where: { userId } }),
      prisma.voteTicketLedger.deleteMany({ where: { userId } }),
      prisma.voteTicketBalance.deleteMany({ where: { userId } }),
      prisma.chatCouponLedger.deleteMany({ where: { userId } }),
      prisma.chatCouponWallet.deleteMany({ where: { userId } }),
      prisma.chatQuota.deleteMany({ where: { userId } }),
      // Fandom rows — if left behind, idol aggregate counts
      // (heartCount/followCount) would drift upward across repeated runs.
      prisma.heart.deleteMany({ where: { userId } }),
      prisma.follow.deleteMany({ where: { userId } }),
      prisma.membership.deleteMany({ where: { userId } }),
      prisma.purchaseTransaction.deleteMany({ where: { userId } }),
      prisma.authSession.deleteMany({ where: { userId } }),
    ]);
  };

  return { app, http, prisma, close, resetUser };
}

/**
 * Helper: sign up a fresh user with a unique-per-test email + return
 * access + refresh tokens + user id.
 */
export async function signupUser(
  http: HttpClient,
  overrides: Partial<{ email: string; password: string; nickname: string; birthdate: string }> = {},
): Promise<{ userId: string; accessToken: string; refreshToken: string; email: string }> {
  const email = overrides.email ?? `it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.a-idol.dev`;
  const password = overrides.password ?? 'integration-pw-1234';
  const nickname = overrides.nickname ?? 'it-user';
  const birthdate = overrides.birthdate ?? '2000-01-01';
  const res = await http
    .post('/api/v1/auth/signup')
    .send({ email, password, nickname, birthdate })
    .expect(201);
  return {
    userId: res.body.user.id as string,
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
    email,
  };
}
