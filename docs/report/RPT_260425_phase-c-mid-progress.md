# [RPT-260425] Phase C 중간 정리 — Performance · ETag · 테스트 · 인프라

## Report Metadata

| 항목 | 값 |
|---|---|
| **리포트 ID** | RPT-260425 |
| **제목** | Phase C 마감 직전 중간 정리 — 작업 완료 현황 + 잔여 + Phase D 진입 게이트 |
| **작성일** | 2026-04-25 |
| **작성자** | Gray Kim <gray.kim@amoeba.group> |
| **분류** | 진행 상황 보고 (Mid-progress Report) |
| **대상 독자** | PO · CTO · QA · 다음 sprint 합류자 |
| **커버 기간** | 2026-04-23 → 2026-04-25 (3일) |
| **관련 문서** | [Phase C release notes](../implementation/phase-c-release-notes-ko.md), [ADR-021](../adr/ADR-021-phase-c-perf-levers.md), [perf-baseline-ko.md](../ops/perf-baseline-ko.md) |

---

## 1. Executive Summary

3일 동안 Phase C **성능·캐싱·테스트 인프라·문서화** 4축이 모두 GA 게이트
수준까지 진척. 남은 단일 블로커는 **k6 50k staging 실측** — staging
환경(pm2 cluster + managed PG/Redis) 확보가 전제.

