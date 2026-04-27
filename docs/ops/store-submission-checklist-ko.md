# App Store / Google Play 제출 체크리스트 (T-085)

> **GA Target**: 2026-08-01. 평균 심사 1~7일 + 거절 가능성 고려 → **2026-07-15까지 1차 제출 권장**.
>
> Apple Developer Program / Google Play Console 가입 절차는 별도 [`apple-developer-program-checklist-ko.md`](./apple-developer-program-checklist-ko.md) 참조.
>
> Owner: Gray Kim · Last updated: 2026-04-27

---

## 0. 마일스톤

| 단계 | 권장 일정 | 책임 |
|---|---|---|
| **0.1** Privacy Policy / Terms 법무 검수 | 2026-06-30 | 법무 + PO |
| **0.2** 스크린샷 + 마케팅 자료 디자인 | 2026-07-01~07 | 디자인 + PO |
| **0.3** Apple Developer / Play Console 가입 + IAP 상품 등록 | 2026-07-08까지 | DevOps |
| **0.4** 1차 제출 | **2026-07-15** | 엔지니어링 |
| **0.5** 심사 통과 + 1차 거절 시 재제출 (1주 buffer) | 2026-07-16~22 | 엔지니어링 |
| **0.6** GA 출시 | **2026-08-01** | All hands |

**GA 단축(8-29 → 8-01)으로 buffer 4주 → 1주로 압축**. 거절 1회 이상 발생 시 GA 재조정 필수.

---

## 1. Apple App Store

### 1.1 App Store Connect 메타데이터

| 필드 | 값 / 작성 가이드 | 비고 |
|---|---|---|
| App Name | `A-idol` (영문 25자 내) | 한국어 별칭은 `A-아이돌` 검토 |
| Subtitle | `AI 아이돌 팬덤 플랫폼` (30자) | — |
| Bundle ID | `app.a-idol.mobile` (가칭, 확정 후 EAS update) | — |
| Primary Category | Entertainment | 음악(Music)도 후보 |
| Secondary Category | Social Networking | — |
| Age Rating | **12+** | 채팅 + IAP 결제 + 청소년 한도 (POL-006) |
| Price | Free + IAP | — |
| Languages | Korean (primary), English | i18n: ko/en/vi/zh-CN 중 시장 따라 |

### 1.2 IAP (인앱 결제) 상품

기존 [`apple-developer-program-checklist-ko.md`](./apple-developer-program-checklist-ko.md) 4번 참조. 본 슬라이스에서는 SKU 매핑만 재확인:

| 우리 `purchase_products.sku` | Apple SKU (예시) | Type |
|---|---|---|
| `vt-10` | `app.aidol.votes.10` | Consumable |
| `vt-100` | `app.aidol.votes.100` | Consumable |
| `chat-coupon-10` | `app.aidol.chat.10` | Consumable |
| `chat-coupon-50` | `app.aidol.chat.50` | Consumable |
| `pcpack-hyun-1st` | `app.aidol.pcpack.hyun01` | Consumable |

(전체 9개 상품, [seed.ts](../../packages/backend/prisma/seed.ts) 참조)

### 1.3 App Store **Privacy Manifest** (PrivacyInfo.xcprivacy)

iOS 17+ 필수. **수집 데이터 카테고리**:

| 카테고리 (Apple 분류) | 우리 사용 | 목적 | 광고/추적 |
|---|---|---|---|
| **Contact Info** (Email, Name) | ✅ | 계정 인증 | ❌ |
| **User Content** (Other User Content — 채팅, 응원댓글, 사진) | ✅ | 핵심 기능 | ❌ |
| **Identifiers** (User ID — 우리 `User.id`) | ✅ | 계정 인증, Analytics | ❌ |
| **Identifiers** (Device ID — IDFA) | ❌ | 미사용 | ❌ |
| **Usage Data** (Product Interaction) | ✅ | 분석 + 개선 | ❌ |
| **Diagnostics** (Crash Data, Performance Data) | ✅ | 안정성 | ❌ |
| **Purchases** (Purchase History) | ✅ | IAP 영수증 검증 | ❌ |
| **Location** | ❌ | 미사용 | ❌ |
| **Health & Fitness** | ❌ | 미사용 | ❌ |
| **Sensitive Info** (정치/종교/...) | ❌ | 미사용 | ❌ |

**추적 (App Tracking Transparency)**: 모든 항목 OFF. 광고 추적 식별자(IDFA) 미사용 — `NSUserTrackingUsageDescription` 불필요.

