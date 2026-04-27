# Staging 인프라 + 외부 sink 통합 체크리스트 (T-080/T-081)

> GA Target: **2026-08-01**. staging 인프라는 **2026-07-08까지** 셋업 권장
> (k6 50k 본 측정 + 1차 store 제출 회귀 위해).
>
> 다루는 범위:
>  - **T-080 잔여**: Sentry SaaS 5xx capture 통합
>  - **T-081 잔여**: k6 staging 50k 본 측정 (분산 source / 환경별 throttle override)
>  - 외부 의존성 / 비용 추정 / 권장 SLA
>
> Owner: Gray Kim · Last updated: 2026-04-27

---

## 0. Why staging?

GA 후 prod 사고를 막으려면 **prod 와 동등한 환경**에서 다음을 실측:

1. **부하 한계** — k6 50k 동시 사용자 시 latency / error rate / Redis throughput
2. **메모리/리소스 leak** — 1주일 burn-in test (Sentry/Datadog metrics)
3. **외부 통합** — Apple/Play sandbox IAP, OAuth (Kakao/Apple/Google), email
4. **Postgres 쿼리 plan** — prod 데이터 규모 시뮬레이션 (수만 idol, 수백만 user)

---

## 1. 인프라 토폴로지 (권장)

GA MVP 규모 — **single-AZ 시작, multi-AZ 는 ARR 1억 도달 후 cutover**:

```
[CloudFront / CDN]
       ↓
[ALB (HTTPS only)]
       ↓
[ECS Fargate × 2 task]   ← Auto-scale 2~10 (CPU 60%)
       ↓
   [RDS Postgres 16] (db.t4g.medium, GP3 100GB)
   [ElastiCache Redis 7] (cache.t4g.small, primary only)
   [S3] (이미지 자산, lifecycle 90d → IA)
   [SES] (transactional email — support / 환불 알림)
```

대안 (운영 단순):
- **Render.com** Web Service + Render Postgres + Render Redis — 60% 비용 차감, vendor lock-in 있음
- **Fly.io** — 글로벌 edge + Postgres replica 쉬움, Redis 외부 (Upstash) 필요

권장: ECS + RDS + ElastiCache (확장성 + AWS 생태계 호환성)

---

## 2. T-080 후속 — Sentry SaaS 통합

### 2.1 가입 + 프로젝트 생성

| 단계 | 비용 | 비고 |
|---|---|---|
| Developer plan (free) | $0/월 | 5,000 errors/month, 1 team member, 30d retention |
| Team plan | $26/월 | 50k errors/month, 무제한 멤버, 90d retention |

GA 직후 Developer plan 으로 시작 → 2주 burn-in 후 5k 초과 패턴 확인하면 Team plan upgrade.

### 2.2 백엔드 통합 단계

**현재 상태**: `AppExceptionFilter` 가 5xx 발생 시 pino error 로 기록 (method/url/reqId/userId/stack). Sentry 추가 시:

```typescript
// packages/backend/src/main.ts
import * as Sentry from '@sentry/node';
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: cfg.nodeEnv,
  tracesSampleRate: 0.1,
  // PII 자동 redact — 우리 ADR-017 reqId 와 정합
  beforeSend(event) {
    delete event.request?.cookies;
    return event;
  },
});

// app-exception.filter.ts captureServerError() 안에:
Sentry.captureException(err, {
  tags: { reqId, userId, route: req.url },
});
```

deps: `pnpm --filter @a-idol/backend add @sentry/node`. CSP `connect-src` 에 `https://*.sentry.io` 추가 필요.

### 2.3 Sentry 알람 설정 (권장)

| 알람 | 트리거 | 채널 |
|---|---|---|
| 5xx burst | issue rate > 10/min for 5 min | `#incident-live` Slack |
| 새 issue (regression) | 신규 fingerprint 발생 | `#cs-tier2` Slack |
| performance regression | p95 latency > 500ms for 10min | `#cs-tier3` Slack |

`Issue rule alerts` UI 에서 자동 생성 가능.

### 2.4 모바일/CMS 통합

**모바일**: `@sentry/react-native` (별도 SDK). 빌드 시 source map 자동 업로드. Cost: 모바일 errors 도 같은 free quota 소진 — burn-in 후 분리 결정.

