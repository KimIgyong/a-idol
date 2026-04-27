# 의존성 승인 요청: `jose` + Apple Root CA G3

**청구자**: Gray Kim · **수령**: PO · **날짜**: 2026-04-23 · **의사결정 기한**: 2026-05-04 (W2 구현 착수 전)

---

## 요청 요약

[ADR-019 Apple IAP 어댑터](../adr/ADR-019-apple-iap-adapter.md) Phase 1 week 2 구현을 위해 두 가지 **단일 승인 항목**을 요청합니다:

1. **npm 런타임 의존성 추가**: `jose@^5` (백엔드 패키지에만)
2. **바이너리 커밋**: Apple Root CA G3 인증서 (약 1 KB `.cer` 파일) → `packages/backend/src/modules/commerce/infrastructure/apple-root-ca-g3.cer`

승인되면 약 5분 작업 (`pnpm add jose --filter @a-idol/backend` + 파일 1개 커밋). 반려되면 대안 검토 후 재요청.

---

## 왜 필요한가

ADR-019 §1에서 Apple StoreKit v2 JWS 검증을 **오프라인으로** 수행하기로 결정 (레거시 `/verifyReceipt` REST 호출 거부, 200ms 지연 회피). 이를 위해서는:

- JWS (JSON Web Signature) compact 포맷 파싱 + 서명 검증
- `x5c` 헤더에 담긴 인증서 체인을 Apple 루트 CA까지 검증
- ECDSA P-256 (ES256) 알고리즘 지원
- 체인 최상단을 Apple이 공개한 루트 인증서와 대조

Node 기본 `crypto`는 개별 서명 검증은 가능하지만 JWS 포맷 파싱과 체인 검증을 직접 구현하려면 ~300 LOC + 보안 감사 부담. `jose`는 이 전체를 표준 구현으로 제공.

---

## `jose` 라이브러리 프로필

| 항목 | 내용 |
|---|---|
| 패키지 | `jose` (npm) |
| 유지보수 | Filip Skokan (핵심 기여자) + PR 커뮤니티 · [github.com/panva/jose](https://github.com/panva/jose) |
| License | **MIT** |
| 런타임 의존성 수 | **0** (pure JS, Node 표준 `crypto` + `buffer`만 사용) |
| 번들 크기 | ~130 KB un-minified · ESM/CJS 듀얼 빌드 |
| 사용 규모 | 주간 npm 다운로드 ~50M (2026 기준) · OpenAI, Auth0 공식 예제 |
| TypeScript | native 지원 (내장 타입) |
| CVE 이력 | 최근 3년 치명적 CVE 0건 ([Snyk DB](https://security.snyk.io/package/npm/jose)) |

---

## 거부된 대안

1. **`jsonwebtoken`** — 이미 간접 포함 (`@nestjs/jwt`가 의존). JWS compact 검증은 되지만 `x5c` 체인 검증 미지원, 수동 구현 필요. 200+ 추가 LOC.
2. **`node-jose`** — 원조 JOSE 구현. 마지막 릴리스 2022년 6월, 사실상 abandonware.
3. **Node `crypto` + 수동 ASN.1 파싱** — 체인 검증을 직접. 암호학 코드 직접 작성 — 감사 부담.
4. **Apple `/verifyReceipt` REST 호출** — ADR-019 §Rejected-1에서 이미 기각 (deprecated + 200ms latency + shared secret 관리).

---

## 격리 계획 (bounded surface)

- **Import 위치 1곳만**: `packages/backend/src/modules/commerce/infrastructure/jose-apple-receipt-verifier.ts`
- **Export 없음**: 구현 파일 외부는 `AppleReceiptVerifier` 포트 (ADR-019 §1)만 의존. 나머지 코드베이스는 `jose` 존재 모름.
- **테스트에서도 간접 사용**: `AppleReceiptVerifier` 인터페이스 기반 mock으로 충분. unit 테스트가 jose API에 직접 의존하지 않음.
- **Rollback 비용**: 승인 후 문제 발생 시 `pnpm remove jose` + 구현 파일 삭제 + 스텁 복구 → 5분.

---

## Apple Root CA G3 바이너리

- **출처**: [Apple PKI 공식 배포](https://www.apple.com/certificateauthority/)
- **파일명**: `AppleRootCA-G3.cer` (DER format)
- **크기**: ~1,070 bytes
- **유효기간**: 2040-12-10까지 (15년 이상 남음)
- **SHA-256 pin (예정)**: 커밋 시 구체 해시값을 PR 설명에 기록
- **커밋 위치**: `packages/backend/src/modules/commerce/infrastructure/apple-root-ca-g3.cer`
- **읽기 방식**: `fs.readFileSync` 빌드 시점 1회 → in-memory 보관 → JWS 체인 검증의 trust anchor

### 보안 프로세스

- Apple이 루트 인증서를 회전할 일은 **2040년까지 없음** (발급 시 선언). 그 전 변경 필요성 발생 시 ADR 업데이트 + 새 파일 커밋.
- 커밋 시 SHA-256 해시를 코드 상수로도 박아두고 **런타임 시작에 파일 해시 대조** (ADR-019 §Consequences-Negative 완화 항목).
- 바이너리를 Git에 직접 저장 → 공급망 공격 면역 (npm tarball이 아닌 커밋 내 직접 파일).

---

## 리스크 + 대응

| 리스크 | 대응 |
|---|---|
| jose major 업그레이드 시 breaking API | `^5`로 메이저 핀. 새 메이저는 ADR 업데이트 후 별도 PR. |
| CVE 공개 | Dependabot + Renovate가 자동 PR (추후 설정). 현재 수동 `pnpm audit` 주간. |
| 번들 크기 증가 (130 KB) | 백엔드 서버 런타임 전용이라 클라이언트 번들 무관. 서버 메모리 영향 무시할 수준. |
| 공급망 공격 (npm) | `pnpm-lock.yaml` 커밋 + `@pnpm/lockfile-file-commit-verify` 추후 CI 도입. |

---

## 승인 요청

PO, 다음 항목에 대해 `approve` / `reject` / `ask question`으로 응답 바람:

- [ ] **런타임 의존성** `jose@^5` 백엔드에 추가
- [ ] **Apple Root CA G3 바이너리** (`.cer`, ~1 KB) 저장소에 커밋
- [ ] 승인 후 즉시 `pnpm add jose --filter @a-idol/backend` + 파일 커밋 실행

반려 시 대안 재검토 (ADR-019 재작성 범위) 필요 — 런웨이 ~3일 손실 예상.

---

## 승인 후 action items

1. `pnpm add jose --filter @a-idol/backend`
2. Apple PKI 페이지에서 `AppleRootCA-G3.cer` 다운로드 → 커밋
3. SHA-256 해시 확인 후 코드 상수에 박기
4. `JoseAppleReceiptVerifier` 구현 (ADR-019 Phase 1 week 2 착수)
5. 스텁 대체 (CommerceModule `useClass` 한 줄 변경)
6. TC-IAP-003..006 unit test 작성 (valid / expired / cross-env / tampered)

---

## 관련 문서

- [ADR-019 Apple IAP 어댑터 스펙](../adr/ADR-019-apple-iap-adapter.md)
- [Apple Developer Program 체크리스트](./apple-developer-program-checklist-ko.md)
- [Phase C 체크리스트 리스크 #1](../implementation/phase-c-checklist.md)

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-23 | 초안 작성 — PO 승인 대기 |
