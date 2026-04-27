/**
 * Shared helpers for k6 load tests. Not a k6 scenario itself — import from
 * the per-scenario files (smoke.js, mixed-read.js).
 *
 * Env vars:
 *   BASE_URL   — target API root (default http://localhost:3000/api/v1)
 *   AUD_ID     — audition id to hit on /auditions/:id (optional)
 *   ROUND_ID   — active round id for vote + leaderboard (optional)
 *
 * The `discover()` helper calls /idols + /commerce/products + /auditions at
 * scenario setup to pick real ids if env vars aren't provided. This keeps
 * the scripts self-contained against a seeded dev DB.
 */
import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';

export function discover() {
  const idols = http.get(`${BASE_URL}/idols?size=20`);
  check(idols, { 'discover /idols 200': (r) => r.status === 200 });
  const idolIds = JSON.parse(idols.body).items.map((i) => i.id);

  const products = http.get(`${BASE_URL}/commerce/products`);
  check(products, { 'discover /commerce/products 200': (r) => r.status === 200 });
  const productIds = JSON.parse(products.body).map((p) => p.id);

  const auditions = http.get(`${BASE_URL}/auditions`);
  check(auditions, { 'discover /auditions 200': (r) => r.status === 200 });
  const auditionIds = JSON.parse(auditions.body).map((a) => a.id);

  return {
    idolIds,
    productIds,
    auditionIds,
    auditionId: __ENV.AUD_ID || auditionIds[0] || null,
    roundId: __ENV.ROUND_ID || null,
  };
}

/**
 * Signs up a fresh user per VU (k6 calls setup() per scenario; each VU
 * then gets its own token via this helper). We don't try to reuse accounts
 * across VUs because write tests (vote casting) state-share behind the
 * scenes and would make results non-deterministic.
 */
export function signupFreshUser() {
  const suffix = `${__VU}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const res = http.post(
    `${BASE_URL}/auth/signup`,
    JSON.stringify({
      email: `k6-${suffix}@a-idol.dev`,
      password: 'k6-load-test-0000',
      nickname: `k6${__VU}`,
      birthdate: '2000-01-01',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'signup 201': (r) => r.status === 201 });
  if (res.status !== 201) return null;
  return JSON.parse(res.body).accessToken;
}

/**
 * Pick a random element from an array — used to spread the traffic across
 * entities so PG + Redis caches don't stay trivially hot on a single row.
 */
export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
