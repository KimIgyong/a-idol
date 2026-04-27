---
document_id: A-IDOL-PHASE-C-REVIEW-AGENDA-1.1.0
version: 1.1.0
status: Draft
created: 2026-04-23
updated: 2026-04-26
author: Gray Kim
meeting_target: 2026-04-30 (수) 예정 · 30분 · PO + CTO (법무는 결정 1 시점만 입회)
---

# Phase C 재점검 회의 아젠다 v1.1

> v1.0 (2026-04-23) 대비 변경: 3일간 성능 4축 + ETag + 클라이언트 캐싱 + 테스트 인프라 모두 GA 게이트 수준으로 정착. 단일 잔여 블로커는 **k6 50k staging 실측 환경 확보**. 결정 항목을 RPT-260425 (Phase C 중간 정리 리포트)와 동기화.

**회의 목적**: GA(2026-08-29)까지 약 17주 남은 시점에서, Phase C 마감 직전
상태를 1회 검토하고 **3가지 의사결정**을 확보. 이후는 의사결정에 기반한
실행만 남도록.

**참석자**: PO (대표 김도영 가정) · CTO (Gray Kim) · 법무 (결정 1 8분만 입회)

**사전 자료** (읽지 않고 참석하면 회의 가치 반감):

1. [**RPT-260425 Phase C 중간 정리**](../report/RPT_260425_phase-c-mid-progress.md) — 가장 압축된 종합 (이거 하나만 읽어도 OK)
2. [Phase C release notes](./phase-c-release-notes-ko.md) — 영역별 상세
3. [ADR-021 Phase C 성능 레버 4축](../adr/ADR-021-phase-c-perf-levers.md) — 성능 결정
4. [`make phase-c-status`](../../scripts/phase-c-status.sh) — 1초 게이트 점검 (회의 직전 라이브 실행 권장)
5. [k6 staging runbook](../ops/k6-staging-runbook-ko.md) — 결정 3 의제 사전 양식 (5단계 ramp + 비용)
6. [**RPT-260426 Telemetry 비교**](../report/RPT_260426_telemetry-comparison.md) — 결정 2 Telemetry 의제 1-pager (Sentry/OTel/Datadog · 권고 Sentry SaaS)
7. [법무 자문 브리프](../legal/youth-payment-limit-brief-ko.md) — 결정 1 대상 (변경 없음)

---

## 타임박스 (총 30분)

| 분 | 섹션 | 주관 | 산출물 |
|---|---|---|---|
| 00~04 | 현황 요약 (3일 작업 종합) | CTO | 공감대 |
| 04~08 | 위험 + critical path 갱신 | CTO | 우선순위 합의 |
| 08~16 | **결정 1: 법무 브리프 발송 승인** (법무 입회) | PO · 법무 | Yes/No + 필수 수정 |
| 16~22 | **결정 2: Phase D 범위 + GA 일정 (4주 슬립 가/부)** | PO · CTO | Yes / 재배열 |
| 22~28 | **결정 3: staging 인프라(T-008) 우선순위 + Telemetry 스택** | PO · CTO | 일정 + 스택 |
| 28~30 | Action items + 다음 회의 일정 | 전체 | owner × due |

---

## 1. 현황 요약 (4분, CTO)

**테스트 합계 233건 green** (이전 회의 시점 99 → +134):
- Backend unit 109 · Backend integration 67 · Mobile hook 41 · k6 16 cases
- `make phase-c-status` (회의 시점 라이브 실행) — 0 fail · 0 skip 권장

**3일간 합쳐진 결정 + 산출물**:
- ADR-019 (Apple IAP) **Accepted** · ADR-020 (Prisma) · ADR-021 (성능 4축) 신규
- 성능 4축 적용 + ETag 7 endpoints + Redis IdolMetaCache + write-through
- CMS query-keys 레지스트리 + 7 surface fan-out helpers
- Mobile apiFetch ETag 캐시 + `useMyHearts` / `useMyFollows` 신설
- k6 하네스 (smoke + mixed-read) · CI 2-jobs (lint-test + integration with PG/Redis)
- ADR 인덱스 ([docs/adr/README.md](../adr/README.md)) · `make phase-c-status` · runbook · FAQ · jose 승인 노트

**의미**: M1~M4 완료 + M5 stabilization 95% 진척. Phase D 진입까지 단일 블로커 = staging 환경 확보 (k6 50k 실측 위함).

---

## 2. 위험 + Critical Path (4분, CTO)

이전 회의의 IAP critical path는 **ADR-019 Accepted 전환으로 unblock 됨**.
새 critical path는 다음과 같이 재배열:

