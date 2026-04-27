// Integration test runner — distinct from `pnpm test` so unit tests stay
// fast (no DB/Redis). Assumes `pnpm db:up` + `pnpm seed` have run against
// the local docker-compose stack. CI wiring is deferred until Phase D.
/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testMatch: ['<rootDir>/test/integration/**/*.spec.ts'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.integration.json' }],
  },
  testEnvironment: 'node',
  // Integration tests serialize — they share a Postgres database and
  // truncate scoped tables between specs. Parallel execution would race.
  maxWorkers: 1,
  // 30s gives ample room for slow Redis cold-starts on CI; most tests
  // finish well under 1s.
  testTimeout: 30_000,
  // BullMQ workers + ioredis clients keep handles open after app.close().
  // forceExit trades a clean-shutdown assertion for a fast exit — acceptable
  // for an integration runner that isn't trying to surface handle leaks.
  forceExit: true,
};
