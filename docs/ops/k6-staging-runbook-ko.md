# k6 staging 부하 측정 runbook

> **Status**: 양식 · 미실행. 실측 트리거 조건은 staging 환경 (pm2 cluster +
> managed PG/Redis + ALB/CloudFront) 가용 직후. Phase D 첫 작업 = T-081 본
> 측정.
>
> Owner: Gray Kim · Draft: 2026-04-26

---

## 1. 측정 목적

1. **GA 시점 트래픽 패턴 검증** — 50k concurrent에서 SLA 위반 endpoint 식별
2. **ADR-021 Lever 5 트리거 판단** — `/leaderboard` 가 여전히 병목인지 확인 →
   [design sketch](./design-leaderboard-full-cache-ko.md) 구현 착수 결정
3. **Phase D 인프라 튜닝 시작점 확보** — pm2 cluster size · Postgres pool · Redis
   maxmemory · ALB target group health-check 임계 결정
4. **CI gate 임계값 보정** — `mixed-read.js` 의 p(95) threshold를 staging 측정값
   기준 ±20%로 보정

---

## 2. 사전 준비 (staging 환경)

### 2.1 인프라 구성 요건

| 컴포넌트 | 권장 값 | 이유 |
|---|---|---|
| Backend host | EC2 c6i.xlarge × 2 (또는 ECS Fargate 4 vCPU) | pm2 cluster 4 worker 기준 |
| pm2 cluster | `pm2 start dist/main.js -i max` | dev mode (single Node) 9k RPS 상한 → cluster로 4×경유 |
| PG | RDS Postgres 16, db.t4g.medium, 100 IOPS gp3 | 50k user · 10% write = 5k write RPS 흡수 |
| Redis | ElastiCache 7, cache.t4g.small, no AOF | leaderboard ZSET + IdolMetaCache 둘 다 흡수 |
| ALB | HTTP2 ON, idle timeout 60s | k6 50 VU keep-alive 권장 |
| Network | client(k6) ↔ ALB 같은 region · 같은 VPC subnet | 클라이언트 측 latency 노이즈 제거 |

### 2.2 환경 변수

backend 빌드는 prod 모드 (`NODE_ENV=production`). 다음 추가:
```
DATABASE_URL=postgres://...rds.amazonaws.com/aidol?schema=public&connection_limit=20
REDIS_URL=rediss://...elasticache.amazonaws.com:6379
LOG_LEVEL=warn      # info 이상이면 50k 트래픽에서 로그가 병목
BCRYPT_ROUNDS=10    # CI 4와 다름 — 본 측정은 prod 조건 그대로
```

### 2.3 시드 데이터

```bash
pnpm --filter @a-idol/backend prisma:deploy
pnpm --filter @a-idol/backend seed
# Seed 후 ACTIVE round id 확보
ROUND_ID=$(... staging psql ...)
```

대안: prod-shape 시드 별도 작성 (현재 99 idol → staging은 500~1k idol로 확장
권장. 별도 PR 필요 — 이 runbook 범위 밖이지만 Phase D 첫 주에 같이 짜는 게 효율).

---

## 3. 실행 — ramp 단계

같은 staging 환경에서 5단계로 별도 실행. **각 단계 사이 5분 cool-down** (ALB
target group warm 상태 유지하되 RDS/Redis 메트릭이 idle로 복귀할 시간).

| 단계 | k6 옵션 변경 | 목적 | Pass 조건 |
|---|---|---|---|
| **S0** smoke | `smoke.js` 그대로 (10s · 1 VU) | endpoint 200 응답 확인 | http_req_failed=0 |
| **S1** baseline | `mixed-read.js` `target: 100` 그대로 | 현재 베이스라인 재측정 (회귀 감지) | p(95) 임계 위반 0건 |
| **S2** soft load | `target: 500`, duration 5m | DB connection pool 포화 시점 | err < 0.5%, p(99) < 1s |
| **S3** moderate | `target: 1000`, duration 10m | pm2 worker CPU 한계 식별 | err < 1%, p(99) < 1.5s |
| **S4** stress | `target: 5000`, duration 5m | 첫 SLA 위반 endpoint 식별 | err < 2%, p(99) < 2s |
| **S5** GA target | `target: 50000`, duration 3m + ramp 2m | T-081 목표치 달성 가능성 판정 | err < 5% (관찰 단계) |

### 3.1 명령

