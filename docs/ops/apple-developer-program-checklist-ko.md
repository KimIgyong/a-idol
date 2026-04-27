# Apple Developer Program 가입 · 설정 체크리스트

> T-046 Apple IAP 어댑터 구현(ADR-019)의 **외부 절차 블로커**. 코드
> 작업과 병렬 진행 가능. 담당 실행 순서대로 체크.
>
> Owner: Gray Kim · Created: 2026-04-23 · Target: Phase C W1 완료 (~5/4)

---

## 요약

| 단계 | 기간 (캘린더) | 비용 (USD) | 결과물 |
|---|---|---|---|
| 0. 사전 결정 | 1일 | — | 법인명 · 소유자 확정 |
| 1. 가입 신청 | 1~3일 | $99/년 (개인) · $99/년 (법인, D-U-N-S 선행) | Team ID 발급 |
| 2. 인증서 · 프로비저닝 | 반나절 | — | Development + Distribution cert, Bundle ID |
| 3. App Store Connect 앱 등록 | 1일 | — | App Store 노출 페이지 (심사 전 숨김) |
| 4. IAP 상품 등록 | 1일 | — | Apple SKU ↔ `purchase_products.sku` 매핑 |
| 5. Sandbox tester 계정 | 1시간 | — | 실기기 IAP 플로우 검증 가능 |
| **합계** | **약 1~2주** | **$99** | ADR-019 Phase 4 E2E unlock |

법인 가입 시 **D-U-N-S 번호 선취득**이 필요해 신청~발급 타임라인이
2배까지 늘어남. 본 체크리스트는 그 경로도 포함.

---

## 0. 사전 결정 (코드 외 · 즉시)

가입 형태에 따라 이후 모든 단계가 달라지므로 먼저 PO · 법무 확정.

- [ ] **계정 유형 결정**: Individual vs Organization
  - **Individual**: 앱 노출 명의가 개인 실명. 환불 · 세금 영수증도 개인.
    신청 단순 · D-U-N-S 불필요. 1~3일.
  - **Organization**: 앱 노출 명의가 회사명 ("Amoeba Group"). **D-U-N-S
    Number 필수** — 사업자등록번호 기반 자동 매칭 안 됨, Apple이
    별도 요구. 2주+ 가능.
  - **A-idol 권장**: Organization — 서비스 명의 · 매출 귀속 · 환불
    CS 경로 모두 회사 명의여야 일관됨. Individual로 가서 나중에
    승계하는 절차는 Apple이 공식 지원하지만 번거로움.
- [ ] **법적 명칭 확정**: App Store Connect 상 표시될 "Company/Entity
      Name"이 사업자등록증 상호와 **한 글자 한 글자** 일치해야 함.
      영문 표기 (예: "Amoeba Group Inc.")도 미리 정함.
- [ ] **Account Holder 지정**: Apple 계정의 최상위 권한자. 이후 다른
      멤버 invite · role 부여는 Holder만 가능. Holder 이양은 Apple
      지원 티켓 경유.
- [ ] **결제 수단**: $99/년 자동결제용 회사 신용카드 확정.

---

## 1. 가입 신청 (온라인)

### 1.1 (Organization 전용) D-U-N-S Number 확보

**현재 보유 여부 확인**: https://www.dnb.com/duns/lookup.html 에서
회사 영문 상호로 조회.

- [ ] **보유 중**: 번호 (9자리) 메모. Apple 신청서에 그대로 입력.
- [ ] **미보유**: D&B에 신청. 한국은 (주)한국기업데이터가 발급 대리.
  - 무료 경로: https://www.dnb.co.kr/ 또는 D&B 국제 홈 → "Get a
    Free D-U-N-S". 약 **30 영업일** 소요.
  - 유료 급행 (Expedited): 약 $229 · 5 영업일.
  - **정보 일관성 체크**: 상호·주소·전화번호가 사업자등록증과
    동일해야 Apple이 매칭. 불일치 시 apple 쪽에서 수 주 hold.

### 1.2 Apple Developer 계정 생성

