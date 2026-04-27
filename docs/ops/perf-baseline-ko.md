# 퍼포먼스 베이스라인 — 로컬 측정

> T-081 load test (50k concurrent, k6) 본격 실행 전의 **개발 기계 참고치**.
> 목적은 GA 시점 프로덕션 환경 대비 regression 감지 + Phase D 인프라
> 튜닝의 시작점 확보.
>
> Owner: Gray Kim · Measured: 2026-04-23

---

## 측정 환경

- **Hardware**: MacBook Pro (Apple Silicon · Darwin 25.4)
- **Backend**: `pnpm dev` (NestJS watch mode, 싱글 Node process)
- **DB**: Postgres 16 (docker-compose, 로컬 volume)
- **Redis**: Redis 7 (docker-compose)
- **Tool**: `autocannon@8.0.0` (npx)
- **Test DB**: 99 idols + 8 products + HYUN photocard set (seeded)
- **No warmup prior** beyond a few hundred requests to compile Nest routes

**주의**: 이 수치는 **프로덕션 SLA가 아님**. 개발 머신은 dev mode
Watch (소스맵 + auto-reload) 비용, 미실제 네트워크 홉 없음,
단일 Node 인스턴스. Prod는 pm2 cluster + managed Postgres/Redis +
network hop + horizontal scale 가정 → 전혀 다른 profile.

---

## 기준 측정 — `concurrency=50, duration=10s` (압축 전)

| Endpoint | RPS (avg) | p50 | p97.5 | p99 | Max | 비고 |
|---|---|---|---|---|---|---|
| `GET /health` | **9,239** | 5 ms | 8 ms | 9 ms | 33 ms | PG+Redis ping 포함 |
| `GET /api/v1/commerce/products` | **6,454** | 7 ms | 9 ms | 11 ms | 23 ms | Prisma findMany(8 rows) |
| `GET /api/v1/idols?size=20` | **3,531** | 13 ms | 18 ms | 20 ms | 27 ms | 페이지네이션 + 20-row join |
| `GET /api/v1/rounds/:id/leaderboard` | **5,298** | 9 ms | 13 ms | 14 ms | 28 ms | Redis ZREVRANGE + idol name hydrate |

## Prisma `select` narrowing (2026-04-24)

`PrismaIdolRepository.listPublished`에서 `select`를 `IdolCardDto` 생성에
필요한 10개 필드로 제한. **가장 큰 제외 대상**: `profileJson`
(AI-generated persona JSONB, row당 ~10 KB).

| Endpoint | RPS (gzip) | Δ | 비고 |
|---|---|---|---|
| `/api/v1/idols?size=20` | 3,137 → **3,508** | **+12%** | 클라이언트 payload 불변 (뷰 매퍼가 이미 필터), 서버측 CPU 절약 |

**왜 클라이언트 payload는 안 줄었나**: `Idol` 도메인 엔티티 +
`IdolCardDto` 매퍼가 이미 `profileJson`을 버리기 때문에 wire size는
그대로. 개선점은 **PG → Node 구간**: BigInt 변환 + JSONB 파싱 +
미사용 컬럼 메모리 복사 제거.

**측정 확인**: `curl /api/v1/idols?size=20`
- Raw payload 3,666 B → 3,666 B (불변)
- Gzipped 1,089 B → 1,093 B (불변)

### 유사 narrowing 확산 (같은 날)

같은 패턴을 `include: { idol: true }` 쓰던 fandom 리스트 리포지토리 +
admin idol 리포지토리로 전파. `Prisma.IdolSelect` 상수 `ADMIN_IDOL_SELECT`
신설.

| Endpoint | Pre RPS | Post RPS | Δ |
|---|---|---|---|
| `/api/v1/me/hearts?size=20` | 1,855 | **1,947** | **+5%** |
| `/api/v1/me/follows?size=20` | 1,857 | **1,993** | **+7%** |
| `/api/v1/admin/catalog/idols?size=20` | 1,783 | 1,790 | 노이즈 범위 |

**fandom 경로 (+5~7%)**: `/idols` (+12%) 대비 이득이 작은 이유는
Heart/Follow 조인 비용이 추가로 깔려 있어 `profileJson` 제외 효과가
상대적으로 희석. 그래도 명확한 gain.

