# [RPT-260426] Telemetry 스택 사전 비교 — Sentry · OTel · Datadog

## Report Metadata

| 항목 | 값 |
|---|---|
| **리포트 ID** | RPT-260426 |
| **제목** | A-idol Telemetry 스택 의사결정 자료 (CTO/PO 회의 결정 2 사전) |
| **작성일** | 2026-04-26 |
| **작성자** | Gray Kim <gray.kim@amoeba.group> |
| **분류** | 의사결정 지원 (Decision-support) |
| **대상 독자** | PO · CTO (Phase C 재점검 회의 결정 2 의제) |
| **회의** | 2026-04-30 (수) 30분 PO/CTO · 결정 2 6분 할당 |
| **관련 문서** | [phase-c-review-agenda v1.1](../implementation/phase-c-review-agenda-ko.md), [RPT-260425 mid-progress](./RPT_260425_phase-c-mid-progress.md), [perf-baseline-ko.md](../ops/perf-baseline-ko.md) |

---

## 1. Executive Summary

3개 스택을 5축(비용·데이터 거주·통합 복잡도·운영 부담·모바일 적합성)으로
비교했다. **권고: Sentry SaaS (EU region)로 시작, Phase E에서 OTel
self-host로 마이그레이션 옵션 보유.**

| 스택 | 월 비용(GA scale) | KR 데이터 거주 | RN 성숙도 | 운영 부담 | 권장도 |
|---|---|---|---|---|---|
| **Sentry SaaS** | **$26~$80** | EU만 (KR 자체 거주는 self-host 시) | ⭐⭐⭐⭐⭐ | 낮음 | **✅ 권장 (1차)** |
| OTel + Loki/Tempo (자체) | $80~$250 (인프라) | 완전 통제 | ⭐⭐ (Beta) | 높음 | △ Phase E 옵션 |
| Datadog SaaS | $300~$800 | Tokyo (KR 없음) | ⭐⭐⭐⭐ | 낮음 | ❌ 비용 대비 ROI 낮음 |

**의사결정 미스 시 영향**: 미선정으로 W4 시작하면 50k 부하 측정 결과를
incident 단위로 추적 못 함 → GA 시 incident 발생 시 root cause 추적 어려움.

---

## 2. 비교 축 정의

| 축 | 무엇을 본 것인가 | 왜 중요한가 |
|---|---|---|
| **비용** | 50k DAU · 5% error rate · 10k logs/min 기준 월 비용 | 18주 런웨이 + 운영 예산 |
| **KR 데이터 거주** | 한국 사용자 데이터의 저장 region | 개인정보보호법 + 청소년 한도 데이터 향후 합법성 |
| **RN 성숙도** | React Native 0.74+ 공식 SDK 안정성 + 스토어 심사 호환 | Apple/Google 스토어 제출 + crash 추적 |
| **백엔드 통합 복잡도** | NestJS 10.x + Prisma + BullMQ에 attach 비용 | Phase D 단일 sprint 안에 도입 가능한가 |
| **운영 부담** | 인프라 운영 + 인시던트 시 디버깅 시간 + 학습 곡선 | CTO 단독 운영 환경 (현재 인력 1) |

---

## 3. 옵션별 상세

### 3.1 Sentry SaaS

**제품 구성**
- Errors + Performance (APM) + Replay + Profiling + Crons + Alerts (단일 SaaS)
- @sentry/node (NestJS) · @sentry/react-native · @sentry/react (CMS)
- Source map auto-upload + Release tracking + commit 별 issue 추적
- Self-hosted (Docker compose) 옵션 — 한국 region 자체 운영 가능

**비용 (Tier별, 월 단위)**
| Tier | Errors | Perf transactions | Replays | 가격 |
|---|---|---|---|---|
| Free | 5k | 10k | 50 | $0 |
| Team | 50k | 100k | 500 | $26 |
| Business | 100k+ | unlimited (변동) | 5k | $80~ |
| Self-host | 무제한 | 무제한 | 무제한 | 인프라 비용만 (~$50/mo small) |

**A-idol 50k DAU 추정**: 5% error rate ≒ 2.5k errors/일 × 30 = 75k/월 → Team
($26) 한 단계 위 Business ($80) 또는 Team에 overage 포함 ~$50.