- [ ] https://developer.apple.com/programs/enroll/ 접속
- [ ] **Apple ID** — 회사 명의 신규 이메일 강력 권장 (`developer@
      amoeba.group` 등). Account Holder의 개인 Apple ID와 분리.
- [ ] 2FA 설정 필수 — 복구용 전화번호 회사 명의.
- [ ] **엔롤먼트 폼**:
  - Entity Type: `Company/Organization`
  - Legal Entity Name: 사업자등록증 상호 (정확히)
  - D-U-N-S: 1.1에서 확보한 9자리
  - Headquarters Address: 사업자등록증 소재지
  - Phone: 대표 번호 (Apple이 인증 전화할 가능성)
- [ ] 결제 → $99 선승인. 심사 통과 전까지 실결제 안 됨.

### 1.3 Apple 심사 대기 (1~7 영업일)

- 한국 시간 기준 **오전 중 신청 → 다음 영업일 승인** 경향이 일반적.
- Apple 측 수동 검증: D-U-N-S 매칭 + 회사 유효성 + 신청자 권한.
- 불일치 발견 시: 이메일 요청 → D&B 정보 수정 → 재신청. 2주+ 추가.
- **대기 중 블로커**: 없음. 코드 작업(T-046 Phase 1-3) 병렬 진행.

**가입 완료 시 받는 자산**:
- Team ID (10자 알파벳, 예: `ABC1234DEF`)
- Apple Developer 포털 접근권
- App Store Connect 접근권

---

## 2. 인증서 · Bundle ID (Developer Portal)

모두 https://developer.apple.com/account 에서.

- [ ] **Bundle Identifier 등록**:
  - Certificates, IDs & Profiles → Identifiers → **+** → App IDs
  - Bundle ID: `group.amoeba.aidol` (**역 DNS 포맷**, 팀 내 유일)
  - Capabilities — IAP는 기본 포함. 별도 enable 불필요.
- [ ] **Apple Development Certificate**: 로컬 빌드 서명용.
  - macOS → Xcode → Preferences → Accounts → Apple ID 로그인 →
    "Manage Certificates" → `+` → "Apple Development" 자동 생성.
- [ ] **Apple Distribution Certificate**: TestFlight · App Store 업로드용.
  - 동일 경로 → "Apple Distribution".
- [ ] **Provisioning Profiles**: Xcode가 자동 관리 (Automatic signing)
      권장. CI에서는 EAS Build가 대신 생성.

### 중요 보안 포인트

- **Distribution cert의 private key**는 1개만 발급 — 분실 시 모든
  pending 빌드 재서명 필요. macOS 키체인 + 오프라인 백업(USB) 2곳 보관.
- Cert expiry: Distribution은 1년. 만료 30일 전 Apple 이메일 발송 →
  대응 안 하면 기존 TestFlight 빌드 실행 불가. 캘린더 알림 설정.

---

## 3. App Store Connect 앱 등록

### 3.1 앱 레코드 생성

- [ ] https://appstoreconnect.apple.com → My Apps → `+` → New App
- [ ] Platform: iOS
- [ ] Name: "A-idol" (App Store 표시명 — 30자 이내, 특수문자 제한)
- [ ] Primary Language: Korean
- [ ] Bundle ID: 2단계에서 등록한 `group.amoeba.aidol` 선택
- [ ] SKU (내부 식별용): `aidol-ios-001`
- [ ] User Access: Full Access 또는 Limited (팀원 권한 제한용)

### 3.2 App 정보 기입 (심사 직전에 마무리, 지금은 skeleton)

- [ ] 카테고리: Entertainment (or Lifestyle)
- [ ] 연령 등급: **4+** 또는 **9+** — 채팅 필드 때문에 `Infrequent/Mild Mature/Suggestive Themes` 체크 가능성 높음. 법무 검토 후 확정.
- [ ] 개인정보 처리방침 URL: `https://a-idol.app/privacy` (별도 페이지 준비 필요)
- [ ] **App Privacy** (data collection 공시): 수집 항목 전체 신고
      — 이메일, 생년월일, 기기 ID, 결제 영수증 등. 누락 시 심사 반려.

---

## 4. In-App Purchase 상품 등록

