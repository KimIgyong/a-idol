# [RPT-260426-B] 관리자 어드민 메뉴 audit + Phase D 구현 우선순위

## Report Metadata

| 항목 | 값 |
|---|---|
| **리포트 ID** | RPT-260426-B |
| **제목** | CMS admin 메뉴 현황 점검 + 누락 기능 + 싱가폴 법인 implications |
| **작성일** | 2026-04-26 |
| **작성자** | Gray Kim <gray.kim@amoeba.group> |
| **분류** | 기능 점검 + 구현 우선순위 |
| **트리거** | 운영자 요구: "관리자 어드민 메뉴 확인 및 구현 진행" + 서비스 제공 법인 싱가폴 설립 예정 |
| **관련 문서** | [phase-c-release-notes](../implementation/phase-c-release-notes-ko.md), [ADR-010](../adr/ADR-010-admin-user-separation.md), [Support FAQ](../support/faq-ko.md) |

---

## 1. Executive Summary

현행 CMS는 **8개 메뉴**가 모두 backend admin endpoint와 1:1 매핑된 상태로
정상 동작. 그러나 **운영팀이 GA 후 즉시 필요한 6개 기능이 부재** —
사용자 관리, 거래/환불, 운영자 관리, 감사 로그, 시스템 상태, sandbox 토글.

**싱가폴 법인 설립**은 추가로 5개 변경 의제를 만든다: 다중 통화, 다국어 admin
UI, IAP territory 분리, PDPA(SG) vs PIPA(KR) 동의 추적, 청소년 한도
미들웨어 적용 범위.

**제안**: Phase D 진입 첫 주에 **운영자 관리** + **사용자 관리** 두 메뉴
신설. 나머지는 우선순위 큐로.

---

## 2. 현재 메뉴 vs 백엔드 매핑

### 2.1 정상 운영 중 (8 menus, all wired)

| # | CMS 메뉴 | Path | 백엔드 controller | RBAC |
|---|---|---|---|---|
| 1 | 대시보드 | `/dashboard` | `admin/analytics` | 모든 admin |
| 2 | 아이돌 관리 | `/idols` | `admin/catalog/idols/*` | admin + operator |
| 3 | 소속사 | `/agencies` | `admin/catalog/agencies/*` | admin + operator |
| 4 | 오디션 | `/auditions` | `admin/auditions/*` | admin + operator |
| 5 | 자동 메시지 | `/announcements` | `admin/chat/auto-messages` | admin + operator |
| 6 | 포토카드 | `/photocards` | `admin/photocards/*` | admin + operator |
| 7 | 상품/결제 | `/commerce` | `admin/commerce/products` | admin + operator |
| 8 | 분석 | `/analytics` | `admin/analytics/overview` | **admin only** |

### 2.2 백엔드 endpoint는 있으나 UI 없음 (2 items)

| # | 백엔드 엔드포인트 | 사용 시점 | 우선순위 |
|---|---|---|---|
| A | `POST /admin/users/:userId/chat-coupons` | Support 환불·보상 시 채팅 쿠폰 지급 | **Mid** (Support FAQ Q4 의존) |
| B | `POST /admin/rounds/:id/reconcile-leaderboard` | leaderboard ZSET 손상 incident 시 수동 복구 (ADR-014) | **Low** (BullMQ cron이 자동 처리) |

### 2.3 백엔드도 UI도 없음 — 진짜 gap (6 items)

| # | 기능 | 왜 필요한가 | 우선순위 |
|---|---|---|---|
| 1 | **사용자 관리 (User Management)** | Support FAQ Q1~Q15 거의 모두 사용자 식별 + 거래/투표/하트 조회 필요. 환불·정지·탈퇴 처리. PDPA/PIPA delete 책임. | **🔴 P0 — Phase D 1주차** |
| 2 | **운영자 관리 (Operator/AdminUser CRUD)** | 싱가폴 법인 설립 시 신규 운영팀 즉시 추가 필요. 현재는 `prisma seed`만 admin 계정 생성. ASVS L2 RBAC 감사 요구. | **🔴 P0 — Phase D 1주차** |
| 3 | **거래 관리 (Transaction lookup + refund)** | IAP 환불 처리 (ADR-019 §4) — 사용자 → 거래 ID → status 변경 → 채팅 쿠폰/투표권 회수 또는 보상 흐름. | **🟠 P1 — Phase D 2주차** |
| 4 | **감사 로그 (Audit Log Viewer)** | ASVS L2 V8 로깅 요구. 누가 언제 어떤 idol을 publish/unpublish/delete 했는지 조회. PDPA 사용자 데이터 접근 추적. | **🟡 P2 — Phase D 3~4주차** |
| 5 | **시스템 상태 (System Health Dashboard)** | BullMQ queue 길이, Redis 메모리, cron 마지막 성공 시각, 통합 테스트 게이트 통과 여부. 운영자 daily check-in. | **🟡 P2 — Phase D 3~4주차** |
| 6 | **Sandbox/Prod 환경 토글** | DEV_SANDBOX 결제 vs Apple/Google IAP 분기 (ADR-015, ADR-019). 환경 indicator. | **🟢 P3 — Phase D 후반** |

---

## 3. 싱가폴 법인 implications

### 3.1 영향이 큰 5개 결정 의제

