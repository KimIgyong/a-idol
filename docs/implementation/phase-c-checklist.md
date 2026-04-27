---
document_id: A-IDOL-PHASE-C-CHECKLIST-1.0.0
version: 1.0.0
status: Snapshot
created: 2026-04-23
updated: 2026-04-23
author: Gray Kim
---

# Phase C 마감 + Phase D 런웨이 체크리스트

**현재 날짜**: 2026-04-27 · **MVP GA 목표**: **2026-08-01** (2026-04-27 4주 단축 조정) · **남은 런웨이**: ~14주

WBS([`a-idol-wbs.md`](a-idol-wbs.md)) 기준 M1~M4는 대부분 shipped, M5(GA)는
미착수. 이 문서는 **지금 위치 진단 + 남은 블로커 명시 + 다음 4주 제안**의
스냅샷. 주간 재생산이 아니라 경로 재조준용.

**회의 포맷 버전**: [Phase C 재점검 회의 아젠다](./phase-c-review-agenda-ko.md) — 30분 PO/CTO 회의용 포장, 3가지 결정 요청 명시.

**Release notes**: [Phase C release notes](./phase-c-release-notes-ko.md) — PM·QA·온보딩용 1-pager. 성능 4축 + ETag 7 endpoints + 클라이언트 수혜 + 테스트 인프라 요약 + Phase D 백로그.

**1초 상태 점검**: `make phase-c-status` — typecheck · lint · unit · integration · build 전 게이트 + ADR-021 백로그 카운트 + ADR roster 한 화면. CI gate로도 재사용 가능 (실패 시 non-zero exit).

**중간 정리 리포트**: [RPT-260425 Phase C 중간 정리](../report/RPT_260425_phase-c-mid-progress.md) — 3일 작업 종합 + 진행중/잔여 + Phase D 우선순위 + PO/CTO 결정 요청 4건.

---

## 1. M1 Setup — ✅ 완료

| 태스크 | 상태 | 비고 |
|---|---|---|
| T-001..T-007 | ✅ | monorepo · backend skeleton · RN · CMS · CI · Prisma · identity |
| T-008 | ⚠️ partial | ECS skeleton 미착수 — "aws 는 나중에" 선언으로 의도적 지연 |
| T-009..T-011 | ✅ | email/pw login, mobile keychain, CMS RBAC |

**결정**: T-008 infra는 GA 시점에 맞춰 Phase D에서 한 번에 처리. 지금 하면 ECS 설정이 앱 구조 따라 돌연변이함.

---

## 2. M2 Catalog & Fandom — ✅ 완료

| 태스크 | 상태 | 비고 |
|---|---|---|
| T-020..T-025 | ✅ | Catalog · 하트 · 팔로우 · 팬클럽 (ADR-012 FREE-only), 모바일 화면 |
| T-026..T-027 | ✅ | CMS Idol/Agency CRUD · Auto-message 매니저 |
| T-028 | ✅ | 99 idol seed + HYUN 실제 프로필 |

---

## 3. M3 Chat & Commerce — 🟡 대부분 완료, IAP만 deferred

| 태스크 | 상태 | 비고 |
|---|---|---|
| T-040..T-043 | ✅ | Chat WS · 쿠폰 + KST 리셋 · 자동메시지 · 모바일 채팅 |
| T-044 | ✅ | Commerce 모듈 (ADR-015 DEV_SANDBOX · 3 fulfiller) |
| T-045 | ✅ | Photocard 모듈 (ADR-016 확률 공개 · 가중 랜덤 · 시드) |
| T-046 | 🟡 Phase 1 pre-work | 포트 + 스텁 + `INVALID_RECEIPT` + 2 테스트 landed (2026-04-23). `jose` 설치 + `JoseAppleReceiptVerifier` 실구현이 다음 — [dependency-approval-jose-ko.md](../ops/dependency-approval-jose-ko.md) PO 승인 대기. |
| T-047 | ✅ | 모바일 포토카드 shop + 컬렉션 (T-046b 중복 집계까지) |
| T-048 | ⬜ | Instagram 공유 워터마크 — P1, defer 가능 |
| T-049 | ✅ | CMS 포토카드 세트 매니저 |

### 🚨 블로커: T-046 IAP integration

**현재**: `APPLE_IAP`/`GOOGLE_IAP`/`STRIPE` 시도 시 `PROVIDER_NOT_SUPPORTED` 400 반환 (ADR-015 의도적). 모든 구매 UX는 존재하지만 실결제 미연결.