**CMS**: `@sentry/react`. 보통 admin 사용자 적어 errors 적음.

이 슬라이스에서는 **백엔드만 1차 통합**. 모바일/CMS 는 GA 직후 follow-up.

---

## 3. T-081 후속 — k6 staging 50k 본 측정

### 3.1 사전 준비

기존 [`k6-staging-runbook-ko.md`](./k6-staging-runbook-ko.md) 참조. 추가 사항:

1. **Throttle override**: staging 시작 시 `THROTTLE_LIMIT_PER_MINUTE=100000` (prod 복귀 직전 200 으로 reset). **체크리스트 항목 추가**
2. **분산 source**: k6 cloud (월 $59) — 50 명 동시 ramp 시 2~4 region 배포
3. **Test data scale**:
   - 50,000 user 시드 (signup auto-script)
   - 99 idol (기존 dev seed)
   - 5,000 cheers / 10,000 votes 미리 채워 read-path 부하
4. **모니터링**: Prometheus `/metrics` + Sentry + Postgres `pg_stat_statements`

### 3.2 5단계 ramp 일정

| 단계 | 동시 VUs | duration | pass 조건 |
|---|---|---|---|
| S1 | 100 | 2min | p95 < 200ms |
| S2 | 500 | 2min | p95 < 300ms |
| S3 | 1k | 3min | p95 < 400ms, error < 0.1% |
| S4 | 5k | 5min | p95 < 500ms, error < 0.5% |
| S5 | **50k** | 10min | p95 < 1s, error < 1% |

S1~S3 는 1일 / S4~S5 는 별도 윈도우. S5 trip 시 Lever 5 leaderboard cache 도입 검토.

### 3.3 비용 추정 (1회 실행)

- k6 cloud: 50k VUs × 10min ≈ $8 (per-run)
- AWS staging (ECS + RDS + ElastiCache): ~$1.5/일 idle, k6 실행 시 transient $0.5
- Sentry: free quota 내
- **월 정기 cost (24/7 staging running)**: ~$50

GA 직전 burn-in 1주 + 본 측정 2회 + buffer 1회 = 약 **$80**.

---

## 4. 의존성 + ETA

| 항목 | 책임 | ETA | 비고 |
|---|---|---|---|
| AWS 계정 + Organization 셋업 | DevOps | 2026-06-15 | 별도 billing alarm $200/월 |
| RDS Postgres provision | DevOps | 2026-06-22 | dev DB schema 미러 (`prisma:deploy`) |
| ElastiCache Redis provision | DevOps | 2026-06-22 | — |
| ECS Fargate task definition | DevOps | 2026-07-01 | docker image push automation |
| Sentry 가입 + DSN 발급 | DevOps | 2026-07-01 | Developer plan 시작 |
| **k6 staging runbook 실행** | DevOps + 엔지니어링 | 2026-07-08 | S1~S5 5단계 |
| OAuth provider 설정 | 엔지니어링 | 2026-07-08 | Kakao/Apple/Google sandbox |
| 1차 store 제출 가능 | All | 2026-07-15 | 위 모두 ship 후 |

**Critical path**: AWS → RDS → ECS → Sentry → k6 → store 제출.

---

## 5. fall-back 시나리오

GA 단축으로 staging infra 가 7월 8일까지 못 나올 경우:

1. **dev-watch 기반 smoke** (현재 [`perf-baseline-ko.md`](./perf-baseline-ko.md)) — 신뢰도 낮으나 회귀 감지는 가능
2. **single-IP k6** + throttle override — 50k 동시는 불가, 5k 까지 측정
3. **Sentry 통합 미보유** — pino error log 만으로 GA 진입 + GA 직후 추가 (incident 대응 SLA risk)

이 fall-back path 는 PO + CTO 결정 (GA 일정 vs 안정성 trade-off).

---

## 6. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-27 | 초안 작성 — AWS topology + Sentry SaaS 통합 plan + k6 50k 5단계 ramp + ETA + fall-back. **2026-07-08까지 staging 셋업, 2026-07-15 1차 store 제출** 의 critical path 정의. |