```bash
# 환경 변수
export BASE_URL="https://staging-api.a-idol.dev/1"
export ROUND_ID="<active round uuid from staging>"

# S0
k6 run packages/backend/test/load/smoke.js

# S1~S5: stage target 만 환경변수로 override
k6 run -e TARGET_VUS=500   -e DURATION=5m  packages/backend/test/load/mixed-read.js
k6 run -e TARGET_VUS=1000  -e DURATION=10m packages/backend/test/load/mixed-read.js
k6 run -e TARGET_VUS=5000  -e DURATION=5m  packages/backend/test/load/mixed-read.js
k6 run -e TARGET_VUS=50000 -e DURATION=3m  packages/backend/test/load/mixed-read.js
```

> **Note**: `mixed-read.js`는 2026-04-26부터 `TARGET_VUS` / `DURATION` /
> `RAMP_UP_DURATION` / `RAMP_DOWN_DURATION` env로 ramp 변수화 완료. 위
> 명령 그대로 동작. 기본값(100/2m/1m/30s)은 기존 3m30s 런타임과 동일.

### 3.2 결과 보존

```bash
mkdir -p packages/backend/test/load/results
k6 run \
  --summary-export=packages/backend/test/load/results/$(date +%Y%m%d-%H%M)-S5-50k.json \
  -e TARGET_VUS=50000 -e DURATION=3m \
  packages/backend/test/load/mixed-read.js
```

results/ 는 `.gitignore` 처리됨. 측정 후 S3 + 단일 PR로 따로 push.

---

## 4. 측정 기록 양식

각 단계 완료 후 다음 표를 [perf-baseline-ko.md](./perf-baseline-ko.md) 또는 별도
`RPT_<date>_k6-staging.md` 에 기록:

```markdown
## k6 staging 본 측정 — <date> · <env id>

### 인프라 스펙
- Backend: <instance type> × <count>, pm2 worker <N>
- PG: <RDS spec>, max_connections <N>
- Redis: <ElastiCache spec>
- 클라이언트(k6): <instance type>, region <X>

### Stage <S0..S5> 결과
| 단계 | VUs | RPS | http_req_failed | p(50) | p(95) | p(99) | error 분포 |
|---|---|---|---|---|---|---|---|
| S1 | 100  | ___ | __ % | __ ms | __ ms | __ ms | __ |
| S2 | 500  | ___ | __ % | __ ms | __ ms | __ ms | __ |
| S3 | 1000 | ___ | __ % | __ ms | __ ms | __ ms | __ |
| S4 | 5000 | ___ | __ % | __ ms | __ ms | __ ms | __ |
| S5 | 50k  | ___ | __ % | __ ms | __ ms | __ ms | __ |

### 엔드포인트별 p(95) (S5 시점)
| Endpoint | p(95) | hit-or-miss(304) |
|---|---|---|
| /idols       | __ ms | __ % hit |
| /leaderboard | __ ms | __ % hit |
| /products    | __ ms | __ % hit |
| /me/hearts   | __ ms | __ % hit |
| vote_heart   | __ ms | n/a (write) |

### 관찰
- (병목 endpoint)
- (이벤트 루프 포화 시점)
- (DB connection wait 발생)
- (Redis evictions)

### Lever 5 트리거 판단
- [ ] /leaderboard p(95) > 500ms at S5 → 구현 착수
- [ ] /leaderboard p(95) ≤ 500ms at S5 → Lever 5 보류, 다른 핫스팟 우선

### 다음 액션
- ...
```

---

## 5. 모니터링 대시보드 (측정 중 동시 관찰)

k6 stdout만 보면 클라이언트 측 지표만 잡힘. server-side 병목 식별을 위해 다음을
나란히 띄울 것:

- **CloudWatch / Datadog Backend**: CPU, Event Loop Lag, GC pause, HTTP 5xx
- **CloudWatch RDS**: Connection count, ReadIOPS, WriteIOPS, CPUUtilization, BufferCacheHitRatio
- **CloudWatch ElastiCache**: CurrConnections, EngineCPUUtilization, Evictions, CacheMisses
- **ALB**: HTTPCode_Target_5XX_Count, TargetResponseTime, RejectedConnectionCount
- **k6 own metrics**: `http_req_duration{name:idols_list}` per-endpoint p(95) — `mixed-read.js` 가 이미 tag함

각 단계 시작/종료 시각을 기록하면 RDS/Redis 메트릭과 k6 트래픽 곡선 정렬해 분석.