| # | 항목 | 현재 상태 | 싱가폴 법인 시 결정 사항 |
|---|---|---|---|
| 1 | **결제 통화** | `priceKrw: Int` (KRW 정수 only). DTO·DB 모두 KRW 가정. | (a) 다중 통화: `currency: 'KRW' \| 'SGD' \| 'USD'` + `priceCents: Int`. (b) USD 단일 base + display 환산. (c) KRW 유지. → ADR 필요. |
| 2 | **Admin UI 언어** | 한국어 only (모든 라벨 hardcoded). | 운영팀 KR/SG 혼합 시 EN 토글 필요. i18n 도입 시 모든 라벨 추출 작업 ~3일. |
| 3 | **IAP territory + 가격 매트릭스** | Apple Dev Program 1개 (KR territory only 가정). | 싱가폴 법인은 별도 Dev Account 권장. App Store Connect product 가격이 territory별로 자동 환산되는지 vs 수동 매트릭스 입력. ADR-019 §3 재검토. |
| 4 | **PDPA(SG) vs PIPA(KR) 동의** | PIPA 기반 marketing/push opt-in 2개 boolean. | PDPA는 명시적 동의 + 철회 절차 더 엄격. 동의 기록(`consent_records` 테이블) 신설 + 사용자 관리 화면에 동의 history viewer 필요. |
| 5 | **청소년 결제 한도 미들웨어** | KR 14세 미만 가입 차단만 구현(ADR-010 후속). 한도 미들웨어는 [법무 자문 브리프](../legal/youth-payment-limit-brief-ko.md) 답변 대기. | 싱가폴 법인은 **KR 사용자에게만** 한도 적용 — `user.country = 'KR'` 필드 필요. 또는 IP 기반 추정. |

### 3.2 즉시 영향 없는 항목 (관찰만)

- 데이터 거주 — staging/prod 모두 AWS Seoul 가정. 싱가폴 법인이 Singapore region 강제하는지는 PDPA 한국 cross-border 전송 규정과의 정합성 확인 필요(법무 추가 의제).
- 결제 PG — IAP만 쓰는 동안은 영향 없음. 향후 web 결제 추가 시 (예: 이니시스 KR vs Stripe SG) 재검토.

---

## 4. Phase D 구현 우선순위

[release notes Phase D 백로그](../implementation/phase-c-release-notes-ko.md#8-phase-d-백로그-adr-021에서-이송)
와 합쳐서 본 audit 항목까지 통합한 우선순위:

| 주차 | 항목 | 출처 |
|---|---|---|
| W1 (4/27~5/3) | **운영자 관리 페이지** + **사용자 관리 페이지(read-only)** + k6 50k staging 실측 + runbook | 본 audit P0 + RPT-260425 #1 |
| W2 (5/4~5/10) | 사용자 관리 write actions (suspend/withdraw/refund 채팅 쿠폰) + IAP 본 구현 (ADR-019 Phase 1) + Sentry 통합 (Telemetry 결정 후) | 본 audit P0 + RPT-260426 |
| W3 (5/11~5/17) | 거래 관리 페이지 (transaction lookup + refund) + leaderboard full cache (Lever 5 측정 의존) + Mobile useFandom retrofit 마감 | 본 audit P1 |
| W4~ | 감사 로그 + 시스템 상태 + 싱가폴 법인 다중 통화 ADR + i18n 결정 + 환경 토글 | 본 audit P2~P3 + 싱가폴 implications |

---

## 5. 첫 슬라이스 (이번 turn) — 운영자 관리 페이지 (read-only)

**왜 이걸 첫 구현으로**:
- 가장 작은 contained slice (백엔드 list endpoint 1개 + 프론트 페이지 1개)
- 싱가폴 법인 설립 시 즉시 필요 (운영팀 신규 추가)
- AdminUser 도메인 + repository는 이미 존재 (`prisma-admin-user.repository.ts`) — list 메서드만 추가하면 됨
- 기존 admin RBAC + JWT guard 재사용 — 새 인프라 0
- 향후 write actions (create / update role / suspend)을 같은 페이지에 incremental 추가 가능

**스코프**:
- Backend: `GET /admin/operators` — admin role only, AdminUser 전체 list
- Frontend: `/operators` 페이지 — 표 (이메일·displayName·role·status·lastLoginAt·createdAt)
- Nav: AppShell 좌측 메뉴에 "운영자 관리" 추가 (admin only — viewer/operator는 hidden)

**비스코프 (다음 슬라이스)**:
- Create / update role / suspend actions
- 운영자 비밀번호 reset
- audit log

---

## 6. 변경 이력

| 일자 | 내용 |
|---|---|
| 2026-04-26 | 초안. CMS 8 메뉴 audit + 6 gap + 싱가폴 5 implication. 첫 슬라이스 = 운영자 관리 read-only. |
| 2026-04-26 | 첫 슬라이스 landed — `GET /api/v1/admin/operators` (admin role only) + CMS `/operators` page + sidebar 메뉴(`adminOnly: true`). ITC-OPERATORS 4 integration tests (admin 200 / operator 403 / 미인증 401 / 다중 운영자 표시). 23 unit / **72 integration** (이전 67+4 + 보너스). CMS build 455 KB → 133 KB gzip. |