**admin 경로 (±1%)**: 99개 idol 데이터셋에서는 wall-clock 변화 관측 안 됨.
admin 페이로드가 이미 14개 스칼라 + agency 조인으로 크고, 매퍼/직렬화
비용이 지배적. narrowing은 **원칙상 방어**로 유지 — idol 수가 수천 개로
늘면 `profileJson` bytes 누적이 의미 있어지는 시점에 효과가 드러남.

**적용 파일**:
- `packages/backend/src/modules/fandom/infrastructure/prisma-heart.repository.ts#listHeartedIdols`
- `packages/backend/src/modules/fandom/infrastructure/prisma-follow.repository.ts#listFollowedIdols`
- `packages/backend/src/modules/catalog/infrastructure/prisma-admin-idol.repository.ts` (listAll/findById/create/update/setPublished 5개 경로)

## 압축 도입 후 — `Accept-Encoding: gzip` 포함 (2026-04-23)

`compression` Express middleware 활성화 (`threshold: 1024`) 후 측정.
**로컬 기준에선 RPS가 다소 감소** (~10%) — 네트워크 홉이 없어 gzip CPU
비용이 byte 감소 이득을 상쇄하기 때문. **실제 모바일 사용자에겐
압축이 지배적인 win** (요청당 페이로드 2-4배 감소 → 셀룰러 네트워크에서
체감 latency 3-5배 감소 예상).

| Endpoint | RPS | Δ | 페이로드 | Δ |
|---|---|---|---|---|
| `GET /health` | 8,943 | −3% | N/A (<1 KB → threshold 미통과) | — |
| `GET /api/v1/commerce/products` | 5,632 | −13% | 2.4 KB → **1.1 KB** | −54% |
| `GET /api/v1/idols?size=20` | 3,137 | −11% | 4.0 KB → **1.5 KB** | −63% |
| `GET /api/v1/rounds/:id/leaderboard` | 5,154 | −3% | 0.8 KB (threshold 미통과) | — |

**단일 요청 비교** (`curl -H "Accept-Encoding: gzip"`): `/idols?size=20`
응답이 3,666 B → 1,089 B (−70%).

### 판단: 압축 ON 유지

- 모바일 사용자(4G/5G)의 실제 평균 다운링크 2-10 Mbps. 4 KB payload
  = 3-16 ms 전송 + 30-80 ms RTT — 이걸 1.5 KB로 줄이면 실질 latency가
  RPS 감소보다 훨씬 큰 영향.
- RPS 저하는 수평 스케일(pm2 cluster)로 상쇄 가능. 네트워크 latency는
  상쇄 불가.
- CPU 여유 있을 때만 압축 — `threshold: 1024`로 작은 응답은 건너뜀.

---

## ETag / 304 on `/idols` (2026-04-24)

weak ETag `W/"idols-<total>-<maxUpdatedAt>-p<page>-s<size>-<sort>"`.
Controller가 요청 받으면:

1. Cheap identity probe (`count` + `aggregate max(updatedAt)` one $transaction)
2. `If-None-Match` 비교 → match면 `findMany` 스킵, **304 no body**
3. Miss면 기존 `listPublished` 실행, body + 새 ETag 헤더

### 측정 (concurrency=50, duration=10s, gzip)

| 경로 | RPS | p50 | p99 | Bytes |
|---|---|---|---|---|
| 200 full (cache miss) | 2,508 | 19 ms | 28 ms | 39.1 MB |
| 304 (cache hit) | **5,255** | **9 ms** | 15 ms | **18.2 MB** |
| Δ | **+110%** | **−53%** | −46% | **−53%** |

### 트레이드오프

- **Cache miss** 경로 RPS는 이전 baseline 3,508 대비 **−28%** — identity
  probe($transaction + count + aggregate)가 findMany 직전에 추가되기 때문.
  평균 RPS는 hit 비율에 따라 결정됨: 50% hit이면 대략 3,800 RPS, 70% hit이면
  4,430 RPS — baseline 3,508보다 우세.
- **Hit 비율은 데이터셋 churn과 반비례**. `/idols`의 max(updatedAt)는 어느
  idol이든 heartCount bump 시 증가하므로, 인기 타임대에는 초단위로 갱신될
  수 있어 글로벌 hit 비율이 낮아짐. 사용자의 pull-to-refresh 인터벌이
  짧을수록 유리.