**필요**: `AppleReceiptVerifier` (StoreKit v2 JWS 검증) · `POST /api/v1/webhooks/apple` S2S notification 엔드포인트 · 환불 시 보상 fulfiller · Google/Stripe는 이후.

**예상 공수**: 8~12일 (Apple만) · 16~20일 (Google 포함). 스토어 등록 절차 + 테스트 샌드박스 세팅 외부 blocker가 실제 개발보다 긺 — [Apple Developer Program 체크리스트](../ops/apple-developer-program-checklist-ko.md)로 외부 절차 병렬 진행.

**설계 스펙**: [ADR-019](../adr/ADR-019-apple-iap-adapter.md) — 4 phase 롤아웃 (verifier / webhook / refund / env ops), `CreatePurchaseUseCase`는 손대지 않고 verifier만 주입. JWS offline 검증, 웹훅 idempotency는 기존 `(provider, providerTxId)` UNIQUE로 흡수.

---

## 4. M4 Audition — ✅ 완료 (+ 예정 외 확장)

| 태스크 | 상태 | 비고 |
|---|---|---|
| T-060..T-061 | ✅ | Audition/Round 도메인 + VoteRule |
| T-062 | ✅ | Vote ticket 구매 + **T-062b 라운드 스코프 확장 완료** |
| T-063..T-064 | ✅ | Redis leaderboard + 5분 스냅샷 + 라운드 종료 훅 |
| T-065..T-066 | ✅ | 모바일 투표 UI (HEART + TICKET + 라운드/글로벌 버킷 표시) |
| T-067 | ✅ | CMS Audition/Round/VoteRule manager |
| T-068 | ✅ | CMS Dashboard (오디션 상위 3명 포함) |

**보너스 완료**: ADR-014 reconcile endpoint · LeaderboardAuditProcessor (시간당 divergence + boot warmup) — WBS에는 없던 안전장치.

---

## 5. M5 Stabilization — 🟡 기초 완료, 세 축 미착수

| 태스크 | 상태 | 비고 |
|---|---|---|
| T-080 | 🟡 slice 1-3 | /health deep ping · correlation id · reconcile cron 완료. **Sentry/OTel/Datadog 미착수**. |
| T-081 | 🟡 baseline + k6 harness | 로컬 autocannon 베이스라인 확보 + `compression` 도입 ([perf-baseline-ko.md](../ops/perf-baseline-ko.md)). /idols 페이로드 4 KB → 1.5 KB (−63%). 이벤트 루프 포화 c=200에서 관측 → prod는 pm2 cluster 필요. **2026-04-24 성능 레버 4축 적용** — Prisma select narrowing (+5~12%), gzip compression, ETag/304 3개 경로 (/idols +110% hit, /commerce/products +63% hit, /auditions/:id 바이트 −66%), Redis idol meta cache (/leaderboard +26%) + write-through invalidation. **2026-04-24 k6 하네스 landed** — [test/load/](../../packages/backend/test/load/): `smoke.js` (10s · 1 VU) + `mixed-read.js` (3m30s · 0→100 VUs · 90/10 read/write mix · 엔드포인트별 p95 threshold). 50k concurrent 실측은 dev 머신 대상이 아니라 staging에서 별도 집행 예정. |
| T-082 | ⬜ | OWASP ASVS L2 — **미착수** |
| T-083 | ⬜ | WCAG AA — **미착수** |
| T-084 | 🟡 expanded | `test/integration/` 하네스 + **45 integration tests green** (health 3 · auth 4 · **commerce 7** · vote 2 · audition 2 · photocard 3 · authz 7 · chat 6 · seed-contract 6 · fandom 5). `pnpm test:integration`. 발견·수정 버그 2개: (1) `PRODUCT_NOT_FOUND`/`TRANSACTION_NOT_FOUND` 404 매핑 누락, (2) admin↔user 토큰 type 미스매치에서 500 (token-shape fingerprinting 리스크) → `UnauthorizedException`. **2026-04-24 mobile hook 테스트 셋업** — `packages/mobile`에 jest + ts-jest + @testing-library/react + fetch mock 하네스. 3 specs / 10 tests (useCastVote · useIdolFandom · usePurchase) — ADR-017 correlation id 분기(4xx suppress · 5xx expose) 회귀 커버. `pnpm --filter @a-idol/mobile test`. **2026-04-24 확장** — 4 specs 추가 (useIdolsList · useLeaderboard · useIdolDetail · useChatRoom). 7 suites / **29 tests**. 커버리지: 페이지네이션 stale-cancel, sort 변경 refresh, WS socket.io-client mock (room:join + message:received 중복 de-dupe), REST send 4xx 에러 포매팅. **2026-04-24 확장-2** — `useMyHearts` / `useMyFollows` hook 신설 + `api.listMyHearts/listMyFollows`에 pagination params 추가. 8 suites / **35 tests**. `/me/hearts` + `/me/follows` 백엔드 ETag 엔드포인트에 대응하는 mobile 소비 hook 확보. **2026-04-25 확장-3** — Mobile `apiFetch`에 module-level ETag 캐시 + 304 short-circuit. 6 tests 추가 (총 9 suites / **41 tests**). 모든 hook이 자동으로 304 경로 활용. **2026-04-24 CI 워크플로 2 jobs 확정** — [.github/workflows/ci.yml](../../.github/workflows/ci.yml): `lint-test` (lint · typecheck · unit · build — 백엔드 + 모바일 포함) + `integration` (Postgres 16 + Redis 7 services + prisma migrate/seed → `test:integration`). 병렬 실행. 확장은 Phase D. |
| T-085 | ⬜ | 스토어 제출 prep — T-046 의존 |
| T-086 | ✅ (초안) | [runbook-ko.md](../ops/runbook-ko.md) — 토폴로지 / 에스컬레이션 / rollback / 7가지 incident 플레이북 (leaderboard flush · IAP webhook · chat WS · BullMQ 백로그 · DB pool · 규제 · 환불 폭주) / 배포 체크리스트 / post-mortem 포맷. GA 전 PO·CTO 회람 대기. |
| T-087 | ✅ (초안) | Support FAQ 초안 landed (docs/support/faq-ko.md) — 법무 검수 필요 |

