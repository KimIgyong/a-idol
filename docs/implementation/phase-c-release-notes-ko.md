# Phase C Release Notes — 성능 · 캐싱 · 테스트 인프라 · ETag 전방위

> **Audience**: PM · QA · 다음 sprint 합류자 · CTO 회람용. Phase D 진입
> 게이트 문서.
>
> **Window**: 2026-04-23 → 2026-04-25
> **Owner**: Gray Kim
> **Status**: Phase C 마감 직전 — k6 50k staging 실측만 남음

---

## 1. TL;DR

- 성능 4축 ([ADR-021](../adr/ADR-021-phase-c-perf-levers.md)) 전부 적용 + 모바일·CMS까지 클라이언트 수혜 확보
- ETag 304 conditional GET을 **7개 엔드포인트**(public 4 + per-user 2 + admin 1)에 동일 패턴으로 확산
- Test 합계 **backend 109 unit + 67 integration + mobile 43 hook + 16 ETag integration = 235 tests** (이전 phase 시작 무렵 100 미만)
- ADR-014/017/019/020/021 5개 결정 기록, 1개 운영 design sketch 파킹
- k6 하네스 + CI 2-jobs 워크플로 → Phase D 진입 시 회귀 자동 차단 가능

50k VU staging 실측만 떨어지면 Phase D 진입 OK.

---

## 2. 성능 4축 (ADR-021)

| Lever | 적용 영역 | 대표 임팩트 (locallhost) | Staleness 정책 |
|---|---|---|---|
| 1. gzip compression | `app.use(compression({ threshold: 1024 }))` | /idols 4 KB → 1.5 KB (−63%) | 없음 |
| 2. Prisma `select` narrowing | 4 repos (public idol list, my-hearts, my-follows, admin idol) | /idols +12%, fandom +5~7% RPS | 없음 (서버측 CPU만) |
| 3. Redis `IdolMetaCache` + write-through | `GetLeaderboardUseCase` | /leaderboard 5,117 → 6,454 RPS (+26%), p50 9→7 ms | TTL 5분 + admin update/softDelete invalidate |
| 4. ETag / 304 | 7 endpoints — 다음 절 참조 | hit 경로 +63~110% RPS, 바이트 −53~66% | weak ETag, write-through 또는 `Vary: Authorization` |

세부 수치 + 미적용 경로 전부 [perf-baseline-ko.md](../ops/perf-baseline-ko.md).

---

## 3. ETag 304 적용 endpoint 전수

| Endpoint | 패턴 | 200/304 | 비고 |
|---|---|---|---|
| `GET /api/v1/idols` | cheap identity probe | 2,508 / 5,255 RPS (+110%) | count + max(updatedAt) probe, page/sort 임베딩 |
| `GET /api/v1/commerce/products` | cheap identity probe | 3,371 / 5,511 (+63%) | activeOnly 필터 임베딩 |
| `GET /api/v1/auditions/:id` | loaded-data | 4,567 / 4,873 (+7%) · 바이트 −66% | round/entry count + `eliminatedAt` 집계, write-through로 staleness 방어 |
| `GET /api/v1/idols/:id` | loaded-data | RPS 미측정 | `idol.updatedAt + i<imageCount>` |
| `GET /api/v1/me/hearts` | per-user cheap probe | 미측정 | userId 임베딩 + `Vary: Authorization` |
| `GET /api/v1/me/follows` | per-user cheap probe | 미측정 | 동일 |
| `GET /api/v1/admin/catalog/idols` | cheap identity probe | 미측정 | CMS apiFetch 자동 If-None-Match |

**Staleness 메커니즘**:
- `/auditions/:id`: `AuditionRepository.touchUpdatedAt` 포트로 6 usecase가 round/entry mutation 직후 audition.updatedAt bump
- `/me/hearts` `/me/follows`: `Vary: Authorization` + ETag에 userId segment → 다른 유저 cross-match 불가
- 다른 유저의 heart/follow 활동으로 인한 heartCount 드리프트는 invalidate 안 함 (weak-ETag 한계 — 사용자가 새로고침하면 fresh)