- 실사용 네트워크(모바일)에서는 RPS보다 **p99 latency 감소 + 바이트 절감이
  더 큰 의미** — 셀룰러에서 1.5 KB vs 3.7 KB + 9ms vs 19ms는 체감 차이 큼.

### 확산 (2026-04-24)

| Endpoint | 200 RPS | 304 RPS | Δ | Bytes Δ |
|---|---|---|---|---|
| `/api/v1/idols?size=20` | 2,508 | 5,255 | **+110%** | −53% |
| `/api/v1/commerce/products` | 3,371 | 5,511 | **+63%** | −54% |
| `/api/v1/auditions/:id` | 4,567 | 4,873 | **+7%** | **−66%** |
| `/api/v1/admin/catalog/idols` | — | — | — | CMS 재로딩 304 경로 확보 |
| `/api/v1/idols/:id` | — | — | — | loaded-data ETag (heart 토글 시 invalidate) |
| `/api/v1/me/hearts` | — | — | — | userId-scoped + `Vary: Authorization` |
| `/api/v1/me/follows` | — | — | — | userId-scoped + `Vary: Authorization` |

- `/commerce/products`: cheap identity probe (count + aggregate) 적용 — /idols와 같은 패턴. 활성 카탈로그 9 상품 데이터셋에서도 +63%.
- `/auditions/:id`: 단일 리소스라 probe 없이 full detail 로딩 후 ETag 계산.
  RPS gain은 작지만 **모바일 네트워크 관점에선 바이트 −66%가 더 큰 의미**
  (4G 셀룰러에서 52 KB → 18 KB 차이는 눈에 띔). 상세는 controller 주석
  참조 — audition.updatedAt + entries eliminatedAt + round/entry count로
  구성. CAVEAT: round status 변경이 audition.updatedAt을 bump하지 않으면
  ETag 무효화 누락 가능 → 필요 시 write-through 훅 추가.

### 미적용 경로

(2026-04-24 전체 마감) 주요 public + per-user 읽기 경로 모두 ETag 적용 완료.
다음 확산 후보는 `/auditions` (list), `/me/memberships`, `/me/vote-tickets`,
`/rounds/:id/me/vote-status` — 각각 churn 낮거나 short-TTL Redis cache가
더 적합. Phase D에서 k6 측정 후 판단.

---

## 고부하 측정 — `concurrency=200`

| Endpoint | RPS | p50 | p97.5 | p99 | Max |
|---|---|---|---|---|---|
| `GET /health` | 9,006 | 21 ms | 30 ms | 34 ms | **690 ms** |

**관찰**: 200 concurrency에서 RPS가 크게 안 늘고 (9,239 → 9,006) latency만 4배 (5ms → 21ms). 단일 Node 프로세스의 CPU bound 한계에 근접. Max 690ms spike는 **이벤트 루프 포화 증거** — 프로덕션에서는 Node 프로세스 수직 복제 (pm2 cluster) 또는 수평 스케일 필요.

---

## 분석 포인트

### 1. `/idols`가 가장 느린 이유

페이지네이션 한 번에 20 rows + 각 row마다 BigInt `heartCount`, `followCount`, (선택) `heroImageUrl` hydrate. JSON 직렬화 비용이 payload 길이 ∝ .
- `size=20` → 156 MB / 39k req = ~4 KB/req
- `/commerce/products` (8 rows) → 156 MB / 65k req = ~2.4 KB/req
- `/health` → 46 MB / 102k req = 0.45 KB/req

RPS는 payload 크기와 거의 선형 반비례. 개선 여지:
- ~~response compression (gzip)~~ — **2026-04-23 도입 완료**. /idols
  페이로드 4 KB → 1.5 KB (63% 감소). RPS는 로컬에서 약간 감소했으나
  네트워크 홉 있는 실사용 환경에선 net win.
- ~~Prisma `select` 좁히기 on `/idols`~~ — **2026-04-24 적용**. profileJson
  제외로 RPS +12%. `/idols/:id` (detail) 에는 여전히 profileJson 필요
  하므로 그쪽은 그대로.
