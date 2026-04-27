/**
 * Smoke test — 1 VU, 10 seconds. Pre-flight for larger runs. Verifies the
 * target is reachable, seed data is present, and the main read endpoints
 * respond 200. If this fails, do not proceed to `mixed-read.js` or higher
 * load scripts.
 *
 * Run:
 *   k6 run test/load/smoke.js
 *   k6 run -e BASE_URL=http://staging.a-idol.dev/1 test/load/smoke.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, discover } from './common.js';

export const options = {
  vus: 1,
  duration: '10s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  return discover();
}

export default function (data) {
  const idolId = data.idolIds[0];

  const health = http.get(`${BASE_URL.replace(/\/1$/, '')}/health`);
  check(health, { 'health 200': (r) => r.status === 200 });

  const idols = http.get(`${BASE_URL}/idols?size=20`);
  check(idols, { 'idols 200': (r) => r.status === 200 });

  const idol = http.get(`${BASE_URL}/idols/${idolId}`);
  check(idol, { 'idol detail 200': (r) => r.status === 200 });

  const products = http.get(`${BASE_URL}/commerce/products`);
  check(products, { 'products 200': (r) => r.status === 200 });

  if (data.auditionId) {
    const audition = http.get(`${BASE_URL}/auditions/${data.auditionId}`);
    check(audition, { 'audition 200': (r) => r.status === 200 });
  }
  if (data.roundId) {
    const lb = http.get(`${BASE_URL}/rounds/${data.roundId}/leaderboard`);
    check(lb, { 'leaderboard 200': (r) => r.status === 200 });
  }
  sleep(0.5);
}