**KR 데이터 거주**
- SaaS: US (`sentry.io`) 또는 EU (`de.sentry.io`)만. **KR region 없음** (2026-04 기준 공개 정보 기반).
- 옵션: self-host on AWS Seoul → 풀 컨트롤 + 인프라 비용 (~$50/mo).
- 권고: SaaS EU로 시작 → 청소년 한도 데이터 들어오는 시점에 self-host 마이그레이션 (mig 비용 ~3일).

**RN 성숙도**
- **공식 RN SDK 가장 성숙** (2017~). Hermes JIT 호환. iOS/Android 네이티브 crash 캡처.
- 스토어 심사: 통신 도메인 `*.sentry.io` 추가만 필요 (privacy manifest에 명시).

**백엔드 통합 복잡도**
- NestJS: `@sentry/node` + `SentryModule.forRoot()` (1일 수준).
- Prisma slow query 감지: built-in (별도 설정 필요 없음).
- BullMQ jobs: `@sentry/node` 자동 instrumentation.

**운영 부담**: SaaS 사용 시 거의 0. Self-host 시 PostgreSQL 백업 + symbolicator 갱신 정도.

### 3.2 OpenTelemetry Collector + 자체 백엔드 (Grafana/Loki/Tempo/Prometheus)

**제품 구성**
- OTel SDK (vendor-neutral) + Collector + 백엔드 4종:
  - Tempo (분산 trace) + Loki (logs) + Prometheus (metrics) + Grafana (UI)
- OTel JS SDK는 Nest/Express auto-instrumentation 풀 지원
- RN OTel SDK: **Beta 단계** (2026-04 기준). Production 권장 X.

**비용**: 인프라 비용만.
- AWS Seoul: Loki t4g.medium 1대 + Tempo t4g.small + Prometheus t4g.small + Grafana = ~$80/월 (개발) → ~$250/월 (GA scale).
- S3 storage (Loki 30일 + Tempo 7일): ~$30/월 추가.

**KR 데이터 거주**: ✅ 풀 컨트롤. AWS Seoul region에 모든 데이터 저장.

**RN 성숙도**: ⭐⭐ Beta. 스토어 제출은 가능하지만 production crash 추적 신뢰도 검증 안 됨.

**백엔드 통합 복잡도**
- NestJS: `@opentelemetry/sdk-node` + auto-instrumentations (1~2일).
- Collector 배포 + Loki/Tempo/Prometheus/Grafana 4 서비스 ECS Fargate 배포 (3~5일).
- Grafana 대시보드 작성 (~3~5일).

**운영 부담**: **높음**. Loki retention 관리 + Tempo TraceQL 쿼리 학습 + Grafana
대시보드 유지보수. 1인 CTO 환경에서 인시던트 시 디버깅 학습 곡선 부담.

### 3.3 Datadog SaaS

**제품 구성**
- APM + Logs + RUM + Synthetics + Profiler + Watchdog AI
- dd-trace-js (NestJS) · dd-sdk-reactnative · dd-sdk-browser (CMS)
- 가장 성숙한 APM 시스템, watchdog anomaly detection 포함

**비용 (50k DAU 추정)**
- APM: $31/host × 2 hosts = $62/월
- Logs: $0.10/GB × 100GB = $10/월 (실제 ingest pricing 변동)
- RUM: $1.50/1k sessions × 50k DAU × 30일 / 1k = ~$2,250/월 (RN sessions 포함)
- 합계: **~$300~$2,500/월**

> RUM session 비용이 dominant. 모바일 anonymous session 무한 재기록되면 폭증.
> sampling 적용 시 ~$300 수준으로 억제 가능하지만 trace 누락 리스크.

**KR 데이터 거주**: US, EU, **Tokyo (japan-1)**. KR region 없음. Tokyo가
지리적으로 가장 가까움 (RTT ~30ms).

**RN 성숙도**: ⭐⭐⭐⭐ 공식 SDK 안정. Hermes 호환.

**백엔드 통합 복잡도**: 1~2일. dd-trace-js auto-instrument.

**운영 부담**: SaaS 사용 시 거의 0.

---

## 4. 의사결정 매트릭스

각 축 5점 만점 (5=좋음, 1=나쁨). 가중치 = A-idol 우선순위.