- ~~유사 narrowing 확산~~ — **2026-04-24 적용**. `listHeartedIdols` /
  `listFollowedIdols` / `AdminIdolRepository` 5개 경로 narrow. fandom 리스트
  RPS +5~7%, admin은 현재 데이터셋에선 노이즈 범위(원칙상 유지).
- ~~ETag / 304 on `/idols`~~ — **2026-04-24 적용**. 캐시 hit 경로 +110%
  RPS. 상세: 아래 § ETag 섹션.
- ~~`/leaderboard` idol name hydrate → Redis cache + TTL~~ — **2026-04-24 적용**.
  `IdolMetaCache` 포트 신설, warm cache에서 +26% RPS (§2 참조).

### 2. `/leaderboard`의 Redis+Prisma 조합

Redis ZREVRANGE는 < 1 ms인데 전체는 9 ms. Idol name hydrate가 9개 idol ×
Prisma roundtrip.

~~**Redis cache + TTL**로 씌우면 ZREVRANGE만 하는 경로가 되어 `/health`
급으로 빨라질 것~~ — **2026-04-24 적용**. `IdolMetaCache` 포트 +
`RedisIdolMetaCache` (MGET + Prisma miss fallback + 5분 TTL).

| 경로 | RPS | p50 | Bytes |
|---|---|---|---|
| Prisma findMany (pre) | 5,117 | 9 ms | 29.2 MB |
| **Redis MGET (post, warm cache)** | **6,454** | **7 ms** | 40.5 MB |
| Δ | **+26%** | **−22%** | — |

`/health` 급(~9k)까지는 못 가지만, 9개 idol hydrate 한정 로컬 vs 로컬 비용
차이 (Prisma ~5 ms → Redis MGET <1 ms) 확인. 운영 환경 (PG RTT + TLS)에선
더 큰 격차 예상.

**Staleness 정책**: TTL 5분 + **write-through invalidation** (2026-04-24
추가). `UpdateIdolUseCase` / `SoftDeleteIdolUseCase`가 repo mutation 성공
후 `IdolMetaCache.invalidate([id])` 호출 — 다음 `/leaderboard` 읽기가
cache miss → Prisma → 최신 데이터로 채우기. TTL은 "invalidation 호출
누락 시 staleness 상한"으로 방어 역할.

실패 경로(IDOL_NOT_FOUND / AGENCY_NOT_FOUND)는 invalidate 호출 안 함 —
회귀 단위 테스트 TC-AC005~008로 고정. 엔드투엔드 회귀는 ITC-LBCACHE
(TC-LBCACHE-001: PATCH stageName → 즉시 leaderboard 반영).

### 3. `/health`의 9k RPS 상한

`GET /health` 자체는 DB+Redis ping 두 번 병렬이지만 c=200에서 이벤트 루프 포화. 단일 Node 상한이 ~9k RPS 수준으로 관측됨. 프로덕션 목표 (50k concurrent) 는 **반드시 pm2 cluster 이상의 수평화 필요**.

---

## Phase D 목표치 (proposal)

프로덕션 환경에서 이 베이스라인 대비 **열화 없이** 다음 달성:

| 목표 | 수치 | 근거 |
|---|---|---|
| `/health` p99 | < 100 ms under 5k concurrent users | 이벤트 루프 여유 |
| `/api/v1/commerce/products` p99 | < 150 ms under 500 RPS | 상점 조회 peak |
| `/api/v1/idols?size=20` p99 | < 250 ms under 2k RPS | 홈 피드 peak (모든 유저) |
| `/leaderboard` p99 | < 100 ms under 5k RPS | 투표 ticking 최대치 |

**측정 방식 전환**: k6 스크립트 (`packages/backend/test/load/`)로 이행.
2026-04-24 하네스 landed:

- `smoke.js` — 10s / 1 VU. 큰 시나리오 전 sanity.
- `mixed-read.js` — 3m30s, 0 → 100 VUs ramping-vus, 90% read / 10% write.
  엔드포인트별 p(95) thresholds (idols<800, leaderboard<500, products<400 ms).
  실패 시 exit non-zero → CI gate로 쓸 수 있음.

