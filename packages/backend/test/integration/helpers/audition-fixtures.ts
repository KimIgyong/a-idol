import type { IntegrationApp } from './app-harness';

/**
 * Shared audition fixtures — used by vote / audition / photocard specs.
 * Each helper is idempotent in that it creates a fresh entity per call;
 * tests call them inside `beforeAll` to avoid cross-test pollution.
 */

export async function adminLogin(http: IntegrationApp['http']): Promise<string> {
  const res = await http
    .post('/api/v1/admin/auth/login')
    .send({ email: 'admin@a-idol.dev', password: 'admin-dev-0000' })
    .expect(200);
  return res.body.accessToken as string;
}

/**
 * Ensures an `operator`-role admin user exists for authz tests, creating
 * it via Prisma if missing (no admin-create-admin API exists today). Logs
 * in and returns the access token. Safe to call repeatedly within a run.
 */
export async function operatorLogin(env: IntegrationApp): Promise<string> {
  const email = 'operator@a-idol.dev';
  const password = 'operator-it-0000';

  const existing = await env.prisma.adminUser.findUnique({ where: { email } });
  if (!existing) {
    // Same bcrypt cost (10) as the seed — so the login usecase's comparison
    // works without touching config. Hash inline to avoid pulling bcrypt
    // import into the helper surface for every test.
    const { hash } = await import('bcrypt');
    const passwordHash = await hash(password, 10);
    await env.prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        displayName: 'ITC Operator',
        role: 'operator',
        status: 'active',
      },
    });
  }

  const res = await env.http
    .post('/api/v1/admin/auth/login')
    .send({ email, password })
    .expect(200);
  return res.body.accessToken as string;
}

export interface SeededRound {
  auditionId: string;
  roundId: string;
  idolId: string;
}

/**
 * Full path: create audition → enter one idol → activate audition →
 * create round → set vote rule (heart=1, ticket=10) → activate round.
 * Returns ids for tests to drive votes / closures.
 */
export async function setupActiveRound(
  env: IntegrationApp,
  adminToken: string,
  opts: {
    labelPrefix?: string;
    voteRule?: {
      heartWeight: number;
      smsWeight: number;
      ticketWeight: number;
      dailyHeartLimit: number;
    };
  } = {},
): Promise<SeededRound> {
  const label = opts.labelPrefix ?? 'ITC';
  const start = new Date().toISOString();
  const end = new Date(Date.now() + 7 * 86_400_000).toISOString();

  const aud = await env.http
    .post('/api/v1/admin/auditions')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description: 'integration',
      startAt: start,
      endAt: end,
    })
    .expect(201);
  const auditionId = aud.body.id as string;

  const idols = await env.http.get('/api/v1/idols?size=1').expect(200);
  const idolId = idols.body.items[0].id as string;

  await env.http
    .post(`/api/v1/admin/auditions/${auditionId}/entries`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ idolIds: [idolId] })
    .expect(201);
  await env.http
    .post(`/api/v1/admin/auditions/${auditionId}/activate`)
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);

  const round = await env.http
    .post(`/api/v1/admin/auditions/${auditionId}/rounds`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'R1', orderIndex: 1, startAt: start, endAt: end })
    .expect(201);
  const roundId = round.body.id as string;

  const voteRule = opts.voteRule ?? {
    heartWeight: 1,
    smsWeight: 0,
    ticketWeight: 10,
    dailyHeartLimit: 5,
  };
  await env.http
    .put(`/api/v1/admin/auditions/rounds/${roundId}/vote-rule`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send(voteRule)
    .expect(200);
  await env.http
    .post(`/api/v1/admin/auditions/rounds/${roundId}/activate`)
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);

  return { auditionId, roundId, idolId };
}
