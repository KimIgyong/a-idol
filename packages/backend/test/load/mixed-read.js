/**
 * Mixed-traffic load test — 90% read / 10% write. Approximates a busy
 * homepage load: mobile clients poll the idol list + leaderboard every few
 * seconds, occasionally cast a heart vote.
 *
 * Default ramp (total 3m30s):
 *   0   → 60s  : ramp 0 → TARGET_VUS  (warm caches, detect obvious crashes)
 *   60  → 180s : steady at TARGET_VUS
 *   180 → 210s : ramp down to 0
 *
 * Env-driven knobs (see docs/ops/k6-staging-runbook-ko.md §3 for the
 * staging ramp curve):
 *   TARGET_VUS         (default: 100)   peak concurrent VUs
 *   DURATION           (default: '2m')  steady-state duration
 *   RAMP_UP_DURATION   (default: '1m')  warm-up duration
 *   RAMP_DOWN_DURATION (default: '30s') graceful drain
 *   ROUND_ID           (optional)       active round for /leaderboard + vote
 *   K6_NO_SIGNUP       (optional)       skip per-VU signup → read-only
 *
 * Thresholds:
 *   http_req_failed < 2%       — allow brief blips under warm-up
 *   p(95) /idols       < 800ms — homepage feed budget
 *   p(95) /leaderboard < 500ms — ranking ticker budget (ADR-021 Lever 5 trigger)
 *   p(95) /products    < 400ms — catalog budget
 *   checks > 98%               — correctness floor
 *
 * Run:
 *   k6 run test/load/mixed-read.js
 *   k6 run -e ROUND_ID=<uuid> test/load/mixed-read.js
 *   k6 run -e TARGET_VUS=5000 -e DURATION=5m test/load/mixed-read.js
 *
 * Staging 50k VU target: see runbook §3.1 for the 5-stage ramp.
 * Local dev mode saturates at ~1k VUs on a single `pnpm dev` process —
 * the 50k target requires staging pm2 cluster.
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { BASE_URL, discover, pick, signupFreshUser } from './common.js';

// Custom trend to track leaderboard specifically — the cache hit path is
// the one most likely to shift GA performance numbers.
const leaderboardLatency = new Trend('leaderboard_latency', true);

const TARGET_VUS = Number(__ENV.TARGET_VUS || 100);
const DURATION = __ENV.DURATION || '2m';
const RAMP_UP_DURATION = __ENV.RAMP_UP_DURATION || '1m';
const RAMP_DOWN_DURATION = __ENV.RAMP_DOWN_DURATION || '30s';

export const options = {
  scenarios: {
    mixed: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP_UP_DURATION, target: TARGET_VUS },
        { duration: DURATION, target: TARGET_VUS },
        { duration: RAMP_DOWN_DURATION, target: 0 },
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    'http_req_duration{name:idols_list}': ['p(95)<800'],
    'http_req_duration{name:leaderboard}': ['p(95)<500'],
    'http_req_duration{name:products}': ['p(95)<400'],
    checks: ['rate>0.98'],
  },
};

export function setup() {
  const data = discover();
  if (!data.idolIds.length) {
    throw new Error('seed missing — run `pnpm seed` before load tests');
  }
  return data;
}

export default function (data) {
  // Per-VU token. Signed up lazily via globalThis to avoid one-signup-per-iter
  // churn. Each VU holds onto their token for the whole run.
  if (!__ENV.K6_NO_SIGNUP && !globalThis.__token) {
    globalThis.__token = signupFreshUser();
  }
  const token = globalThis.__token;

  // 10-sided die — roll decides the request mix per iteration.
  const roll = Math.floor(Math.random() * 10);

  if (roll < 4) {
    group('idols list', () => {
      const res = http.get(`${BASE_URL}/idols?size=20`, {
        tags: { name: 'idols_list' },
      });
      check(res, { 'idols 200': (r) => r.status === 200 });
    });
  } else if (roll < 6) {
    group('leaderboard', () => {
      if (!data.roundId) return;
      const res = http.get(`${BASE_URL}/rounds/${data.roundId}/leaderboard`, {
        tags: { name: 'leaderboard' },
      });
      check(res, { 'leaderboard 200': (r) => r.status === 200 });
      leaderboardLatency.add(res.timings.duration);
    });
  } else if (roll < 8) {
    group('products', () => {
      const res = http.get(`${BASE_URL}/commerce/products`, {
        tags: { name: 'products' },
      });
      check(res, { 'products 200': (r) => r.status === 200 });
    });
  } else if (roll < 9) {
    group('idol detail', () => {
      const id = pick(data.idolIds);
      const res = http.get(`${BASE_URL}/idols/${id}`, {
        tags: { name: 'idol_detail' },
      });
      check(res, { 'idol 200': (r) => r.status === 200 });
    });
  } else {
    group('cast heart vote', () => {
      if (!data.roundId || !token) return;
      const idolId = pick(data.idolIds);
      const res = http.post(
        `${BASE_URL}/rounds/${data.roundId}/votes`,
        JSON.stringify({ idolId, method: 'HEART' }),
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          tags: { name: 'vote_heart' },
        },
      );
      // 200 on success, 429 on daily limit, 409 on duplicate — all expected.
      check(res, {
        'vote 2xx/4xx not 5xx': (r) => r.status < 500,
      });
    });
  }

  // Simulates a 1 req/s/VU arrival rate — keep low enough that 100 VUs
  // generate ~100 rps, not thousands. Real users are slower than this.
  sleep(1);
}