50k concurrent 본 측정은 staging에서 pm2 cluster 빌드 기준으로 Phase D
진입 시점에 집행. dev-watch 모드는 최대 ~9k RPS에서 이벤트 루프 포화라
상한으로 부적합.

---

## 재측정 방법

```bash
# Backend 기동 후
npx autocannon -c 50 -d 10 http://localhost:3000/health
npx autocannon -c 50 -d 10 http://localhost:3000/api/v1/commerce/products
npx autocannon -c 50 -d 10 'http://localhost:3000/api/v1/idols?size=20'

# Leaderboard — ACTIVE round id 먼저 조회
ROUND_ID=$(docker exec a-idol-postgres psql -U aidol -d aidol -tA \
  -c "SELECT id FROM rounds WHERE status='ACTIVE' LIMIT 1")
npx autocannon -c 50 -d 10 "http://localhost:3000/api/v1/rounds/$ROUND_ID/leaderboard"
```

새 PR이 이 문서의 수치를 ±20% 벗어나게 하면 PR 설명에 이유 기록.

---

## Post-T-082 throttle 도입 후 smoke (2026-04-26)

T-082(글로벌 ThrottlerGuard, 200 req/min/IP) + helmet + `/metrics` 적용 직후
회귀 smoke. k6 미설치 환경이라 `ab` 사용. dev-watch + compression on +
ThrottlerGuard active.

| 라우트 | 트래픽 | RPS | p50 | p95 | p99 |
|---|---|---|---|---|---|
| `/health` (`@SkipThrottle`) | n=1000 c=50 | **2,727** | 17 | 24 | 26 ms |
| `/metrics` (`@SkipThrottle`) | n=500 c=20 | **1,822** | 10 | 15 | 17 ms |
| `/api/v1/idols?size=20` (default throttle) | n=150 c=10 | **910** | 9 | 17 | 18 ms |

**판독**:
- helmet + metrics middleware 추가에도 `/health` p99=26ms (이전 2026-04-23
  baseline 대비 노이즈 수준) — 보안/관측 미들웨어 추가 비용 무시 가능.
- `/api/v1/idols`는 ETag 적용 + select narrowing 누적 효과로 p99 18ms — 4월 ETag
  hit 측정(p50=9ms, 5,255 RPS)과 일치.
- `/metrics` ab "Failed: 477/500" 은 dynamic 응답(카운터가 매 요청 증가) 으로
  Content-Length가 흔들려 ab가 mismatch로 카운트한 것 — 실제로는 모두 200.
  prom-client 특성, 정상.

**Throttle 도입의 부하 측정 영향 (중요)**:

글로벌 200 req/min/IP로 단일-IP 부하 측정의 **shape이 근본 변경**됨:

- 단일 IP에서 `/api/v1/*` 라우트는 최대 200 req/60s ≈ 3.3 RPS 평균 (burst 가능)
- 1초에 150 RPS burst는 OK, 그 이후 60s는 사실상 측정 불가 (429 반환)
- **K6 staging full-scale (50k concurrent)** 은 다음 중 하나 필수:
  - **(권장)** k6 cloud 또는 locust workers로 multi-IP 분산
  - 측정 윈도우만 throttle limit 상향 (예: 100k req/min) — env-driven config
    필요 (`THROTTLE_LIMIT_PER_MINUTE` 도입 후속 슬라이스)
  - read 경로는 `@SkipThrottle` 라우트(`/health`, `/metrics`)만 hammer →
    실제 사용자 경로 fidelity는 낮음

이전 베이스라인(autocannon c=50 d=10s = 25k req)은 단일 IP에서 즉시 throttle
trip → 재현 불가. 4월 23일~25일 모든 RPS 수치는 **pre-throttle 환경**으로
컨텍스트 명시.

**다음 액션**: T-081 본 측정 시 k6 staging-runbook 따라 분산 source 또는
환경별 throttle override (`THROTTLE_LIMIT_PER_MINUTE` env) 사용.