---

## 6. 예정 외 완료 (ADR + 문서)

WBS 외 shipped. 이후 스토어 리뷰 / 법무 / 지원 workflow에 필수.

- **ADR-010..021** — 12개 결정 기록 (총 21개 ADR 중 최근 12개). ADR-020 [Prisma over TypeORM](../adr/ADR-020-orm-prisma-over-typeorm.md) + ADR-021 [Phase C 성능 레버 4축](../adr/ADR-021-phase-c-perf-levers.md) = 2026-04-24 추가. 인덱스: [docs/adr/README.md](../adr/README.md). Phase D 진입 대기 설계: [design-leaderboard-full-cache-ko.md](../ops/design-leaderboard-full-cache-ko.md) — k6 50k 실측 후 버튼.
- **CMS Commerce 상품 관리 UI** — 가격 / JSON payload / 활성 토글
- **CMS Photocard 세트 관리 UI** — 세트 리스트 + 확률 실시간 표시 + 템플릿 추가
- **ADR-017 correlation id end-to-end** — 백엔드 로그 + mobile/CMS 에러 UI + 클립보드 복사
- **ErrorLine 컴포넌트 CMS 전체 확산** — 21 error surface 정책 일관성
- **T-046b 중복 집계 뷰** — 컬렉션 `×N` 뱃지
- **ADR-016 확률 공개** — 게임산업법 §22 + Apple §3.1.1 준수
- **ADR-018 trade/gift 미구현** — §32.1.7 사전 방어
- **Support FAQ 초안** — Q1~Q12 + 에스컬레이션 가이드

---

## 7. 법적/규제 체크포인트

| 항목 | ADR | 상태 |
|---|---|---|
| 확률 공개 (게임산업법 §22) | ADR-016 | ✅ 서버 계산 dropPercent 공개 |
| 환전 금지 (§32.1.7) | ADR-018 | ✅ trade/gift/burn 미구현 |
| 개인정보보호법 (삭제권, 내보내기) | — | ⬜ **미검토** |
| 청소년보호법 (결제 한도, 월 5만원 한도 미만 사용자) | — | ⬜ **미검토 — 법무 에스컬레이션 필요** |
| 특정금융정보법(가상자산 해당 여부) | ADR-018 | ✅ 포토카드 = 가챠 결과물, 자산 아님 입장 |

**🚨 즉시 법무 확인 필요**: 청소년 결제 한도. 게임산업법에서 청소년 월 5만원 한도는 트라이거 조건(게임물 정의) 해석 의존. 채팅/오디션/포토카드 = "게임물"인가? 법무 의견 없이 GA하면 소년법/게임산업법 복합 리스크.

**📨 브리프 초안**: [docs/legal/youth-payment-limit-brief-ko.md](../legal/youth-payment-limit-brief-ko.md) — 외부 법무에 송부할 일페이저. 5개 핵심 질의 + 상품 구성 상세 + 당사 가설적 입장 + 법정대리인 동의 UI 옵션. PO · CTO 내부 회람 후 발송.