**Required Reason API Declarations** (iOS 17+):
- `NSPrivacyAccessedAPICategoryUserDefaults` — Reason: `CA92.1` (앱 자체 설정 저장 — 5테마 선택, view-mode 등)
- `NSPrivacyAccessedAPICategoryFileTimestamp` — Reason: `C617.1` (Expo 캐시)
- `NSPrivacyAccessedAPICategoryDiskSpace` — Reason: `E174.1` (이미지 캐시 관리)
- `NSPrivacyAccessedAPICategorySystemBootTime` — Reason: `35F9.1` (Reanimated 시스템 측정)

[샘플 PrivacyInfo.xcprivacy 파일은 EAS build pre-action 으로 생성 — Phase 추가 슬라이스]

### 1.4 스크린샷 (App Store Screenshots)

**필수 사이즈** (iOS 17+, App Store Connect 요구):

| 디바이스 | 해상도 | 매수 |
|---|---|---|
| iPhone 6.7" Display (iPhone 15 Pro Max) | 1290 × 2796 | 3~10장 권장 6장 |
| iPhone 6.5" Display (iPhone 11 Pro Max) | 1242 × 2688 | 동일 (6.7 자동 swap 가능) |
| iPad Pro 12.9" Display (3rd gen) | 2048 × 2732 | iPad 지원 시 6장 |

**제작 콘텐츠** (5테마 중 blue 라이트 모드 통일):
1. 홈 피드 (인기순 grid2 view) — "최애 아이돌을 만나세요"
2. 아이돌 상세 + 응원댓글 — "응원하고 채팅으로 이어집니다"
3. 채팅 화면 (live region 메시지) — "AI 아이돌과 진짜 대화"
4. 오디션 dashboard — "주간 오디션 + 실시간 leaderboard"
5. 가챠 카드 reveal — "포토카드 컬렉션을 시작하세요"
6. 마이페이지 hub — "나만의 팬덤 활동 한눈에"

### 1.5 App Privacy 답변

App Store Connect → "App Privacy" 섹션에서 wizard 답변:
- **Do you or your third-party partners collect data?** Yes
- **Used to track you?** No (모든 데이터)
- 각 카테고리별 Linked to User: Yes (계정 인증과 결합되므로)

---

## 2. Google Play Console

### 2.1 Store Listing

| 필드 | 값 |
|---|---|
| App Name | `A-idol — AI 아이돌 팬덤` (50자) |
| Short description | `최애 아이돌과 채팅하고, 응원하고, 포토카드를 모으세요.` (80자) |
| Full description | (5,000자 한도) — 마케팅 카피, FR-XXX 기능 매핑 |
| Category | Entertainment > Music & Audio (또는 Social) |
| Tags | 팬덤, 아이돌, AI, 채팅, 포토카드 |

### 2.2 Content Rating

IARC 자가 진단 — 예상 등급 **PEGI 12 / ESRB Teen / GRAC 12세 이용가**:
- 채팅(자유 텍스트 입력) → 12+
- IAP + 가챠 + 청소년 결제 한도(POL-006) → 결제 disclosure 강조

### 2.3 Data Safety Form

Google Play 자체 form (Apple 의 Privacy Manifest 와 별도 동등):

| 데이터 유형 | 수집 | 공유 | 처리 위치 | 사용자 삭제 가능 |
|---|---|---|---|---|
| Email address | ✅ | ❌ | Server | ✅ (탈퇴) |
| User IDs | ✅ | ❌ | Server | ✅ |
| Photos | ❌ | — | — | — |
| Audio | ❌ | — | — | — |
| Files / docs | ❌ | — | — | — |
| Calendar | ❌ | — | — | — |
| Contacts | ❌ | — | — | — |
| App activity (Page views, Search history) | ✅ | ❌ | Server | ✅ |
| App info & performance (Crash logs) | ✅ | ❌ | Server | ❌ (자동 만료) |
| Device or other IDs | ❌ | — | — | — |
| Purchase history | ✅ | ❌ | Server (5y 법정 보유) | ❌ (법정 의무) |
| Financial info (전체 카드번호 등) | ❌ | — | — | — |

**Encryption in transit**: ✅ HTTPS (HSTS) · **Encryption at rest**: ✅ Postgres + Redis encryption (RDS / ElastiCache 옵션)
**Data deletion mechanism**: in-app account deletion ([`cs-workflow-ko.md`](../support/cs-workflow-ko.md) §2 참조)

### 2.4 IAP 상품 (Play Console)

Apple SKU 와 분리. 권장 매핑 — 동일 sku 명을 Play SKU 로도 사용:

```
google_play_skus = {
  "vt-10": "app.aidol.votes.10",
  "chat-coupon-10": "app.aidol.chat.10",
  "pcpack-hyun-1st": "app.aidol.pcpack.hyun01",
  // ...
}
```