---

## 6. 실패 모드 + 복구

| 증상 | 원인 후보 | 즉시 조치 | 측정 영향 |
|---|---|---|---|
| http_req_failed > 5% on S2 | DB connection pool 부족 | `connection_limit=50`으로 올려서 재실행 | S2 결과 폐기 |
| event loop lag > 1s | pm2 worker 부족 | `pm2 scale aidol-backend +N` | 단계 끝나면 재실행 |
| Redis evictions > 0 | maxmemory 미설정 | `CONFIG SET maxmemory 1gb maxmemory-policy allkeys-lru` | 결과 보존 — IdolMetaCache 동작 가설 검증됨 |
| ALB 502/504 | backend hard crash | logs 확인 + 복구 후 단계 재실행 | 결과 폐기 |
| /leaderboard 만 p(95) > 500ms (다른 endpoint OK) | leaderboard hydrate 병목 → **Lever 5 트리거 발견** | 측정 계속, 결과 RPT에 기록 | 측정 결과 = 의사결정 근거 |
| 측정 중 staging 환경 의존 외부 시스템 (Apple Sandbox 등) latency spike | 외부 의존 — 본 측정 대상 아님 | `K6_NO_SIGNUP=1` 또는 write 시나리오 비활성화 | partial 결과만 활용 |

---

## 7. ADR-021 Lever 5 트리거 정의

다음 둘 중 하나 충족 시 [design-leaderboard-full-cache-ko.md](./design-leaderboard-full-cache-ko.md)
구현 착수:

- **A. p(95) latency**: S5 (50k VU) 측정에서 `/leaderboard` p(95) > 500 ms
- **B. RPS 비율**: S5에서 다른 read endpoints (`/idols`, `/products`) 대비
  `/leaderboard` 평균 latency가 2배 이상

둘 다 미달이면 Lever 5 보류. 다음 핫스팟 (예: `/idols/:id`, vote write) 으로
우선순위 이동.

---

## 8. 측정 후 작업

1. **결과 RPT 작성** — `docs/report/RPT_<YYYYMMDD>_k6-staging.md` (양식 §4)
2. **perf-baseline-ko.md 변경이력** — 한 줄 추가 (날짜·요지·RPT 링크)
3. **Lever 5 결정** — 트리거 충족 시 구현 PR (1일 작업, design sketch 그대로)
4. **`mixed-read.js` threshold 보정** — staging 측정값 기준 ±20%로 갱신
5. **ADR-021 Phase D 백로그 업데이트** — Lever 5 항목 strikethrough 또는 보류 명시
6. **`make phase-c-status`** 재실행 → ADR-021 backlog 카운트 갱신 확인

---

## 9. 비용 추정

운영 한도 사전 승인 받아두면 회의 의사결정 빨라짐.

| 항목 | 일 비용 (가정) | 측정 1 사이클 (1일) | 월 운영 (24/7) |
|---|---|---|---|
| EC2 c6i.xlarge × 2 | $4 | $4 | $122 |
| RDS db.t4g.medium | $1.6 | $1.6 | $48 |
| ElastiCache cache.t4g.small | $0.6 | $0.6 | $19 |
| ALB | $0.55 | $0.55 | $17 |
| 데이터 전송 (50k×3min) | ~5 GB | $0.5 | (사용량 비례) |
| **합계** | — | **~$8/회** | **~$206/월** |

> 측정만 하면 1회 ~$8. 24/7 staging 유지가 cost driver. 회의 결정 3에서 PO 사전
> 승인 필요.

---

## 10. 참고

- [perf-baseline-ko.md](./perf-baseline-ko.md) — 로컬 베이스라인 (이번 staging
  실측 비교 기준점)
- [design-leaderboard-full-cache-ko.md](./design-leaderboard-full-cache-ko.md) —
  Lever 5 설계
- [packages/backend/test/load/README.md](../../packages/backend/test/load/README.md)
  — k6 스크립트 사용법
- [ADR-021](../adr/ADR-021-phase-c-perf-levers.md) — Phase C 성능 레버 (Lever
  5 트리거 출처)
- [RPT-260425 mid-progress](../report/RPT_260425_phase-c-mid-progress.md) — Phase
  D 진입 우선순위 (이 측정이 #1)

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-26 | 초안. staging 환경 미확보 상태이므로 양식만 — 실측 트리거는 인프라 가용 직후. |