| 영역 | 진척 | 남은 작업 |
|---|---|---|
| 백엔드 성능 (4축) | ✅ 적용 완료 + 측정 + ADR | staging 50k VU 실측 (Phase D #1) |
| ETag 304 | ✅ 7 endpoints 전수 + write-through | `/auditions` (list) 단일 잔여 (낮은 우선) |
| 클라이언트 캐싱 | ✅ CMS + Mobile 모두 자동 304 + `useFandom` 토글 후 prefix invalidate | (Phase D 작업 거의 없음) |
| 테스트 인프라 | ✅ 235 tests · CI 2-jobs · k6 하네스 | 50k 실측 / CMS spec 도입 |
| 문서 | ✅ ADR-021 · release notes · 인덱스 · runbook · [k6 staging runbook](../ops/k6-staging-runbook-ko.md) | telemetry 결정 |
| Phase D 백로그 | 정의됨 (7 items) | k6 → leaderboard cache → telemetry → store prep |

`make phase-c-status` (2026-04-25 18:42 시점): **8 ok · 0 fail · 0 skip**.

---

## 2. 완료된 작업 (3-day window)

### 2.1 백엔드 성능 4축 — ADR-021

| Lever | 적용 영역 | 임팩트 (localhost) |
|---|---|---|
| **1. gzip compression** | `app.use(compression({threshold: 1024}))` | /idols 4 KB → 1.5 KB (−63%) |
| **2. Prisma `select` narrowing** | 4 repos: catalog idol list / fandom hearts / fandom follows / admin idol | /idols +12%, fandom +5~7% RPS |
| **3. Redis `IdolMetaCache` + write-through** | `GetLeaderboardUseCase`, admin update/softDelete invalidate | /leaderboard 5,117 → 6,454 RPS (+26%), p50 9→7 ms |
| **4. ETag / 304** | 7 endpoints (다음 절) | hit 경로 +63~110% RPS, 바이트 −53~66% |

### 2.2 ETag 304 적용 endpoint 전수

| Endpoint | 패턴 | 측정 | 비고 |
|---|---|---|---|
| `GET /api/v1/idols` | cheap probe | 2,508 → 5,255 RPS (+110%) | count + max(updatedAt) |
| `GET /api/v1/commerce/products` | cheap probe | 3,371 → 5,511 (+63%) | activeOnly 필터 임베딩 |
| `GET /api/v1/auditions/:id` | loaded-data | +7% RPS · 바이트 −66% | round/entry count + write-through |
| `GET /api/v1/idols/:id` | loaded-data | 미측정 | `idol.updatedAt + i<imageCount>` |
| `GET /api/v1/me/hearts` | per-user probe | 미측정 | userId + `Vary: Authorization` |
| `GET /api/v1/me/follows` | per-user probe | 미측정 | 동일 |
| `GET /api/v1/admin/catalog/idols` | cheap probe | 미측정 | CMS apiFetch 자동 If-None-Match |

`/auditions/:id` write-through: `AuditionRepository.touchUpdatedAt` 포트 +
6 usecase에 훅 (Create/Update/Transition/DeleteRound + Add/RemoveEntries).

### 2.3 클라이언트 — CMS · Mobile

**CMS** ([packages/cms/](../../packages/cms/)):
- `apiFetch` module-level ETag 캐시 + If-None-Match 자동 송신 + 304 short-circuit
- `@/lib/query-keys` 레지스트리 + `@/lib/query-invalidation` 7개 fan-out helpers
- 7 surface retrofit (agencies / idols / auditions / commerce / photocards × 2 / auto-messages / round-vote-rule)
- Cross-entity invalidation 신규 확보: agency rename → idol list, vote-rule upsert → audition detail, product change → analytics overview

**Mobile** ([packages/mobile/](../../packages/mobile/)):
- `apiFetch` 동일 패턴 이식 (cache key `${path}${qs}`)
- 신규 hooks: `useMyHearts`, `useMyFollows` (페이지네이션 + removeLocally + stale-cancel)
- 기존 8개 hook 모두 자동 304 경로 활용

### 2.4 테스트 인프라

| 카테고리 | 수치 (Phase C 시작 → 현재) |
|---|---|
| Backend unit | 23 suites / **109 tests** |
| Backend integration | 13 suites / **67 tests** (catalog/etag 4 + leaderboard-cache 2 + lbcache 2 + admin etag 3 + 기타 56) |
| Mobile hook tests | 0 → **9 suites / 43 tests** |
| k6 load harness | 0 → smoke + mixed-read scenarios |
| CI workflow | 1 job → **2 parallel jobs** (`lint-test` + `integration` with PG/Redis services) |

신규 테스트 패턴 정착:
- `mobile/src/hooks/__tests__/test-utils.ts` — fetch mock + ETag/304 지원 + WS socket.io-client mock
- `backend/test/integration/etag.spec.ts` — ITC-ETAG 16 tests (PROD-001~003 / AUD-001~004 / DETAIL-001~003 / ME-001~004 / ADMIN-001~003)
- `backend/test/integration/catalog.spec.ts` — ETag 회귀 4 tests
- `backend/test/integration/leaderboard-cache.spec.ts` — write-through invalidation 2 tests

### 2.5 운영 도구

- **`make phase-c-status`** ([scripts/phase-c-status.sh](../../scripts/phase-c-status.sh)) — typecheck/lint/unit/integration/build + ADR backlog + ADR roster를 한 화면에. CI gate 호환 (실패 시 non-zero exit).
- **k6 하네스** ([packages/backend/test/load/](../../packages/backend/test/load/)) — `pnpm test:load:smoke` / `test:load:mixed`. 90/10 read/write mix, 엔드포인트별 p(95) threshold.

### 2.6 ADR · 문서

| 신규 결정 (3일) | 일자 |
|---|---|
| ADR-019: Apple StoreKit v2 IAP adapter | 2026-04-23 |
| ADR-020: Prisma over TypeORM | 2026-04-24 |
| ADR-021: Phase C performance levers (4 axes) | 2026-04-24 |

| 신규 운영/구현 문서 | 위치 |
|---|---|
| ADR 인덱스 | [docs/adr/README.md](../adr/README.md) |
| Phase C release notes | [docs/implementation/phase-c-release-notes-ko.md](../implementation/phase-c-release-notes-ko.md) |
| Leaderboard full-cache 설계 스케치 | [docs/ops/design-leaderboard-full-cache-ko.md](../ops/design-leaderboard-full-cache-ko.md) |
| Apple Developer Program 체크리스트 | [docs/ops/apple-developer-program-checklist-ko.md](../ops/apple-developer-program-checklist-ko.md) |
| jose dependency PO 승인 노트 | [docs/ops/dependency-approval-jose-ko.md](../ops/dependency-approval-jose-ko.md) |
| 운영 runbook (7 incident playbook) | [docs/ops/runbook-ko.md](../ops/runbook-ko.md) |
| Support FAQ 16 Q&A | [docs/support/faq-ko.md](../support/faq-ko.md) |

---

## 3. 진행 중 / 부분 완료

| 항목 | 상태 | 비고 |
|---|---|---|
| ADR-021 백로그 | 3/4 closed (1 open) | open = `/leaderboard` 전체 응답 cache (Lever 5 후보) |
| `/auditions` (list) ETag | 미적용 | churn 낮음 → short-TTL Redis cache가 더 적합할 수도 |
| Mobile `useFandom` invalidate retrofit | 미적용 | heart 토글 후 `/me/hearts` 캐시 stale → 다음 refresh가 304 못 탐 (한 줄 추가로 해결) |
| CMS spec 도입 | 미착수 | vitest + @testing-library/react. 현재 spec 0 → 회귀 안전망 부족 |
| k6 50k staging 실측 | 대기 | staging 환경 확보 필요 (pm2 cluster + managed PG/Redis) |

---

## 4. Phase D 진입 시 우선순위 작업 (release notes에서 이송)

### 4.1 즉시 실행 (Phase D 첫 주)

1. **k6 50k staging 실측** — staging 환경에서 GA 시점 트래픽 패턴 검증. 이 측정 결과가 Lever 5 (leaderboard full cache) 구현 트리거.
2. ~~**k6 staging runbook 작성**~~ — **2026-04-26 landed**: [k6-staging-runbook-ko.md](../ops/k6-staging-runbook-ko.md). 5단계 ramp + 측정 기록 양식 + Lever 5 트리거 정의 + 비용 추정 ($8/회 · $206/월).
3. ~~**`make phase-c-status` CI 통합**~~ — **2026-04-26 landed**: ci.yml에 `phase-c-summary` aggregator job 추가. `scripts/phase-c-status.sh --summary` markdown mode가 ADR-021 backlog count + ADR roster + 12 reference links를 `$GITHUB_STEP_SUMMARY`에 출력. 매 PR · 매 push 1초 status pane 자동 노출.

### 4.2 측정 결과 의존 (Phase D 1~2주차)

4. **`/leaderboard` 전체 응답 Redis cache (Lever 5)** — 50k 실측에서 `/leaderboard`가 여전히 병목이면 [design sketch](../ops/design-leaderboard-full-cache-ko.md)대로 1일 작업으로 구현.
5. **Mobile `useFandom` toggle 후 `invalidateEtagCache` retrofit** — 한 줄 추가, 304 빠른 경로 회복.

### 4.3 GA 전 필수 (Phase D 3~6주차)

6. **OpenTelemetry · Sentry · Datadog 도입** — T-080 미착수. 50k 트래픽에서 분산 추적 + 알람 없이는 운영 불가.
7. **OWASP ASVS L2 감사** — T-082. 외부 보안 점검 또는 자체 체크리스트 통과.
8. **WCAG AA 감사** — T-083. 모바일 + CMS 양쪽.
9. **스토어 제출 prep** — T-085. T-046 (commerce flow) 의존. Apple/Google 심사 자료 준비.

### 4.4 회귀 안전망 강화 (병렬 진행)

10. **CMS spec 도입** — vitest + @testing-library/react. 페이지별 mutation flow 회귀 커버.
11. **Mobile `apiFetch` retrofit 잔여 작업** — `useFandom` 외에도 명시적 invalidate가 필요한 곳 있는지 감사.

---

## 5. 위험 + 완화

| 위험 | 영향 | 완화 |
|---|---|---|
| staging 환경 미확보 | 50k 실측 불가 → Phase D 진입 지연 | T-008 인프라 작업 우선순위 끌어올리기 (현재 4주 추정) |
| Lever 5 ROI 모호 | 조기 구현 시 일관성 버그 리스크 | 50k 실측 후 트리거. 설계는 frozen |
| Telemetry 부재로 50k 트래픽 운영 불가 | GA 시 incident 추적 어려움 | Phase D 3주차 전 도입 |
| 22-week → 18-week 런웨이 단축 (T-008 무존재) | 일부 항목 cut 또는 4주 슬립 | M5 GA 일정 재조정 또는 Phase D scope 압축 |
| ADR 번호 충돌 (해소됨) | 이번 phase에서 발견 + 수정 완료 | ADR README index로 향후 재발 방지 |

---

## 6. 결정 요청

이번 리포트로 PO/CTO에게 **확인 요청**하는 항목:

1. **k6 staging 실측 일정** — staging 환경 확보 ETA + 50k 실측 담당자 결정.
2. **Telemetry 스택 선택** — Sentry vs OpenTelemetry collector vs Datadog (비용 + 통합 복잡도 + 한국 데이터 거주 요구). **2026-04-26 사전 비교 RPT 작성됨**: [RPT-260426](./RPT_260426_telemetry-comparison.md). 권고 = Sentry SaaS Team tier ($26).
3. **OWASP ASVS L2 감사 방식** — 외주 vs 자체. 외주 시 ETA 4-6주.
4. **Phase D 4-week 슬립 검토** — GA 일자 (2026-08-29) 유지 vs 4주 후 (2026-09-26)로 조정.

---

## 7. 변경 이력

| 일자 | 내용 |
|---|---|
| 2026-04-25 | 초안 작성. Phase C 3일 작업 종합 + Phase D 백로그 + 결정 요청 4건 정리. |