| 축 | 가중치 | Sentry | OTel | Datadog |
|---|---|---|---|---|
| 비용 (낮을수록 5) | 30% | 5 (~$80) | 4 (~$250) | 2 (~$500) |
| KR 데이터 거주 | 20% | 3 (EU + self-host 옵션) | 5 (자체 통제) | 2 (Tokyo) |
| RN 성숙도 | 20% | 5 (가장 성숙) | 2 (Beta) | 4 (안정) |
| 백엔드 통합 복잡도 (단순=5) | 15% | 5 (1일) | 3 (5일) | 5 (1일) |
| 운영 부담 (낮을수록 5) | 15% | 5 (SaaS) | 2 (4서비스) | 5 (SaaS) |
| **합계 (가중)** | 100% | **4.55** | **3.20** | **3.05** |

---

## 5. 권고

### 5.1 Phase D (5/4 ~ 6/7) 도입: **Sentry SaaS Team tier ($26)**

**근거**:
- 18주 런웨이 + 1인 CTO 환경 → 운영 부담 최소화 우선
- RN 성숙도 가장 높음 → 모바일 crash 추적 GA day 안전성 확보
- 비용 가장 낮음 ($26 vs Datadog $300+)
- self-host 마이그레이션 경로 보유 → KR 데이터 거주 요구 발생 시 ~3일 작업

**도입 작업** (1주 안에 완료 가능):
- W1: Sentry 가입 + DSN 발급 (PO) · `@sentry/node` 통합 (CTO, 1일)
- W2: `@sentry/react-native` 통합 + dSYM/ProGuard 업로드 (CTO, 1일)
- W2: `@sentry/react` CMS 통합 + source map upload (CTO, 0.5일)
- W2: alert 룰 설정 (5xx > 1% / event loop lag > 1s / IAP webhook fail > 0.1%) (CTO, 0.5일)
- 합계 **3일 endpoint 작업 + 1일 alert 튜닝**

### 5.2 마이그레이션 트리거 (Phase E 또는 GA 후)

다음 중 하나 충족 시 OTel + self-host로 마이그레이션 검토:
- 법무 자문에서 **KR 데이터 거주 강제 요구** 확정 (개인정보보호법 §39-12 송수신 기록)
- Sentry 월 청구 $200 초과 (Team → Business 전환 vs OTel 비용 비교)
- Datadog 등 다른 벤더와 통합 필요 (희박)

### 5.3 거부 항목

- **Datadog**: RUM session 비용 폭증 리스크 + KR region 없음 + Sentry 대비 ROI 낮음. **거부.**
- **OTel + self-host (Phase D 도입)**: 운영 부담 너무 큼. RN SDK Beta. Phase D 단일
  sprint 안에 production-ready 도입 어려움. **거부, 마이그레이션 옵션으로만 보유.**

---

## 6. 회의에서 합의해야 하는 항목 (결정 2 6분)

- [ ] **권고 (Sentry SaaS Team tier) 승인?** → Yes 시 W1 PO가 가입 + DSN 발급, CTO가 통합 PR
- [ ] **월 비용 한도 사전 승인** ($26 시작 → $80 까지)
- [ ] **마이그레이션 트리거 조건** 동의 (KR 데이터 거주 요구 / Sentry $200 초과)
- [ ] **alert 임계 4종** 사전 검토 (5xx 1% / event-loop 1s / IAP webhook 0.1% / leaderboard p95 500ms)

---

## 7. 후속 액션 (회의 결정 후)

- [ ] **Sentry 가입** — 결제 승인 후 PO. Org name 결정.
- [ ] **DSN 환경변수** — staging + prod 분리 환경변수 (`SENTRY_DSN_STAGING`, `SENTRY_DSN_PROD`)
- [ ] **개인정보 데이터 마스킹** — 한국 개인정보보호법 §29 (체계적 보호 조치)
  - email/phone scrubber 활성화 (`beforeSend` hook으로 PII 제거)
  - User context는 internal user_id만 (이메일 송신 X)
- [ ] **ADR 작성**: ADR-022 "Phase D Telemetry stack — Sentry SaaS"
- [ ] **마이그레이션 설계 스케치**: `docs/ops/design-telemetry-otel-migration-ko.md` (트리거 발동 시 활용)

---

## 8. 변경 이력

| 일자 | 내용 |
|---|---|
| 2026-04-26 | 초안 작성. PO/CTO 회의 결정 2 사전 자료. Sentry SaaS Team 권고. |