ADR-019 의 Apple 어댑터와 별개 Google Play Billing 어댑터 구현 필요 (Phase 후속).

### 2.5 스크린샷 (Play Listing)

| 디바이스 | 해상도 | 매수 |
|---|---|---|
| Phone | 1080 × 1920 minimum (16:9 또는 9:16) | 2~8장 권장 6장 |
| Tablet (선택) | 7" / 10" | tablet 지원 시 |

**Feature graphic**: 1024 × 500 (1장, 마케팅 배너)

콘텐츠는 §1.4 와 동일 (Apple 과 디자인 통일).

---

## 3. 공통 자료

### 3.1 Privacy Policy (개인정보 처리방침)

- 한국어 + 영어 2 버전 호스팅 (예: `https://a-idol.app/privacy`).
- 법무 작성 + 검수 — 항목:
  - 수집 항목: email, nickname, birthdate, password (해시), device ID
  - 보유 기간: 30일 (탈퇴 후), 결제 이력 5년 (법정)
  - 제3자 제공: 없음 (IAP 검증을 위한 Apple/Google 통신 외)
  - 사용자 권리: 열람·정정·삭제·이동·동의 철회
  - 접근 권한: support@a-idol.app
- 청소년 결제 한도(POL-006) 명시 — [`docs/legal/youth-payment-limit-brief-ko.md`](../legal/youth-payment-limit-brief-ko.md) 참조

### 3.2 Terms of Service (이용약관)

법무 작성 + 검수 — 항목:
- 서비스 정의 + 가입 자격 (만 14세 이상)
- 이용자 의무 + 금지 행위
- 콘텐츠 권리 (사용자 콘텐츠 + 회사 콘텐츠 분리)
- 결제 + 환불 정책 ([`cs-workflow-ko.md`](../support/cs-workflow-ko.md) §1)
- 면책 + 분쟁 해결
- 개정 이력

### 3.3 환불 정책 (Refund Policy)

별도 페이지 또는 ToS §결제 안에 통합. CS 운영 정책 ([`cs-workflow-ko.md`](../support/cs-workflow-ko.md))과 정합.

---

## 4. 1차 제출 전 회귀 체크리스트

- [ ] CMS build green ([`pnpm --filter @a-idol/cms build`](../../packages/cms/))
- [ ] Mobile EAS build (iOS + Android) 성공
- [ ] TestFlight Internal Testing 1주 회귀 (5명 이상 internal tester)
- [ ] Play Console Internal Testing 1주 회귀
- [ ] Backend ITC 전체 PASS
- [ ] `make smoke` 통과 (signup→login→/me)
- [ ] IAP sandbox 결제 1회 성공 (양쪽 스토어)
- [ ] privacy policy + ToS URL 접근 가능
- [ ] support@a-idol.app 메일함 수신 가능
- [ ] [`runbook-ko.md`](./runbook-ko.md) 배포 체크리스트 전 항목 OK

---

## 5. 거절 사유 우선 점검 (Apple)

App Store Review Guidelines 빈출 거절 사유:

| Guideline | 우리 risk | 완화 |
|---|---|---|
| 1.1.6 (Inappropriate Content) | AI 아이돌 페르소나 — 부적절 콘텐츠 가능성 | CMS 모더레이션 + auto-message 검수 |
| 2.1 (App Completeness) | placeholder/dummy data | Pre-submit smoke 시 99 시드 데이터 노출 |
| 2.3.10 (Bait-and-Switch) | 가챠 확률 미공개 | ADR-016 확률 공개 — 상점 + 가챠 화면 모두 노출 |
| 3.1.1 (IAP) | 외부 결제 우회 | Apple IAP 만 사용 — ADR-019 |
| 3.1.2 (Subscription) | 자동 갱신 sub 미사용 | 모든 IAP는 Consumable, sub 형태 미사용 (확실히) |
| 4.0 (Design) | 5테마 중 일부 가독성 | text3 contrast 한도 — [a11y baseline](./a11y-mobile-baseline-ko.md) §5.2 |
| 5.1.1 (Privacy) | Privacy Manifest 누락 | iOS 17+ 필수 — §1.3 작성 |
| 5.1.1(v) (계정 삭제) | self-service account deletion | Phase 2 백로그 — GA 시점은 이메일 요청 (수동), 명시 필요 |

---

## 6. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-27 | 초안 작성 — Apple/Play 양쪽 메타데이터 + Privacy Manifest + Data Safety Form + 스크린샷 specs + 1차 제출 체크리스트 + 거절 사유 점검. **2026-07-15 1차 제출 권장**으로 GA(8-01) 일정 정렬. |