| # | 위험 | 영향 | 다음 액션 | 결정 의제 |
|---|---|---|---|---|
| 1 | **staging 환경 미확보 (T-008)** | k6 50k 실측 불가 → Phase D #1 지연 | 인프라 ETA 합의 + 담당자 | **결정 3** |
| 2 | **청소년 결제 한도 법적 입장 미확정** | 출시 전 IAP 한도 미들웨어 설계 미완 | 법무 답변 14일 내 | **결정 1** |
| 3 | **Telemetry 스택 미선정** | 50k 트래픽 운영 시 incident 추적 불가 | Sentry vs OTel vs Datadog 선택 | **결정 3** |
| 4 | **GA 일정 (8/29) vs 18주 런웨이 압박** | T-008 4주 슬립 시 GA 일자 영향 | 슬립 가/부 + 대안 | **결정 2** |
| 5 | OWASP ASVS L2 + WCAG AA 외주 vs 자체 | 4-6주 선행시간 | Phase D 안에서 별도 결정 | (정보 공유) |

다른 항목 (T-082 OWASP / T-083 WCAG / T-085 store prep)은 모두 위 5가지 내부에 흡수.

---

## 3. 결정 1: 법무 브리프 발송 승인 (8분 · 법무 입회)

**배포 문서**: [법무 자문 브리프](../legal/youth-payment-limit-brief-ko.md)

> 이 항목은 v1.0 그대로 유지. 브리프는 2026-04-23 작성 후 **아직 미발송**.
> Phase C 작업 자체와는 독립적이지만 GA critical path의 마지막 외부
> dependency.

**의사결정 요청**:
- [ ] 5개 핵심 질의의 범위가 적절한가? 추가/삭제할 질의?
- [ ] **당사 가설적 입장** (§5) — 법무에 공개해도 안전한가?
- [ ] 발송 대상 법률 대리인 (기존 자문사 vs 신규 컨트랙트)?
- [ ] 답변 희망 시점 **2026-05-10** (14일 내, 일정 슬립 반영)이 현실적?
- [ ] 자문료 한도 사전 승인 금액?

**의사결정 미스 시 영향**: 답변 1주 지연 = GA 1주 지연 (17주 런웨이에서 ~6% 손실).

---

## 4. 결정 2: Phase D 범위 + GA 일정 (6분)

**배경**: Phase C 완료 + 17주 런웨이. RPT-260425 §4 우선순위 작업 11개 항목을 GA 일정 안에 압축할지 vs 4주 슬립할지.