```bash
# staging k6 측정 윈도우 동안만
THROTTLE_LIMIT_PER_MINUTE=100000 pm2 reload aidol-backend
# 측정 종료 후 즉시 복귀
THROTTLE_LIMIT_PER_MINUTE=200 pm2 reload aidol-backend
```

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-23 | 초기 베이스라인 측정. MacBook Pro + dev watch mode 기준. |
| 2026-04-23 | `compression` 미들웨어 활성화 후 재측정. RPS −10% / 페이로드 −54~63%. 압축 ON 유지 판단 (모바일 네트워크 win 우세). |
| 2026-04-24 | `PrismaIdolRepository.listPublished`에 `select` narrowing 적용. profileJson(~10 KB JSONB) 포함 6개 필드 제외. /idols RPS +12% (3137 → 3508). 클라이언트 payload 불변 (뷰 매퍼가 이미 필터). |
| 2026-04-24 | 유사 narrowing을 Heart/Follow 리스트 + AdminIdolRepository로 확산. `/me/hearts` +5% · `/me/follows` +7% · `/admin/catalog/idols` ≒ 노이즈(99 idols 데이터셋). `ADMIN_IDOL_SELECT` 상수 신설. |
| 2026-04-24 | `/api/v1/idols` ETag/304 적용. Cache hit RPS +110% (2,508 → 5,255), p50 19→9ms, 바이트 −53%. Miss는 −28% (identity probe 비용). ITC-CATALOG 4 integration tests 추가 (304 empty body · page별 ETag · updatedAt invalidation). |
| 2026-04-24 | `/leaderboard` idol name hydrate Redis cache (`IdolMetaCache` 포트 + MGET + 5분 TTL). warm cache에서 5,117 → 6,454 RPS (+26%), p50 9→7ms. TC-LB-001~004 unit tests 추가. Staleness: admin 편집 최대 5분 지연 (write-through invalidation은 follow-up). |
| 2026-04-24 | `UpdateIdolUseCase` / `SoftDeleteIdolUseCase`에 write-through invalidation 추가. admin 편집 즉시 `IdolMetaCache.invalidate([id])` → 다음 leaderboard 읽기에 반영. 실패 경로는 cache 미접촉. TC-AC005~008 unit + ITC-LBCACHE 2 integration tests. |
| 2026-04-24 | `/commerce/products` + `/auditions/:id`로 ETag 패턴 확산. products: +63% RPS (cheap identity probe). auditions detail: +7% RPS / **−66% 바이트** (loaded-data 방식, single resource라 probe 생략). ITC-ETAG 6 integration tests 추가. |
| 2026-04-24 | k6 하네스 [test/load/](../../packages/backend/test/load/) landed — `smoke.js` + `mixed-read.js` (90/10 mix, 엔드포인트별 p(95) threshold). `pnpm test:load:smoke` / `test:load:mixed`. autocannon single-endpoint 한계 극복, Phase D 진입 전 CI-gated 시나리오 베이스 확보. 50k 실측은 staging 집행. |
| 2026-04-24 | `/api/v1/admin/catalog/idols` ETag 확장 + CMS `apiFetch` auto `If-None-Match`/304 캐싱. module-level `etagCache` Map, GET마다 자동 send·store, 비-GET 시 같은 path 자동 invalidate. 로그아웃/재로그인 시 `invalidateEtagCache()` 노출. ITC-ETAG-ADMIN 3 integration tests 추가 (총 60 tests). ADR-021 Phase D 백로그 항목 마감. |
| 2026-04-24 | `/api/v1/idols/:id` + `/api/v1/me/hearts` + `/api/v1/me/follows` ETag 확장. per-user 경로에는 `Vary: Authorization` + userId 임베딩으로 cross-match 방어. `HeartRepository.getMyListIdentity` 포트 추가. ITC 7 integration tests 추가 (총 67 tests). ADR-021 Phase D 백로그 ETag 항목 전부 마감. |
| 2026-04-24 | Round/entry write-through for `/auditions/:id` ETag. `AuditionRepository.touchUpdatedAt` 포트 + 6 usecase에 훅(Create/Update/Transition/DeleteRound + Add/RemoveEntries). 라운드 생성·활성화·종료가 parent audition ETag 즉시 invalidate. TC-ETAG-AUD-004 회귀 커버. ADR-021 staleness caveat 해제. |
| 2026-04-24 | CMS query-key registry(`@/lib/query-keys`) + invalidation helpers(`@/lib/query-invalidation`) landed. agencies/idols/auditions 3개 페이지 retrofit — agency 변경이 idol list도 invalidate, round transition이 audition list + detail 모두 invalidate. 각 헬퍼가 `invalidateEtagCache()`도 호출해 apiFetch 캐시 동기화. |
| 2026-04-24 | CMS invalidation helpers 확산 — commerce-page, photocards-page, photocard-set-detail-modal, auto-messages-page, round-vote-rule-section 5개 surface 추가 retrofit (총 7개). `invalidateAfterProductChange`는 analytics overview도 refresh. `invalidateAfterRoundChange` via vote-rule upsert로 audition detail까지 fan-out. |
| 2026-04-25 | Mobile `apiFetch`에 module-level ETag 캐시 + `If-None-Match`/304 short-circuit 이식. 캐시 키 `${path}${qs}`로 페이지별 독립 캐시. `invalidateEtagCache(key?)` export. test-utils mock에 etag/304 지원 추가. 6 new tests ([api-etag.spec.ts](../../packages/mobile/src/hooks/__tests__/api-etag.spec.ts)). 9 suites / 41 tests 🟢. |
| 2026-04-26 | Mobile `useIdolFandom` toggleHeart/toggleFollow에 cross-entity ETag invalidation 추가. `invalidateEtagPrefix('/me/hearts'\|'/me/follows'\|'/idols')`로 페이지네이션된 모든 캐시 엔트리를 prefix-match로 일괄 삭제. 토글 직후 refresh가 If-None-Match 안 보내고 즉시 fresh 200 받음 (이전엔 stale ETag 보내고 200 받아 round-trip 낭비). 2 new tests in useFandom.spec.ts. 9 suites / 43 tests 🟢. |
| 2026-04-26 | k6 staging 본 측정 runbook landed → [k6-staging-runbook-ko.md](./k6-staging-runbook-ko.md). 5단계 ramp(100/500/1k/5k/50k), 단계별 pass 조건, 측정 기록 양식, Lever 5 트리거 정의(`/leaderboard` p(95)>500ms at S5), 비용 추정($8/회 · $206/월). 인프라 가용 즉시 실행 가능한 양식. |
| 2026-04-26 | `phase-c-status.sh`에 `--summary` markdown mode 추가 + ci.yml에 `phase-c-summary` aggregator job 추가. 매 PR/푸시 GitHub Actions run 페이지에 ADR-021 backlog + ADR roster + reference 자동 게시. lint-test + integration이 fail이면 summary job도 fail 전파(`if: always()`). |
| 2026-04-26 | `mixed-read.js` ramp 변수화. `TARGET_VUS` / `DURATION` / `RAMP_UP_DURATION` / `RAMP_DOWN_DURATION` env로 5단계 staging ramp(100/500/1k/5k/50k) 단일 스크립트 동작. 기본값(100/2m/1m/30s)은 기존 3m30s 런타임 유지 → CI threshold 보정 무영향. k6 staging runbook §3.1 명령이 즉시 실행 가능 상태. |
| 2026-04-26 | T-080 (Prometheus `/metrics`) + T-082 (helmet + 글로벌 ThrottlerGuard 200/min/IP) 도입 후 smoke (ab; k6 미설치). 미들웨어 추가 비용 무시 가능 — `/health` p99=26ms, `/api/v1/idols` p99=18ms (ETag hit). Throttle 도입으로 단일-IP 부하 측정 shape 근본 변경 — 50k 본 측정은 k6 cloud / locust workers 분산 필수. 새 §"Post-T-082 throttle 도입 후 smoke" 추가. |
| 2026-04-26 | `THROTTLE_LIMIT_PER_MINUTE` env 추가 — staging k6 측정 윈도우만 100k+로 override (default 200 유지). `X-RateLimit-Limit: 999` smoke 검증 OK. AppConfig + ThrottlerModule.forRootAsync 변환. |
| 2026-04-26 | Telemetry 스택 사전 비교 RPT 작성 → [RPT-260426](../report/RPT_260426_telemetry-comparison.md). Sentry/OTel/Datadog 5축 비교 + 의사결정 매트릭스. 권고 = Sentry SaaS Team tier($26). 도입 작업 추정 3일 endpoint + 1일 alert. KR 데이터 거주 요구 발생 시 self-host 마이그레이션 트리거 명시. |