---

## 8. 리스크 랭킹 (GA 블로커 우선순위)

| # | 리스크 | 영향도 | 대응 |
|---|---|---|---|
| 1 | **IAP 미구현** | GA 불가 | T-046 착수 — 4주 안에 Apple만이라도 |
| 2 | **청소년 결제 한도 법적 입장 미확정** | 법적 노출 | 즉시 법무 에스컬레이션 — FAQ Q7에도 영향 |
| 3 | **통합/회귀 테스트 skeleton only (T-084)** | 복잡한 플로우(audition 전환·photocard roll·refund) 미커버 | 기존 하네스 확장 — 주당 2~3 플로우 추가 |
| 4 | **Load test 미실시 (T-081)** | 출시일 트래픽 spike 미대응 | Redis + Postgres 50k concurrent 시뮬 — 3일 |
| 5 | **Sentry/OTel 미연결** | 프로덕션 이슈 대응 속도 저하 | env 준비 후 SDK 연결 — 2일 |
| 6 | **ECS/AWS infra 미구축 (T-008)** | 배포 경로 미확정 | Phase D 합치 — 1주 |
| 7 | **Push 알림 (FR-090..092) 미구현** | 리텐션 저하, GA는 가능 | P1로 defer 가능 |
| 8 | **포토카드 share (FR-073) 미구현** | UX 감소, GA는 가능 | P1 |

---

## 9. 다음 4주 제안 (Week 18~15 before GA)

### Week 1 — 법무 + IAP 스펙
- [ ] 법무 에스컬레이션: 청소년 결제 한도 · 게임물 분류 판단 요청
- [ ] Apple Developer Program 가입 / 등록 (외부 절차 시작) — 체크리스트 [ops/apple-developer-program-checklist-ko.md](../ops/apple-developer-program-checklist-ko.md)
- [ ] `AppleReceiptVerifier` 인터페이스 스펙 작성 (ADR-015 활성 계획 구체화)
- [ ] Support FAQ 법무·PO 회람

### Week 2 — IAP 구현
- [ ] StoreKit v2 JWS 검증 라이브러리 (`jose`) 통합
- [ ] `POST /api/v1/commerce/purchases` Apple 분기 + pending 상태 유지
- [ ] `POST /api/v1/webhooks/apple` S2S notification 엔드포인트
- [ ] 기존 `CreatePurchaseUseCase`는 손대지 않고 verifier만 교체 (ADR-015 약속)

### Week 3 — 테스트 + Observability
- [ ] 통합 테스트 스위트 기초 (supertest + testcontainers) — 주요 10개 플로우
- [ ] Sentry SDK wiring (DSN env 설정 후 활성화)
- [ ] Load test 스크립트 (k6) — /api/v1/rounds/:id/votes · /api/v1/commerce/purchases
- [ ] OpenTelemetry는 Phase D 이후로 연기 확정

### Week 4 — 보안 + 배포 준비
- [ ] OWASP ASVS L2 체크리스트 자가점검
- [ ] WCAG AA 모바일 기본 (alt text, 색 대비, 키보드 nav 미적용 스킵) 체크
- [ ] App Store Connect 제품 등록 + DEV_SANDBOX → PRODUCTION 전환 스위치
- [x] ~~Incident playbook 초안~~ — [runbook-ko.md](../ops/runbook-ko.md) shipped 2026-04-23, GA 전 PO·CTO 회람만 남음

---

## 10. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-23 | 초기 스냅샷 — M1~M4 대부분 완료, IAP/법무/테스트가 GA 블로커로 명확화 |

---

## 부록 — ADR 인덱스

| ADR | 주제 | 상태 |
|---|---|---|
| 010 | Admin user 분리 | ✅ |
| 011 | 팬덤 soft-leave | ✅ |
| 012 | 유료 팬클럽 MVP 범위 외 | 🟡 defer |
| 013 | 채팅 룰 엔진 MVP | ✅ |
| 014 | Leaderboard Redis + PG 스냅샷 | ✅ |
| 015 | Commerce DEV_SANDBOX | 🟡 활성 계획 남음 |
| 016 | 포토카드 확률 공개 | ✅ |
| 017 | Correlation ID | ✅ |
| 018 | 포토카드 trade 미구현 | ✅ defer |
| 019 | Apple IAP 어댑터 스펙 | ✅ accepted (CTO self-review 2026-04-23, PO 비준 회의 대기) |
