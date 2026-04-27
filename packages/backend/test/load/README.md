# Load tests (T-081)

k6 scripts that drive the backend under realistic mixed traffic. Kept deliberately
small so the GA-path cost of running them is low — each scenario is one file.

## Install

macOS (Homebrew):
```bash
brew install k6
```

Docker (CI / ephemeral):
```bash
alias k6='docker run --rm -i --network=host -v "$PWD":/src grafana/k6'
```

## Prerequisites

1. Backend running at `http://localhost:3000` (`make dev` or `pnpm dev`)
2. Seed data applied (`make seed` or `pnpm --filter @a-idol/backend seed`)
3. (For `mixed-read.js` write path) Grab an ACTIVE round id:
   ```bash
   docker exec a-idol-postgres psql -U aidol -d aidol -tA \
     -c "SELECT id FROM rounds WHERE status='ACTIVE' LIMIT 1"
   ```

## Scenarios

### smoke.js — 10-second sanity
Verifies every read endpoint responds 200 under 1 VU. Run before any larger
scenario.
```bash
k6 run test/load/smoke.js
```

### mixed-read.js — env-driven ramp-up, 90% read / 10% write
Ramps 0 → `TARGET_VUS` (default 100), holds for `DURATION` (default 2m), drains.
Tags requests by endpoint so k6 surfaces per-endpoint p(95) thresholds.
```bash
# default — 100 VUs, 3m30s total
k6 run -e ROUND_ID=<uuid> test/load/mixed-read.js

# scaled — 5k VUs steady for 5 min (staging runbook S4)
k6 run -e TARGET_VUS=5000 -e DURATION=5m -e ROUND_ID=<uuid> test/load/mixed-read.js
```
Opt-out of write traffic (reads only):
```bash
k6 run -e K6_NO_SIGNUP=1 test/load/mixed-read.js
```

### Environment variables

| Var | Default | Purpose |
|---|---|---|
| `BASE_URL` | `http://localhost:3000/1` | API root (versioned) |
| `ROUND_ID` | discovered from `/rounds/active` | leaderboard + vote target |
| `AUD_ID` | discovered from `/auditions` | audition detail target |
| `K6_NO_SIGNUP` | unset | skip signup + write path |
| `TARGET_VUS` | `100` | peak concurrent VUs (mixed-read only) |
| `DURATION` | `2m` | steady-state hold time (mixed-read only) |
| `RAMP_UP_DURATION` | `1m` | warm-up ramp duration (mixed-read only) |
| `RAMP_DOWN_DURATION` | `30s` | graceful drain (mixed-read only) |

## Thresholds

Both scripts fail the run if thresholds breach — the exit code is non-zero so
CI can gate on it. Current defaults (see per-file `options.thresholds`):

- `http_req_failed < 2%`
- `p(95)` per endpoint: idols < 800ms, leaderboard < 500ms, products < 400ms
- `checks > 98%`

Tighten these before GA. Local dev-watch mode is the slowest realistic path —
prod (pm2 cluster + managed PG/Redis) should clear these with headroom.

## Scaling toward T-081 50k-concurrent

- Single `pnpm dev` saturates the event loop around 9k RPS (see
  `docs/ops/perf-baseline-ko.md`). For 50k concurrent users, `pnpm dev` is
  the wrong target — use a production build + `pm2 cluster` on the load-test
  host, or run against staging.
- The 5-stage staging ramp (100 → 500 → 1k → 5k → 50k) is documented in
  [`docs/ops/k6-staging-runbook-ko.md`](../../../docs/ops/k6-staging-runbook-ko.md)
  §3. Each stage runs the same `mixed-read.js` with a different
  `-e TARGET_VUS=` value — no script changes needed.
- The full-blown 50k run belongs on a dedicated machine; don't run it
  against a dev laptop.

## Results

k6 writes a summary to stdout. For comparison runs, pipe to a file:
```bash
k6 run --summary-export=results/$(date +%Y%m%d-%H%M).json test/load/mixed-read.js
```
Result files are gitignored (see `.gitignore`).
