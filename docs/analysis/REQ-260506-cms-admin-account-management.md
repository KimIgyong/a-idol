# REQ-260506 — CMS 어드민 계정 관리 (신규 추가 · 역할 변경)

- 작성일: 2026-05-06
- 작성자: Gray Kim
- 상태: 분석 완료 (PLN 승인 대기)
- 관련 FR: **FR-101 확장** (RBAC 운영 기능 신규) · 신규 FR-102 후보
- 관련 ADR: ADR-010 (User vs AdminUser 분리), ADR-023 (Request DTO snake_case 마이그레이션)
- 관련 정책: POL-010 (Admin Access Policy)

---

## 1. 배경 (Why)

A-idol CMS 운영팀은 `admin / operator / viewer` 3단계 역할로 구성된다. 현재 백엔드는 인증/인가 인프라(JWT 가드, `RolesGuard`, `@Roles()` 데코레이터)와 목록·계정 락 해제 엔드포인트까지 구현되어 있으나, **운영자가 새로운 어드민 계정을 만들거나 기존 계정의 역할을 변경할 수 있는 기능이 없다.** 현재는 Prisma seed 또는 DB 직접 조작으로만 계정을 생성·변경할 수 있어 운영팀 자력 운용이 불가능하다.

CMS 패키지(`packages/cms`)는 Phase D에서 본격 구현 예정이지만, 백엔드 API는 선행 구축이 필요하다.

## 2. AS-IS 현황 분석