**ETag 전수 회귀 커버**: ITC-ETAG (16 integration tests) + ITC-CATALOG (4) + ITC-LBCACHE (2).

---

## 4. 클라이언트 수혜 — CMS · Mobile

### CMS

- **`apiFetch` 자동 ETag 캐싱** ([packages/cms/src/lib/api.ts](../../packages/cms/src/lib/api.ts)) — module-level Map, GET마다 자동 If-None-Match 송신, 304 시 캐시된 body 반환
- **`@/lib/query-keys` 레지스트리 + `@/lib/query-invalidation` fan-out helpers** — 7 surface 적용 (agencies, idols, auditions, commerce, photocards × 2, auto-messages, vote-rule)
- **Cross-entity invalidation 신규**: agency rename → idol list flush, vote-rule upsert → audition detail flush, product change → analytics overview flush

### Mobile

- **`apiFetch` 자동 ETag 캐싱** ([packages/mobile/src/api/client.ts](../../packages/mobile/src/api/client.ts)) — CMS와 동일 패턴, cache key는 `${path}${qs}`로 페이지별 독립
- **신규 hooks** — `useMyHearts`, `useMyFollows` (페이지네이션 + removeLocally + stale-cancel)
- **기존 hooks** 모두 자동 304 경로 활용 (useIdolsList, useLeaderboard, useIdolDetail, useChatRoom, useFandom, useVote, useCommerce, useMyFandom)
- 43 tests / 9 suites 🟢 (이전 phase 시작 시 0)

---

## 5. ADR 등록 (이번 phase 새로 지정된 것)

| ADR | 제목 | Status |
|---|---|---|
| [ADR-019](../adr/ADR-019-apple-iap-adapter.md) | Apple StoreKit v2 IAP adapter (offline JWS) | Accepted, 2026-04-23 |
| [ADR-020](../adr/ADR-020-orm-prisma-over-typeorm.md) | Prisma over TypeORM (amb-starter-kit deviation) | Accepted, 2026-04-24 |
| [ADR-021](../adr/ADR-021-phase-c-perf-levers.md) | Phase C performance levers — four axes | Accepted, 2026-04-24 |

전체 ADR 인덱스: [docs/adr/README.md](../adr/README.md).

**Design sketch (구현 대기)**: [design-leaderboard-full-cache-ko.md](../ops/design-leaderboard-full-cache-ko.md) — `/leaderboard` 전체 응답 Redis cache. Trigger는 k6 50k 실측 시 `/leaderboard` 가 여전히 병목일 때.

---

## 6. 테스트 인프라

### Backend
- 23 suites / **109 unit tests** (jest, ts-jest)
- 13 suites / **67 integration tests** (supertest + docker-compose PG/Redis)
- `pnpm test` / `pnpm test:integration`

### Mobile (Phase B 시작 시 0)
- 9 suites / **43 hook tests** (jest + @testing-library/react + jsdom + 자체 fetch mock)
- WS socket.io-client mock, 304 short-circuit 검증, ADR-017 correlation id 분기

### CMS
- 빌드 + lint + typecheck 통과 (현재 spec 0 — Phase D 도입 후보)

### Load (k6)
- [packages/backend/test/load/](../../packages/backend/test/load/) — `smoke.js` (10s/1 VU) + `mixed-read.js` (3m30s, 0→100 VUs, 90/10 read/write mix)
- 엔드포인트별 p(95) threshold → CI gate로 활용 가능
- 50k 실측은 staging pm2 cluster에서 집행 (dev mode는 ~9k 상한)

### CI
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) — 3 jobs:
  - `lint-test`: lint · typecheck · backend unit + mobile unit · backend+cms build
  - `integration`: postgres 16 + redis 7 services + prisma migrate + seed + integration
  - `phase-c-summary` (aggregator, `needs: [lint-test, integration]`, `if: always()`): runs `bash scripts/phase-c-status.sh --summary` → writes Phase D backlog count + ADR roster + reference links to `$GITHUB_STEP_SUMMARY`. 매 PR · 매 push의 GitHub Actions 페이지 1초 status pane.

