---
id: ADR-022
title: Standardize API path on `/api/v1/...` (URI versioning, no `/v` prefix on numeric segment)
status: Accepted
date: 2026-04-27
author: Gray Kim
related_tasks: [T-080, T-082]
related_context: Infrastructure
supersedes: null
related_reports: [RPT-260424-E]
---

## Context

A-idol's HTTP routing was originally configured in [`packages/backend/src/main.ts`](../../packages/backend/src/main.ts) as:

```typescript
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: false });
```

The `prefix: false` option suppressed the default `'v'` segment, producing routes like `/1/auth/login`, `/1/admin/auth/login`, `/1/idols`. This pattern was:

- **Inconsistent with industry convention** — `/api/v1/...` is the de-facto standard for REST APIs.
- **Inconsistent with the platform standard** — [`amoeba_code_convention_v2.md §8.1`](../amb-starter-kit/amoeba_code_convention_v2.md) prescribes `/api/v{version}/{resource}`.
- **Misdocumented internally** — [`a-idol-code-convention.md §8.1`](../implementation/a-idol-code-convention.md) (prior to v1.3) stated *"A-idol does **not** use `/api/v1/` prefix as of v0.1.0"*, which was wrong on two counts: (1) URI versioning was already active (`/1/`), and (2) the convention doc never aligned with code.
- **Hostile to standard infrastructure tooling** — AWS ALB / Nginx / Cloudflare path-based routing typically expect `/api/*` to denote backend traffic, distinguishing from static assets / SPA routes.

By 2026-04-27 the codebase had grown to:
- ~95 HTTP endpoints under `/1/...`
- CMS (`packages/cms/src/`) with 49 hard-coded `/1/...` paths
- Mobile (`packages/mobile/`) with `apiBaseUrl: 'http://localhost:3000/1'` (version absorbed into base URL)
- Backend integration tests (`packages/backend/test/`) with 232+ `/1/...` references
- `scripts/smoke.sh` baking `/1` into `${BASE}/1`

The non-standard `/1/` pattern was on track to become a load-bearing artifact of staging/production deployments (Phase D infrastructure design imminent). This ADR resolves the inconsistency **before** ALB/CDN path policies are designed.

## Decision

**Adopt `/api/v1/...` as the canonical API path pattern**, achieved by replacing the routing config with the standard NestJS dual-mechanism setup:

```typescript
// packages/backend/src/main.ts
app.setGlobalPrefix('api', { exclude: ['/health', '/metrics'] });
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });  // prefix='v' (default)
```

Concrete behavior:

| Surface | Path pattern | Example |
|---|---|---|
| Default-versioned controllers | `/api/v<n>/<route>` | `/api/v1/auth/login`, `/api/v1/admin/auth/login`, `/api/v1/idols` |
| `VERSION_NEUTRAL` controllers (`health`, `metrics`) | `/<route>` (no prefix) | `/health`, `/metrics` |
| Future v2 controllers (per-controller `@Version('2')`) | `/api/v2/<route>` | `/api/v2/<route>` |

`/health` and `/metrics` are **excluded from `setGlobalPrefix`** so orchestrator probes (k8s liveness/readiness, ALB target health, Prometheus scraper) can hit them without API-versioning awareness.

## Consequences

### Positive

- **Industry-standard path shape** — onboarding contributors recognize `/api/v1/` immediately; no FAQ entry needed.
- **amb-starter-kit alignment on §8.1** — removes one entry from the deviation table ([code-convention §16](../implementation/a-idol-code-convention.md)).
- **ALB / Nginx friendliness** — staging/production load balancers can use `/api/*` path-based routing rules without a custom shim.
- **v2 migration path is natural** — `app.enableVersioning` + per-controller `@Version('2')` ships a v2 endpoint at `/api/v2/...` while keeping v1 reachable. No infrastructure rewrite needed.
- **Probe stability** — `/health` / `/metrics` deliberately bypass versioning, matching common k8s/Prometheus expectations.
- **Documentation no longer lies** — three docs were misaligned with the code (RPT-260424-E §4, code-convention §8.1, plus ADR-010 inconsistency). The migration forces a single truth.

### Negative