ADR-015 seed의 SKU와 Apple App Store Connect의 Product ID를 **1:1 매칭**.

각 상품에 대해:

- [ ] App Store Connect → 앱 선택 → "In-App Purchases" 탭 → `+`
- [ ] Type: **Consumable** (모든 MVP 상품 해당 — 채팅 쿠폰 · 투표권 · 포토카드 팩)
- [ ] Reference Name (Apple 내부용): seed SKU 그대로 사용 (`chat-coupon-10` 등)
- [ ] **Product ID** (JWS payload에 담길 id): `group.amoeba.aidol.chat_coupon_10` 식 역 DNS + 언더바. 이 값이 `AppleTransactionInfo.productId`에 와서 `purchase_products.sku`와 매칭될 수 있도록 DB에 저장 형식 정렬.
- [ ] Pricing: 국가/지역별 가격 — Tier 1 (₩1,100 ≒ $0.99)부터 고르기.
      한국 원화 고정 틱가격표 참조.
- [ ] Localizations: 한국어 + 영어 이름·설명 (각 상품별).
- [ ] Review Notes: "가챠 요소 포함" 명시 (심사관 필수 확인 포인트).

### 매핑 테이블 (참조용)

| Apple Product ID | 내부 SKU | 타입 |
|---|---|---|
| `group.amoeba.aidol.chat_coupon_10` | `chat-coupon-10` | CHAT_COUPON |
| `group.amoeba.aidol.chat_coupon_30` | `chat-coupon-30` | CHAT_COUPON |
| `group.amoeba.aidol.chat_coupon_100` | `chat-coupon-100` | CHAT_COUPON |
| `group.amoeba.aidol.vote_ticket_10` | `vote-ticket-10` | VOTE_TICKET |
| `group.amoeba.aidol.vote_ticket_50` | `vote-ticket-50` | VOTE_TICKET |
| `group.amoeba.aidol.photocard_pack_5` | `photocard-pack-5` | PHOTOCARD_PACK |
| `group.amoeba.aidol.photocard_pack_10` | `photocard-pack-10` | PHOTOCARD_PACK |

**구현 참고**: `AppleReceiptVerifier.verify()`가 반환하는
`AppleTransactionInfo.productId`는 Apple 형식(`group.amoeba...`)이고
서버의 `purchase_products.sku`는 내부 형식(`chat-coupon-10`)이므로
둘을 매핑하는 레이어 필요. 옵션 두 가지:

(a) `purchase_products`에 `apple_product_id` 컬럼 추가 · 생성 시 양쪽 값.
(b) 문자열 변환 함수 (`group.amoeba.aidol.chat_coupon_10` → `chat-coupon-10`).

**권장 (a)** — 앱스토어 등록명은 운영 도중 바뀔 수 있고, 명확한 FK가
debugging이 훨씬 쉬움. Prisma 마이그레이션 1 column add로 끝.

---

## 5. Sandbox Tester 계정

실제 카드 결제 없이 IAP 플로우 검증.

- [ ] App Store Connect → Users and Access → Sandbox → `+`
- [ ] 생성 필드:
  - First/Last Name: 테스트용 가명
  - Email: **개발자 Apple ID와 무관한 신규 이메일** (기존 Apple ID
    절대 재사용 금지 — 부모의 결제 수단과 엮이면 실결제 발생 위험)
  - Password: 최소 8자, 숫자+특수문자
  - Country/Region: South Korea (가격대 일치시키려면)
  - Secret Question: 자유
- [ ] 실기기 설정:
  - iOS 기기 → 설정 → App Store → 아래로 스크롤 → "Sandbox Account"
  - 생성한 Sandbox 계정으로 로그인 (실 Apple ID는 건드리지 말 것)
- [ ] 앱 빌드 → TestFlight or Xcode 직접 배포 → 구매 시도 → sandbox
      결제 화면 뜸 → "Buy" → 0원 결제 완료.

### 중요

- Sandbox 결제는 실제 청구 없음. 카드 정보 미입력.
- Sandbox 영수증 JWS는 `environment: "Sandbox"` 필드 반드시 포함 —
  `JoseAppleReceiptVerifier`가 env 일치 검사에 사용 (ADR-019 §6).