---

## 7. 운영 문서

- [docs/ops/runbook-ko.md](../ops/runbook-ko.md) — 7가지 incident 플레이북
- [docs/ops/perf-baseline-ko.md](../ops/perf-baseline-ko.md) — 측정 + 변경이력 + 미적용 경로
- [docs/ops/k6-staging-runbook-ko.md](../ops/k6-staging-runbook-ko.md) — Phase D #1 작업: 5단계 ramp + Lever 5 트리거 + 비용 추정
- [docs/ops/design-leaderboard-full-cache-ko.md](../ops/design-leaderboard-full-cache-ko.md) — 미구현 설계
- [docs/ops/apple-developer-program-checklist-ko.md](../ops/apple-developer-program-checklist-ko.md)
- [docs/ops/dependency-approval-jose-ko.md](../ops/dependency-approval-jose-ko.md)
- [docs/support/faq-ko.md](../support/faq-ko.md) — 16 Q&A

---

## 8. Phase D 백로그 (ADR-021에서 이송)

이번 phase 마감되며 ETag 항목은 전부 클로즈됨. Phase D 진입 시 우선순위 순:

1. **k6 50k staging 실측** — staging pm2 cluster 환경에서 GA 시점 트래픽 패턴 검증. Phase D 첫 작업.
2. **`/leaderboard` 전체 응답 Redis cache** (Lever 5 후보) — 위 측정에서 leaderboard가 여전히 병목이면 [design sketch](../ops/design-leaderboard-full-cache-ko.md) 대로 구현. 1일 작업.
3. **OpenTelemetry · Sentry · Datadog 도입** — T-080 미착수분.
4. **OWASP ASVS L2 · WCAG AA 감사** — T-082, T-083 미착수.
5. **스토어 제출 prep** — T-085. T-046 (commerce flow) 의존.
6. **`/auditions` (list) ETag** — Phase C 미적용. churn 낮음 → short-TTL Redis cache가 더 적합할 수 있음.
7. **CMS spec 도입** — vitest + @testing-library/react. 현재 spec 0개라 회귀 안전망 부족.

---

## 9. 변경 영향 받은 파일 인벤토리 (요약)

**Backend (perf · ETag)**
- `src/main.ts` — compression middleware
- `src/modules/catalog/{application,infrastructure,presentation}/*` — IdolMetaCache, ETag, select narrowing, admin write-through
- `src/modules/audition/{application,infrastructure,presentation}/*` — ETag, touchUpdatedAt, write-through hooks
- `src/modules/fandom/{application,infrastructure,presentation}/*` — select narrowing, getMyListIdentity, ETag
- `src/modules/vote/application/leaderboard.usecase.ts` — IdolMetaCache 주입
- `src/modules/commerce/{application,infrastructure,presentation}/*` — ETag

**Mobile**
- `src/api/client.ts` — ETag 캐시
- `src/hooks/useMyFandom.ts` — 신규
- `src/hooks/__tests__/*.spec.ts` — 9 suites

**CMS**
- `src/lib/api.ts` — ETag 캐시 + invalidation export
- `src/lib/query-keys.ts` — 신규 레지스트리
- `src/lib/query-invalidation.ts` — 신규 fan-out helpers
- `src/features/{agencies,idols,auditions,commerce,photocards,auto-messages}/*.tsx` — 7 surface retrofit

**Docs**
- `docs/adr/ADR-{019,020,021}-*.md`
- `docs/ops/{perf-baseline,design-leaderboard-full-cache,runbook}-ko.md`
- `docs/implementation/{phase-c-checklist, phase-c-release-notes}-ko.md`

**CI**
- `.github/workflows/ci.yml`
- `packages/backend/test/load/{smoke,mixed-read}.js + README.md`

---

## 10. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-25 | 초안 작성. ADR 번호 충돌(ADR-020 perf-levers) 발견 → ADR-021로 재번호 + 코드 주석 일괄 수정. |