**현재 우선순위 (배포 문서 [RPT-260425 §4](../report/RPT_260425_phase-c-mid-progress.md#4-phase-d-진입-시-우선순위-작업-release-notes에서-이송)) 요약**:

| 주차 | 항목 | 주체 |
|---|---|---|
| W1 (4/27~5/3) | k6 50k staging 실측 + runbook · `make phase-c-status` CI 통합 | CTO + 인프라 |
| W2~W3 (5/4~5/17) | leaderboard full cache (Lever 5 — 측정 결과 의존) · Mobile useFandom invalidate retrofit · IAP 본 구현 (ADR-019 Phase 1) | CTO + 모바일 |
| W4~W6 (5/18~6/7) | **Telemetry 스택 도입** · OWASP ASVS L2 자가/외주 · WCAG AA 감사 | CTO + (외주?) |
| W7~W12 (6/8~7/19) | App Store / Play Store 제출 prep · 법무 답변 통합 (청소년 한도 미들웨어) · 통합 테스트 확장 (refund flow) | PO + CTO |
| W13~W17 (7/20~8/29) | GA dry run · 부하 재측정 · runbook PO 회람 + 운영자 교육 · GA day | 전체 |

**의사결정 요청**:

- [ ] **GA 일정 8/29 유지 가능?** — staging 인프라 4주 슬립 시 결정.
- [ ] 4주 슬립 시 **신규 GA 일자 9/26 대안** 수용 가능?
- [ ] **Telemetry 스택 선택** — **사전 비교 RPT 작성됨**: [RPT-260426 Telemetry 비교](../report/RPT_260426_telemetry-comparison.md). 권고 = **Sentry SaaS Team tier ($26)**. KR 거주 요구 발생 시 self-host 마이그레이션 트리거.
  - Sentry SaaS · OTel + Loki/Tempo · Datadog 5축 비교 + 의사결정 매트릭스 (가중 평균 Sentry 4.55 / OTel 3.20 / Datadog 3.05).
  - 도입 작업 추정: **3일 endpoint + 1일 alert 튜닝** (W2 안에 완료).
  - alert 임계 4종 사전 검토 항목: 5xx 1% / event-loop lag 1s / IAP webhook fail 0.1% / leaderboard p95 500ms.
- [ ] **OWASP ASVS L2 감사 외주 vs 자체** — 외주 시 4~6주 선행시간 → W4 시작이면 W10 회신.

**의사결정 미스 시 영향**: 미결정으로 W1 시작하면 W4부터 telemetry 미부재로 50k 부하 측정 결과 해석 불가.

---

## 5. 결정 3: staging 인프라 (T-008) + k6 50k 실측 (6분)

**배경**: Phase C 마감 후 Phase D 진입 게이트는 `k6 50k staging 실측`. 이게 안 되면 ADR-021 Lever 5 (leaderboard full cache) 트리거 판단 불가 → GA 직전 incident 리스크.

**현 staging 상태**: 미구축 (T-008 WBS 아직 미착수). dev mode `pnpm dev`는 ~9k RPS 상한이라 50k 실측 부적합.

**의사결정 요청**:

- [ ] **T-008 인프라 작업 즉시 착수 가능?** (CTO 단독 4주 추정)
- [ ] **인프라 외주 vs 자체** — AWS ECS + RDS + ElastiCache Redis + ALB. 외주 시 2주 단축 가능 vs 비용.
- [ ] staging 비용 **월 운영비 한도 사전 승인** (~$300~600 추정)
- [ ] **k6 실측 담당자 + 일정 commit** — staging 가용 후 1주 내 50k ramp 1회 + 결과 RPT 작성.
- [ ] 만약 staging 4주 이상 지연 → **dev 머신에서 부분 측정 (1k VU)으로 우회** 가능?

**의사결정 미스 시 영향**: staging 미확보 = Lever 5 미구현 = 50k 트래픽 시 leaderboard 병목 가능성. GA day 위험.

---

## 6. 결정 불요 · 정보 공유 (필요 시 생략)

- **ADR-021 (성능 4축)** — Accepted. 측정값 [perf-baseline-ko.md](../ops/perf-baseline-ko.md) 참조.
- **ETag 304 7 endpoints** — write-through invalidation 포함, 회귀 ITC-ETAG 16 tests로 잠금.
- **CMS / Mobile 클라이언트 캐시** — apiFetch module-level ETag 자동 동작, 추가 작업 불필요.
- **`make phase-c-status`** — 회의 직전 라이브 실행 권장. 8 ok / 0 fail / 0 skip이 정상.
- **leaderboard full cache 설계** — [design sketch](../ops/design-leaderboard-full-cache-ko.md) 동결됨. 측정 후 1일 내 PR.

---

## 7. Action items 템플릿

회의 끝날 때 다음 형식으로 Slack `#phase-c` 채널에 게시:

```
📌 Phase C Review v1.1 (2026-04-30) Action Items
1. [owner] — [action] — due YYYY-MM-DD
2. [owner] — [action] — due YYYY-MM-DD
...
Next review: YYYY-MM-DD
```

**예상 action items** (사전 시나리오):

- @법무 — 자문 회신 — due 2026-05-10
- @CTO — staging 인프라 ECS/RDS/Redis 설계 PR — due 2026-05-03
- @PO — Telemetry 스택 후보 비용 검토 — due 2026-05-03
- @CTO — k6 50k staging 실측 RPT 작성 — due staging+1주
- @CTO — 5/17까지 IAP 본 구현 + leaderboard cache 결정 보고 — due 2026-05-17
- Next review: 2026-05-21 (수)

---

## 8. 회의 취소 / 연기 조건

- PO 또는 법무 부재: 결정 1만 연기 (법무 입회 8분 분리 가능). 결정 2/3는 PO+CTO만으로 진행.
- 긴급 장애 발생: **30분 연기 후 상태 회복 확인 후 재개**.
- staging 인프라가 회의 전에 이미 결정되어 있으면 결정 3은 정보 공유로 강등.

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-23 | v1.0 초안 작성. 회의 일자 미정 (2026-04-30 가정). 결정 3건: 법무 브리프 / ADR-019 Accepted / 4주 실행 계획. |
| 2026-04-26 | v1.1 갱신. Phase C 3일 작업(성능 4축 + ETag + 캐싱 + 233 tests) 반영. ADR-019는 이미 Accepted라 결정 의제에서 빠짐. 새 결정 3건: 법무 브리프(유지) / Phase D 범위 + GA 일정 + Telemetry 스택 / staging 인프라 T-008 + k6 50k 실측. RPT-260425 사전 자료 1순위로 승격. |