### 2.1 데이터 모델 (구현 완료)
[packages/backend/prisma/schema.prisma:44-57](packages/backend/prisma/schema.prisma#L44-L57)
```prisma
model AdminUser {
  id            String      @id @default(uuid()) @db.Uuid
  email         String      @unique @db.VarChar(120)
  passwordHash  String      @map("password_hash")
  displayName   String      @map("display_name") @db.VarChar(40)
  role          AdminRole   @default(operator)   // admin | operator | viewer
  status        AdminStatus @default(active)      // active | suspended
  lastLoginAt   DateTime?   @map("last_login_at")
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")
  sessions      AdminAuthSession[]
  @@map("admin_users")
}
```
→ **신규 컬럼 추가 없이 기능 구현 가능.**

### 2.2 인증/인가 인프라 (구현 완료)
- `AdminJwtAuthGuard` ([shared/guards/admin-jwt.guard.ts](packages/backend/src/shared/guards/admin-jwt.guard.ts)) — Bearer 토큰 파싱, `req.admin = {id, role}` 주입.
- `RolesGuard` ([shared/guards/roles.guard.ts](packages/backend/src/shared/guards/roles.guard.ts)) — `@Roles()` 메타데이터 검증.
- 적용 패턴: 컨트롤러 클래스 레벨 `@UseGuards(AdminJwtAuthGuard, RolesGuard)` + 메서드 레벨 `@Roles('admin')`.
- 비밀번호 해싱: identity 모듈의 `BcryptPasswordHasher`를 admin-ops 모듈에서 DI 토큰 `PASSWORD_HASHER`로 재사용 ([admin-ops.module.ts:44](packages/backend/src/modules/admin-ops/admin-ops.module.ts#L44)).

### 2.3 기존 admin-ops 엔드포인트
| Method | Path | 역할 제한 | 상태 |
|---|---|---|---|
| POST | `/api/v1/admin/auth/login` | 공개(throttle 10/min) | ✅ |
| POST | `/api/v1/admin/auth/refresh` | 공개 | ✅ |
| POST | `/api/v1/admin/auth/logout` | 인증 필요 | ✅ |
| GET  | `/api/v1/admin/me` | 인증 필요 | ✅ |
| GET  | `/api/v1/admin/operators` | admin only | ✅ |
| POST | `/api/v1/admin/operators/unlock-account` | admin only | ✅ |
| GET  | `/api/v1/admin/analytics/overview` | admin / operator | ✅ |

### 2.4 시드 부트스트랩
[packages/backend/prisma/seed.ts:356-359](packages/backend/prisma/seed.ts#L356-L359) — `admin@a-idol.dev` 계정을 `admin` 역할로 upsert.

### 2.5 트레이스빌리티 매트릭스 현황
[docs/design/a-idol-req-definition.md:103-104](docs/design/a-idol-req-definition.md#L103-L104)
- **FR-100** Admin login — ✅ 완료
- **FR-101** RBAC (admin/operator/viewer) — ✅ 완료(가드/인가 정책)
- **FR-102 (신규)** Admin user lifecycle (CRUD) — ⬜ 미정의

## 3. TO-BE 요구사항

### 3.1 기능 요구사항

**FR-102-A: 신규 어드민 계정 생성** (운영자 직접 입력 방식 — 2026-05-06 확정)
- **방식**: 이메일 초대(magic link) 흐름 **없음**. admin 운영자가 CMS에서 직접 이메일·비밀번호·역할을 입력하여 즉시 활성 상태로 계정을 생성. 신규 사용자는 발급받은 비밀번호로 즉시 로그인 가능.
- 입력: `email` (이메일 형식, unique), `display_name` (1–40자), `password` (정책 준수), `role` (`admin` | `operator` | `viewer`)
- 처리: 이메일 중복 검증 → 비밀번호 정책 검증 → bcrypt 해시 → DB 저장(`status=active`) → 응답
- 인가: **admin 역할만 호출 가능**
- 응답: 생성된 AdminUser DTO (camelCase, passwordHash 미노출)
- 비밀번호 전달: 본 작업 범위에서는 운영자 ↔ 신규 사용자 간 **out-of-band** (구두 / 사내 메신저 등). 안전 채널은 운영 정책 책임. 첫 로그인 강제 변경 / 이메일 발송은 후속 작업.

**FR-102-B: 기존 어드민 역할 변경**
- 입력: `id` (path param), `role` (`admin` | `operator` | `viewer`)
- 처리: 대상 존재 검증 → 정책 위반 검증(아래 3.3) → role 업데이트 → 응답
- 인가: **admin 역할만 호출 가능**
- 응답: 갱신된 AdminUser DTO

### 3.2 (선택) 확장 후보 — 본 작업 범위에서 제외 권장
| 기능 | 이번 작업 포함 여부 | 사유 |
|---|---|---|
| 이메일 초대(magic link) 흐름 | **본 작업 제외 (확정)** | 2026-05-06 요구사항 — 운영자 직접 입력 방식 채택. 메일 발송 인프라(notification 모듈) 의존 회피 |
| 첫 로그인 시 비밀번호 강제 변경 | 후속 작업 | UX/플로우 별도 설계 필요 |
| 계정 상태 변경 (suspend / reactivate) | 후속 작업 | 별도 use case로 분리하는 편이 검증 명확 |
| 비밀번호 리셋 / 변경 | 후속 작업 | 알림(이메일) 채널 미정 — notification 모듈 의존 |
| MFA enrollment | 후속 작업 | POL-010 요구사항이지만 인프라 미구축 |
| 어드민 삭제(soft/hard) | 본 작업 제외 | `AdminAuthSession` cascade·감사 로그 정책 별도 결정 필요 |

### 3.3 비즈니스 규칙 (POL-010 반영)
[docs/design/a-idol-policy.md:77-82](docs/design/a-idol-policy.md#L77-L82)

| Rule | 적용 시점 | 위반 시 |
|---|---|---|
| `admin` 역할 ≤ 3명 | 생성·역할변경 시 카운트 | `DomainError(ADMIN_LIMIT_EXCEEDED)` → 409 |
| 자기 자신 역할 변경 금지 | 역할변경 시 `req.admin.id === :id` 차단 | `DomainError(ADMIN_SELF_MODIFICATION_FORBIDDEN)` → 403 |
| 마지막 admin 강등 금지 | 역할변경 후 admin 잔여수 ≥ 1 | `DomainError(ADMIN_LAST_ADMIN_DEMOTION)` → 409 |
| 비밀번호 정책 | 생성 시 | identity 모듈의 password validator 재사용 ([validate-password.ts](packages/backend/src/modules/identity/domain/validate-password.ts) 검토) |
| 이메일 unique | 생성 시 | `DomainError(ADMIN_EMAIL_DUPLICATE)` → 409 |

### 3.4 비기능 요구사항
- **DTO 컨벤션**: 신규 Request DTO는 **snake_case** 강제 (ADR-023). Response는 camelCase.
- **로깅**: 생성·역할변경은 NestJS Logger로 admin 식별자 포함 INFO 레벨 기록. 정식 `audit_logs` 테이블은 별도 ADR로 미루되, 메서드에 TODO 주석 + interface 슬롯은 둠.
- **테스트**: 각 use case에 대해 happy/edge 케이스 단위 테스트 (no Nest TestModule, hand-rolled fakes).
- **API 버저닝**: `/api/v1` prefix (ADR-022).

## 4. 갭 분석

| 영역 | AS-IS | TO-BE | 갭 |
|---|---|---|---|
| 데이터 모델 | AdminUser 모델 완비 | 변경 없음 | — |
| 가드/RBAC | `RolesGuard` + `@Roles()` 적용 중 | 동일 | — |
| 비밀번호 해시 | identity 모듈 재사용 중 | 동일 | — |
| 신규 생성 API | 없음 | `POST /admin/operators` | **신규 use case + controller method 추가** |
| 역할 변경 API | 없음 | `PATCH /admin/operators/:id/role` | **신규 use case + controller method 추가** |
| 도메인 정책 검증 | 없음 | admin ≤ 3, self-mod 금지 등 | **AdminUser 도메인 메서드 또는 use case 내부 검증 추가** |
| Repository 메서드 | `findById/findByEmail/listAll/save(update만)` | `create`, `updateRole`, `countByRole` 추가 필요 | **AdminUserRepository 인터페이스 확장** |
| ErrorCodes | 미정의 | 4개 신규 코드 | **shared/errors/error-codes.ts 등록** |
| DTO 컨벤션 | `AdminLoginDto` camelCase (legacy) | 신규 DTO snake_case | **신규 DTO만 snake_case로 작성. 기존 DTO 마이그레이션은 본 작업 제외** |
| 테스트 | 기존 use case별 spec 존재 | 신규 use case spec 추가 | **2개 spec 파일 추가** |
| 트레이스빌리티 | FR-101까지 | FR-102 신규 등록 | **req-definition.md 업데이트** |

## 5. 사용자 플로우 (예상)

### 5.1 신규 어드민 등록 (관리자 시점)
```
[CMS UI] 운영자 관리 페이지 → "신규 어드민" 버튼
  → 모달: email / displayName / password / role 입력
  → 저장 클릭
[Backend] POST /api/v1/admin/operators
  → AdminJwtAuthGuard + RolesGuard('admin')
  → CreateAdminOperatorUseCase
    → 이메일 중복 검증
    → 비밀번호 정책 검증
    → admin 역할일 경우 카운트 검증 (≤3)
    → bcrypt 해시
    → AdminUser INSERT
  → 응답 201 + AdminUserResponseDto
[CMS UI] 목록 갱신
```

### 5.2 역할 변경
```
[CMS UI] 어드민 상세 → 역할 드롭다운 변경 → 저장
[Backend] PATCH /api/v1/admin/operators/:id/role  body: { role }
  → AdminJwtAuthGuard + RolesGuard('admin')
  → UpdateAdminRoleUseCase
    → req.admin.id === :id 차단
    → 대상 조회
    → 변경 전 admin이고 변경 후 admin이 아니면 → admin 잔여수 ≥ 1 검증
    → 변경 후 admin이면 → admin 카운트 ≤ 3 검증
    → role UPDATE
  → 응답 200 + AdminUserResponseDto
[CMS UI] 목록 갱신
```

## 6. 기술 제약사항 / 결정 포인트

| # | 결정 포인트 | 권장 | 사용자 확정 필요 |
|---|---|---|---|
| 1 | MFA 적용 시점 | **이번 작업 제외**, 별도 ADR | ✅ |
| 2 | audit_logs 테이블 | **이번 작업 제외**, NestJS Logger로만 기록 + TODO 주석 | ✅ |
| 3 | 비밀번호 발급 방식 | **운영자가 직접 입력 — 2026-05-06 확정**. 이메일 초대(magic link) 미사용. 첫 로그인 강제 변경 / 이메일 리셋은 후속 | ✅ resolved |
| 4 | 기존 `AdminLoginDto` (camelCase) snake_case 마이그레이션 동시 진행 | **별도 PR로 분리**. ADR-023 cutover 작업과 충돌 회피 | ✅ |
| 5 | CMS 프론트엔드 구현 | **본 작업 제외 (백엔드만)** — `packages/cms`는 placeholder | ✅ |
| 6 | suspend / reactivate / 삭제 | **본 작업 제외**, 후속 작업 | ✅ |
| 7 | FR ID 부여 | 신규 FR-102로 등록(권장) — req-definition.md 업데이트 포함 | ✅ |

## 7. 영향 범위 (사이드 임팩트)

- **Prisma**: 스키마 변경 없음 → 마이그레이션 불필요.
- **모듈**: admin-ops 모듈 내부 변경만. 다른 모듈 영향 없음.
- **JWT 역할 클레임**: 역할 변경 시 기존 발급된 access token에는 구 역할이 남음. access token TTL이 15분이므로 자연 만료를 허용. 즉시 무효화는 본 작업 제외(필요 시 후속).
- **세션 강제 로그아웃**: 역할이 강등되어도 기존 refresh session은 유효 → 사용자가 access token을 갱신하면 새 역할 반영. 강등 시 `AdminAuthSession`의 `revokedAt` 일괄 설정 여부는 결정 포인트(권장: **이번 작업 제외**).
- **CMS**: 신규 API를 호출할 화면 없음 → 백엔드 API만 노출 후 CMS 작업과 분리 진행.

## 8. 산출물 목록 (예상)

신규/수정될 파일은 PLN 문서에 상세 기재.

- 신규: 2개 use case + 2개 spec + 2개 Request DTO + 1개 Repository 메서드 set + 4개 ErrorCode 등록
- 수정: `admin-operators.controller.ts`, `admin-ops.module.ts`, `interfaces.ts`, `prisma-admin-user.repository.ts`, `req-definition.md` 트레이스빌리티 매트릭스