- **One-shot client churn** — CMS (49 path constants), Mobile (5 base-URL strings), integration tests (232 path strings), smoke script, and 8 documentation files required mechanical updates. Performed atomically on 2026-04-27 (this ADR's commit).
- **Slight URL length increase** — `/api/v1/` is 4 chars longer than `/1/`. Negligible for anything but extreme high-throughput payload-budget endpoints; A-idol has no such case.
- **`/health` / `/metrics` exclusion is special-cased** — future probe-style endpoints must remember to set `VERSION_NEUTRAL` *and* be added to the exclude list. Drift risk mitigated by §17 checklist update.

## Alternatives considered

### 1. Keep `/1/...` and document the deviation

Rejected. Saving ~0.5 engineer-day of mechanical migration costs an indefinite stream of:
- Onboarding FAQ entries ("why no `/api/`?")
- Custom ALB/Nginx path rules (instead of standard `/api/*` routing)
- Conflicts when integrating any third-party tool that assumes `/api/v1/` (OpenAPI generators, API gateways, monitoring agents).

The longer A-idol runs on `/1/...`, the higher the migration cost. 2026-04-27 (pre-staging) is the cheapest moment.

### 2. `/v1/...` (no `/api/` segment, but with `/v` prefix)

Rejected. Compromise position with neither industry alignment nor amb-starter-kit alignment. Same migration cost as `/api/v1/`, strictly less benefit.

### 3. `/api/...` without version segment, version via header (`Accept: application/vnd.aidol.v1+json`)

Rejected. NestJS supports header versioning natively (`VersioningType.HEADER`), but:
- Discoverability suffers (Swagger UI doesn't render header negotiation as cleanly).
- Caching layers (CDN, browser) must vary by header — operational complexity.
- Mobile/CMS clients must reliably set the header on every request — brittle.

URI versioning is the simplest reliable option for an MVP-stage product. Header versioning can be reconsidered post-MVP if multiple concurrent versions are needed.

### 4. Move version into the base URL only (`apiBaseUrl = 'http://localhost:3000/api/v1'`), strip from path strings

Considered for symmetry with Mobile (which already absorbs the version into `apiBaseUrl`). Rejected for **CMS** because:
- 49 `/1/...` path strings would still need to change to `/...` (same edit volume).
- CMS contributors should still see `/api/v1/admin/auth/login` in code so the versioning is visible at call sites; otherwise the version becomes invisible until you trace the env var.

Adopted as a **future style** in CMS only if a v2 client emerges that needs to hit a different version per-call.

## Status of implementation

Migration performed 2026-04-27 in a single change set:

| Surface | Files | Change |
|---|---|---|
| Backend | `packages/backend/src/main.ts` | `enableVersioning(..., prefix: false)` → `setGlobalPrefix('api', { exclude: ['/health', '/metrics'] })` + `enableVersioning({ defaultVersion: '1' })` |
| Backend tests | `packages/backend/test/integration/**/*.ts` | 232 `'/1/...'` → `'/api/v1/...'` (sed mass-replace; comments / describe-titles also updated) |
| Backend src comments | `packages/backend/src/modules/**/*.ts` (selected files) | 6 doc-comment path references updated |
| Shared types | `packages/shared/src/contracts/index.ts` | 1 doc-comment path reference |
| CMS | `packages/cms/src/**/*.{ts,tsx}` | 49 path strings updated (`/1/...` → `/api/v1/...`) |
| Mobile | `packages/mobile/src/api/client.ts`, `useChatRoom.ts`, `__tests__/test-utils.ts`, `app.json` | 5 base-URL fallbacks: `'http://localhost:3000/1'` → `'http://localhost:3000/api/v1'` |
| Smoke script | `scripts/smoke.sh` | `API="${BASE}/1"` → `API="${BASE}/api/v1"` + display strings |
| Docs (mass) | `docs/**/*.md` | 136 `/1/...` references → `/api/v1/...` (req-definition, ops, ADRs, prior reports) |
| Docs (surgical) | `a-idol-code-convention.md §8.1`, `RPT_260424_current-structure-spec.md §4 + §10.1` | Path rules rewritten; route tables prefixed; Document History bumped |

Post-migration verification:
```bash
grep -rn "/1/" packages/ scripts/ docs/ | grep -v node_modules | grep -v ".d.ts:" | grep -v "dist/"
# (empty — clean)
```

## Future work

- **v2 introduction guide**: when the first `/api/v2/...` controller is added, file an ADR documenting (a) the v1 vs v2 contract diff, (b) deprecation timeline for v1, (c) client migration plan. Use NestJS `@Version('2')` per-controller — no main.ts change needed.
- **Probe path expansion**: if `/ready`, `/live`, `/version` endpoints are added (T-082 follow-up), include them in the `exclude` list of `setGlobalPrefix`.
- **Swagger UI**: confirmed to work with the new path shape (`/docs` lists endpoints under `/api/v1/...`). If a v2 surfaces, `SwaggerModule.setup` may need a per-version document split.
- **CORS_ORIGINS**: unchanged by this ADR (it gates origins, not paths). No `.env.example` update needed.
- **Integration / smoke tests**: must run green post-migration. CI gate (Phase D) MUST exercise both `/health` (no prefix) and at least one `/api/v1/...` route.