- **Sandbox ↔ Production 크로스 사용 금지** — env 필드로 우리 서버가
  거부함 (설계 의도).

---

## 6. Phase 1 IAP 구현과의 매핑

| 체크리스트 단계 | 해당 ADR-019 Phase | 코드 착수 가능 시점 |
|---|---|---|
| 0~1 (가입 대기) | — | 병렬로 Phase 1 (verifier 인터페이스 · 스텁) 진행 가능 — 이미 완료 |
| 2 (Bundle ID · 인증서) | — | Phase 2 (webhook) 준비 가능 |
| 3 (앱 등록) | — | Phase 4 (App Store Connect 등록) — 대기 |
| 4 (IAP 상품 등록) | — | `apple_product_id` 컬럼 마이그레이션 가능 |
| 5 (Sandbox tester) | Phase 4 | 실기기 E2E unlock |

**총 unblock 기준**: 0~5 완료 시 ADR-019 Phase 4 (샌드박스 → 리프레쉬
→ 리펀드 E2E) 실행 가능. Phase 1~3의 코드 작업은 이 체크리스트 진행
과 **거의 완전히 병렬**.

---

## 7. 흔한 함정 · FAQ

**Q. D-U-N-S 신청 후 몇 주를 기다려야 하나?**
A. 평균 30영업일. 금융·의료는 더 걸림. Apple 신청은 D-U-N-S 확정 후
출발.

**Q. Individual로 출시한 뒤 Organization으로 승계 가능?**
A. 가능하지만 Apple 지원 티켓 경유 + 심사 + 앱 이관 1주+. 권장 안 함.

**Q. Team ID는 앱 코드에서 쓰이나?**
A. 직접 쓰지 않음. 서명 시 Xcode/EAS가 인증서에서 추출. **JWS
   검증에서도** 보통 `appAppleId`(숫자, App Store Connect에서 발급)
   쓰지만 MVP는 검증 안 함 — ADR-019가 bundle ID 매칭만.

**Q. 상품 이름 언어별 추가 안 하면?**
A. 심사 반려. 최소 **기본 언어 (Korean)** 필수.

**Q. Sandbox 테스트 결제 실패 "Your session has expired" 반복?**
A. 실기기 설정 → App Store → Sign Out → 재로그인. Xcode
   preview/시뮬레이터는 IAP 지원 안 함 — **실기기 필수**.

**Q. 앱 심사 대기 없이 TestFlight만 쓰면 IAP 동작하나?**
A. TestFlight = Sandbox 환경 자동. Production 결제는 App Store
   Review + approval 후만 가능.

---

## 8. 체크 진행 상황

| 단계 | 상태 | 담당 | 완료일 |
|---|---|---|---|
| 0. 사전 결정 | ⬜ | PO | |
| 1. D-U-N-S 조회/신청 | ⬜ | PO | |
| 1. Apple Developer 가입 신청 | ⬜ | Gray Kim | |
| 1. 가입 승인 수신 | ⬜ | Apple | |
| 2. Bundle ID 등록 | ⬜ | Gray Kim | |
| 2. 인증서 발급 | ⬜ | Gray Kim | |
| 3. App Store Connect 앱 레코드 | ⬜ | Gray Kim | |
| 4. IAP 상품 7개 등록 | ⬜ | Gray Kim | |
| 4. `apple_product_id` 컬럼 마이그레이션 | ⬜ | Gray Kim | |
| 5. Sandbox tester 계정 | ⬜ | Gray Kim | |
| 5. 실기기 IAP 플로우 테스트 | ⬜ | Gray Kim | |

---

## 9. 관련 문서

- [ADR-019](../adr/ADR-019-apple-iap-adapter.md) — 어댑터 설계
- [ADR-015](../adr/ADR-015-commerce-dev-sandbox.md) — commerce 포트/어댑터
- [Phase C 체크리스트](../implementation/phase-c-checklist.md) — 리스크 #1
- [Runbook §4.2](./runbook-ko.md) — IAP webhook 장애 대응

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-23 | 초안 작성 |
