# PLN-260506 — CMS 어드민 계정 관리 (신규 추가 · 역할 변경) 구현 계획

- 작성일: 2026-05-06 (재작성: 화면구성도 first-class 승격)
- 작성자: Gray Kim
- 상태: **승인 대기 (사용자 진행 지시 필요)**
- 선행 문서: [REQ-260506-cms-admin-account-management.md](../analysis/REQ-260506-cms-admin-account-management.md)
- 예상 소요: 백엔드 3.5–4.5h / CMS 화면 6–8h (별도 PLN 분리 권장)

---

## 0. 작업 범위

REQ §6의 결정 포인트에 따른 **권장 범위**:

✅ 본 PLN 포함 (백엔드)
- `POST /api/v1/admin/operators` — 신규 어드민 생성
- `PATCH /api/v1/admin/operators/:id/role` — 역할 변경
- 도메인 정책 검증 (admin ≤ 3, 자기 자신 변경 금지, 마지막 admin 강등 금지, 이메일 unique, 비밀번호 정책)
- 단위 테스트 + 트레이스빌리티 매트릭스 업데이트
- **화면구성도 (§1)** — 후속 CMS 작업의 기준선이자 본 API 설계의 검증 도구

🟡 본 PLN 설계 산출물 + 별도 CMS PLN에서 구현
- CMS 화면 3종 (목록 / 신규등록 / 역할변경) — 본 PLN에서 와이어프레임 + 인터랙션 + 에러 메시지까지 확정. 코드 구현은 후속 PLN.

⛔ 본 작업 제외 (후속 작업)
- **이메일 초대(magic link) 흐름** — 2026-05-06 요구사항으로 직접 입력 방식 확정 → 영구 제외(MVP)
- **첫 로그인 강제 비밀번호 변경** — 후속 UX 설계 필요
- 계정 상태 변경 (suspend/reactivate) · 비밀번호 리셋 · MFA · 어드민 삭제
- audit_logs 테이블 신규 (NestJS Logger로만 기록)
- `AdminLoginDto` snake_case 마이그레이션 (ADR-023 cutover 별도 PR)
- 역할 변경 후 access token / refresh session 즉시 무효화

> 위 범위에 이견이 있으면 PLN 승인 단계에서 알려주십시오. 합의 후 구현 시작합니다.

---

## 1. 화면구성도 (UI Wireframe)

본 백엔드 API가 실제로 운영되는 맥락. 모든 엔드포인트는 아래 화면 인터랙션을 직접 지원해야 한다. 화면 ID는 후속 CMS PLN과 트레이스빌리티 매트릭스에서 그대로 재사용한다.

### 1.1 화면 목록

| 화면 ID | 명칭 | 진입 경로 | 필요 권한 |
|---|---|---|---|
| **SCR-CMS-OPS-LIST** | 운영자 목록 | 좌측 GNB → "운영자 관리" | admin / operator / viewer (조회) |
| **SCR-CMS-OPS-CREATE** | 신규 어드민 등록 모달 | LIST 화면 → `[+ 신규 어드민]` | admin only |
| **SCR-CMS-OPS-ROLE-CHANGE** | 역할 변경 모달 | LIST 행 ⋮ 메뉴 → `역할 변경` | admin only |

### 1.2 SCR-CMS-OPS-LIST — 운영자 목록

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← A-idol CMS                              [Gray Kim ▾]   [로그아웃]  │
├─────────┬────────────────────────────────────────────────────────────┤
│ 대시보드│ 운영자 관리                              [+ 신규 어드민]  │
│ 아이돌  │                                                            │
│ 팬덤    ├────────────────────────────────────────────────────────────┤
│ 채팅    │ 검색 [____________]  역할 [전체 ▾]  상태 [전체 ▾]  [검색] │
│ 상점    ├────────────────────────────────────────────────────────────┤
│ 오디션  │  이메일             │ 이름      │ 역할   │ 최근로그인 │ ⋮ │
│ 포토카드│ ─────────────────── ┼────────── ┼─────── ┼────────── ┼─── │
│ ▶ 운영자│  admin@a-idol.dev   │ Gray Kim  │ admin  │ 5분 전     │ ⋮ │
│         │  ops1@a-idol.dev    │ Yuna Park │ oper.. │ 2시간 전   │ ⋮ │
│         │  view1@a-idol.dev   │ Mina Lee  │ viewer │ 어제       │ ⋮ │
│         │  …                                                        │
│         ├────────────────────────────────────────────────────────────┤
│         │                       [< 1 2 3 ... >]                     │
└─────────┴────────────────────────────────────────────────────────────┘

⋮ 메뉴 (admin 권한일 때):
   ├─ 역할 변경
   ├─ 계정 잠금 해제          (이미 구현됨)
   └─ (후속) 계정 정지 / 활성화
```

**인터랙션 → API 매핑**
| 액션 | 요청 | 비고 |
|---|---|---|
| 화면 진입 / 새로고침 | `GET /api/v1/admin/operators` | 기존 구현 |
| 본인 행의 ⋮ 메뉴 | "역할 변경" 비활성 | self-modification 정책 — 클라이언트 가드 + 서버 가드 이중 |
| viewer/operator 로그인 시 | `[+ 신규 어드민]` 버튼 미노출 | 클라이언트 RBAC + 서버 `@Roles('admin')` 이중 |

### 1.3 SCR-CMS-OPS-CREATE — 신규 어드민 등록 모달

> **방식 (2026-05-06 확정)**: 이메일 초대(magic link) 없음. admin 운영자가 모달에서 이메일·비밀번호·역할을 직접 입력 → 즉시 활성 계정 생성. 운영자가 신규 사용자에게 비밀번호를 out-of-band(구두/사내 메신저)로 전달.

```
┌────────────────────────────────────────────────┐
│ 신규 어드민 등록                         [×]   │
├────────────────────────────────────────────────┤
│ 이메일 *      [____________________________]  │
│               ⚠ 이미 등록된 이메일입니다.      │  ← 409 시
│                                                │
│ 이름 *        [_________________] (1–40자)    │
│                                                │
│ 비밀번호 *    [____________________________]  │
│               · 8자 이상                       │
│               · 영문 + 숫자 + 특수문자 조합    │
│               [↻ 자동 생성]                    │  ← 권장(선택 구현)
│               ⚠ 비밀번호 정책에 맞지 않습니다  │  ← 422 시
│                                                │
│ 역할 *        ( ) admin                        │
│               (•) operator                     │
│               ( ) viewer                       │
│               ⚠ admin 역할은 최대 3명까지      │  ← 409 LIMIT_EXCEEDED
│                  등록 가능합니다 (현재 3명).   │
│                                                │
│ ℹ 등록 후 비밀번호를 신규 사용자에게 안전한    │
│   채널로 전달하세요. 시스템에서 자동 발송하지  │
│   않습니다.                                    │
├────────────────────────────────────────────────┤
│                          [취소]   [등록]       │
└────────────────────────────────────────────────┘
```

**성공 후 확인 다이얼로그 (선택 구현)**
```
┌────────────────────────────────────────────────┐
│ ✓ 어드민이 등록되었습니다                      │
├────────────────────────────────────────────────┤
│ 이메일   ops2@a-idol.dev                       │
│ 비밀번호 ████████████████  [👁 보기] [📋 복사] │
│                                                │
│ ⚠ 이 비밀번호는 한 번만 표시됩니다.            │
│   안전한 채널로 사용자에게 전달하세요.         │
├────────────────────────────────────────────────┤
│                                  [확인]        │
└────────────────────────────────────────────────┘
```
> 백엔드 응답에는 `passwordHash`만 저장되고 평문은 응답하지 않음 → 위 "비밀번호 보기"는 **모달이 입력 받은 평문을 클라이언트 메모리에 임시 보유**한 상태에서 표시. 페이지 이탈 시 소멸. 자동 생성 옵션 시에도 동일 패턴.

**인터랙션 → API 매핑**
| 액션 | 요청 | 응답 |
|---|---|---|
| `[등록]` 클릭 | `POST /api/v1/admin/operators` body=`{ email, display_name, password, role }` | `201` + `AdminUserResponseDto` |
| 성공 | 모달 → 확인 다이얼로그(평문 비번 표시) → close → 목록 prepend / 재조회 → Toast "어드민이 등록되었습니다" | — |
| 이메일 중복 | 409 `ADMIN_EMAIL_DUPLICATE` | 이메일 필드 하단 인라인 에러 |
| admin 한도 초과 | 409 `ADMIN_LIMIT_EXCEEDED` | 역할 라디오 하단 인라인 에러 |
| 비밀번호 정책 | 422 `WEAK_PASSWORD` (identity 모듈 코드 재사용) | 비밀번호 필드 하단 인라인 에러 |
| 권한 부족 | 403 (서버 가드) | Toast "권한이 없습니다" + 모달 close |

### 1.4 SCR-CMS-OPS-ROLE-CHANGE — 역할 변경 모달

```
┌────────────────────────────────────────────────┐
│ 역할 변경                                [×]   │
├────────────────────────────────────────────────┤
│ 대상       ops1@a-idol.dev (Yuna Park)         │
│ 현재 역할  operator                            │
│                                                │
│ 변경 역할  [operator ▾]                        │
│             ├ admin                            │
│             ├ operator                         │
│             └ viewer                           │
│                                                │
│ ⚠ admin → 다른 역할 변경 시 admin이 1명만     │
│   남는 경우 변경할 수 없습니다.                │
│                                                │
│ ⚠ admin 역할은 최대 3명까지 등록 가능합니다.  │  ← LIMIT 시
├────────────────────────────────────────────────┤
│                          [취소]   [저장]       │
└────────────────────────────────────────────────┘
```

**인터랙션 → API 매핑**
| 액션 | 요청 | 응답 |
|---|---|---|
| `[저장]` 클릭 | `PATCH /api/v1/admin/operators/:id/role` body=`{ role }` | `200` + `AdminUserResponseDto` |
| 성공 | 모달 close → 목록 해당 행 갱신 → Toast "역할이 변경되었습니다" | — |
| 변경 없음 (현재==신규) | `[저장]` 버튼 disabled 또는 200 멱등 응답 | UI에서 disabled 권장 |
| 자기 자신 변경 | 403 `ADMIN_SELF_MODIFICATION_FORBIDDEN` | UI에서 사전 차단 (⋮ 메뉴 비활성), 서버는 fail-safe |
| 마지막 admin 강등 | 409 `ADMIN_LAST_ADMIN_DEMOTION` | 모달 하단 인라인 에러 |
| admin 한도 초과 | 409 `ADMIN_LIMIT_EXCEEDED` | 모달 하단 인라인 에러 |

### 1.5 i18n 메시지 키 초안

본 PLN 구현 단계에서는 **에러 코드만 발급**하고, i18n 문구 등록은 후속 CMS PLN에서 처리. 다만 키 네이밍은 미리 합의:

```
admin.errors.email_duplicate          = "이미 등록된 이메일입니다."
admin.errors.limit_exceeded            = "admin 역할은 최대 3명까지 등록 가능합니다 (현재 {count}명)."
admin.errors.self_modification         = "자기 자신의 역할은 변경할 수 없습니다."
admin.errors.last_admin_demotion       = "마지막 admin 계정은 강등할 수 없습니다."
admin.errors.weak_password             = "비밀번호 정책에 맞지 않습니다."
admin.create.password_handover_notice  = "등록 후 비밀번호를 신규 사용자에게 안전한 채널로 전달하세요. 시스템에서 자동 발송하지 않습니다."
admin.create.password_one_time_warning = "이 비밀번호는 한 번만 표시됩니다."
admin.toast.created                    = "어드민이 등록되었습니다."
admin.toast.role_updated               = "역할이 변경되었습니다."
```

4언어(`ko` / `en` / `vi` / `zh-CN`) 등록은 CMS PLN에서.

### 1.6 화면 → API 트레이스빌리티

| 화면 | 백엔드 엔드포인트 | 본 PLN 구현 |
|---|---|---|
| SCR-CMS-OPS-LIST | `GET /admin/operators` | 기존 구현 (변경 없음) |
| SCR-CMS-OPS-LIST ⋮ "잠금 해제" | `POST /admin/operators/unlock-account` | 기존 구현 (변경 없음) |
| SCR-CMS-OPS-CREATE | **`POST /admin/operators`** | ✅ 본 PLN |
| SCR-CMS-OPS-ROLE-CHANGE | **`PATCH /admin/operators/:id/role`** | ✅ 본 PLN |

---

## 2. 시스템 개발 현황 분석 요약

| 영역 | 상태 |
|---|---|
| `AdminUser` Prisma 모델 | ✅ 완비 (스키마 변경 불필요) |
| `BcryptPasswordHasher` (identity 모듈) | ✅ admin-ops에 DI 주입 완료 |
| `AdminUserRepository` 인터페이스 | 🟡 `findByEmail / findById / touchLastLogin / listAll` 만 존재 → 확장 필요 |
| `AdminJwtAuthGuard` + `RolesGuard` + `@Roles` | ✅ 적용 패턴 확립 |
| `DomainError` + `ErrorCodes` ([packages/shared/src/domain/errors.ts](../../packages/shared/src/domain/errors.ts)) | ✅ 패턴 확립 — 신규 코드 4개 추가 필요 |
| 단위 테스트 패턴 (hand-rolled fakes) | ✅ 기존 spec(`login-admin.usecase.spec.ts` 등) 참조 |
| CMS 화면 (`packages/cms`) | ⬜ placeholder — 본 PLN에서 와이어프레임만, 구현은 별도 PLN |

---

## 3. 구현 단계별 계획 (백엔드)

### Step 1 — Domain & ErrorCodes (10 min)

**1-1. ErrorCode 4개 추가**
- 파일: `packages/shared/src/domain/errors.ts`
- 추가 코드:
  ```ts
  ADMIN_EMAIL_DUPLICATE = 'ADMIN_EMAIL_DUPLICATE',
  ADMIN_LIMIT_EXCEEDED = 'ADMIN_LIMIT_EXCEEDED',
  ADMIN_SELF_MODIFICATION_FORBIDDEN = 'ADMIN_SELF_MODIFICATION_FORBIDDEN',
  ADMIN_LAST_ADMIN_DEMOTION = 'ADMIN_LAST_ADMIN_DEMOTION',
  ```
- 추가 검토: `ADMIN_NOT_FOUND` (대상 미존재 시 `SESSION_NOT_FOUND` 재사용 vs 신규). 신규 추가 권장.
- HTTP 매핑은 `AppExceptionFilter` 기존 규칙 검토 후 필요 시 등록 (409 / 403 / 404).

**1-2. 정책 검증 위치**
- AdminUser 단일 엔티티에 가두기 부적합(다른 AdminUser 카운트 비교 필요) → **use case 내부 처리**.

### Step 2 — Repository 인터페이스 + Prisma 어댑터 확장 (20 min)

**2-1. `AdminUserRepository` 메서드 추가**
- 파일: `packages/backend/src/modules/admin-ops/application/interfaces.ts`
- 추가:
  ```ts
  create(input: { email: string; passwordHash: string; displayName: string; role: AdminRole }): Promise<AdminUser>;
  updateRole(id: string, role: AdminRole): Promise<AdminUser>;
  countByRole(role: AdminRole): Promise<number>;
  ```

**2-2. Prisma 어댑터 구현**
- 파일: `packages/backend/src/modules/admin-ops/infrastructure/prisma-admin-user.repository.ts`
- 도메인 매핑은 기존 패턴 재사용.

### Step 3 — Use Case 구현 (60 min)

**3-1. `CreateAdminOperatorUseCase`** (SCR-CMS-OPS-CREATE 지원)
- 파일: `packages/backend/src/modules/admin-ops/application/create-admin-operator.usecase.ts`
- 흐름:
  1. `findByEmail` → 존재 시 `ADMIN_EMAIL_DUPLICATE`
  2. 비밀번호 정책 검증 (R1 — identity 모듈 함수 위치 확인 후 결정)
  3. `role === 'admin'` && `countByRole('admin') >= 3` → `ADMIN_LIMIT_EXCEEDED`
  4. `passwordHasher.hash(password)`
  5. `repo.create(...)` → 도메인 반환

**3-2. `UpdateAdminRoleUseCase`** (SCR-CMS-OPS-ROLE-CHANGE 지원)
- 파일: `packages/backend/src/modules/admin-ops/application/update-admin-role.usecase.ts`
- 흐름:
  1. `actorId === targetId` → `ADMIN_SELF_MODIFICATION_FORBIDDEN`
  2. `findById(targetId)` → null이면 `ADMIN_NOT_FOUND`
  3. 기존 == 신규 → 멱등 반환 (no-op)
  4. 변경 전 `admin` && 변경 후 ≠ `admin`: `countByRole('admin') <= 1` → `ADMIN_LAST_ADMIN_DEMOTION`
  5. 변경 후 `admin`: `countByRole('admin') >= 3` → `ADMIN_LIMIT_EXCEEDED`
  6. `repo.updateRole(targetId, role)` → 반환

### Step 4 — DTO & Controller (40 min)

**4-1. Request DTO (snake_case — ADR-023 신규 코드 강제)**
- `presentation/dto/create-admin-operator.dto.ts`
  ```ts
  class CreateAdminOperatorDto {
    @IsEmail() email: string;
    @IsString() @Length(1, 40) display_name: string;
    @IsString() @MinLength(8) password: string;
    @IsIn(['admin', 'operator', 'viewer']) role: AdminRole;
  }
  ```
- `presentation/dto/update-admin-role.dto.ts`
  ```ts
  class UpdateAdminRoleDto {
    @IsIn(['admin', 'operator', 'viewer']) role: AdminRole;
  }
  ```

**4-2. Response DTO (camelCase, 기존 재사용)**
- `AdminUserResponseDto` ([packages/shared/src/contracts/index.ts](../../packages/shared/src/contracts/index.ts)) 재사용.
- 변환은 기존 mapper 또는 `admin-user-view.ts` 검토 후 결정.

**4-3. Controller endpoint 추가**
- 파일: `packages/backend/src/modules/admin-ops/presentation/admin-operators.controller.ts`
- 추가:
  ```ts
  @Post()
  @Roles('admin')
  async create(@Body() dto: CreateAdminOperatorDto): Promise<AdminUserResponseDto> { ... }

  @Patch(':id/role')
  @Roles('admin')
  async updateRole(
    @Req() req: { admin: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminRoleDto,
  ): Promise<AdminUserResponseDto> { ... }
  ```
- Swagger 데코레이터 추가 (`@ApiOperation`, `@ApiResponse` — 기존 컨벤션).

### Step 5 — Module wiring (10 min)
- `packages/backend/src/modules/admin-ops/admin-ops.module.ts`
- providers에 신규 use case 2개 등록.

### Step 6 — 단위 테스트 (60 min)

**6-1. `create-admin-operator.usecase.spec.ts`**
- 케이스: happy / 이메일 중복 / admin 카운트 초과 / 비밀번호 정책 위반 / displayName 길이.

**6-2. `update-admin-role.usecase.spec.ts`**
- 케이스: happy(operator→admin) / happy(admin→operator) / 자기 자신 변경 거부 / 대상 미존재 / 마지막 admin 강등 거부 / admin 카운트 초과 / 동일 role 멱등.

> hand-rolled fakes 패턴 (`Test.createTestingModule` 미사용) 유지.

### Step 7 — 트레이스빌리티 (15 min)
- `docs/design/a-idol-req-definition.md`:
  - **FR-102** 신규 행 추가 — Admin user lifecycle (create / role-change).
  - 화면 ID 기재: SCR-CMS-OPS-LIST / CREATE / ROLE-CHANGE (구현은 후속).
- ADR 신규 불필요 (ADR-010 범위 내). "audit_logs deferred"는 ADR-010 future work에 한 줄 메모.

### Step 8 — 검증 (20 min)
- `make typecheck` · `make lint` · `make test` (`packages/backend` 범위).
- Swagger UI(`/docs`)에서 신규 엔드포인트 표시 확인.
- TCR 문서(`docs/test/TCR-260506-cms-admin-account-management.md`)에 cURL 시나리오 정리.

---

## 4. 신규/수정 파일 목록

### 신규
| 파일 | 용도 |
|---|---|
| `packages/backend/src/modules/admin-ops/application/create-admin-operator.usecase.ts` | 신규 어드민 생성 use case |
| `packages/backend/src/modules/admin-ops/application/create-admin-operator.usecase.spec.ts` | 단위 테스트 |
| `packages/backend/src/modules/admin-ops/application/update-admin-role.usecase.ts` | 역할 변경 use case |
| `packages/backend/src/modules/admin-ops/application/update-admin-role.usecase.spec.ts` | 단위 테스트 |
| `packages/backend/src/modules/admin-ops/presentation/dto/create-admin-operator.dto.ts` | Request DTO |
| `packages/backend/src/modules/admin-ops/presentation/dto/update-admin-role.dto.ts` | Request DTO |

### 수정
| 파일 | 변경 내용 |
|---|---|
| `packages/shared/src/domain/errors.ts` | ErrorCode 4–5개 추가 |
| `packages/backend/src/modules/admin-ops/application/interfaces.ts` | `create / updateRole / countByRole` 시그니처 추가 |
| `packages/backend/src/modules/admin-ops/infrastructure/prisma-admin-user.repository.ts` | 신규 메서드 구현 |
| `packages/backend/src/modules/admin-ops/presentation/admin-operators.controller.ts` | `POST /` + `PATCH /:id/role` 추가 |
| `packages/backend/src/modules/admin-ops/admin-ops.module.ts` | providers 등록 |
| `packages/backend/src/shared/errors/app-exception.filter.ts` | (필요 시) HTTP 코드 매핑 추가 |
| `docs/design/a-idol-req-definition.md` | FR-102 + 화면 ID 트레이스빌리티 추가 |

---

## 5. 사이드 임팩트 분석

| 항목 | 영향 | 완화 |
|---|---|---|
| Prisma 마이그레이션 | 없음 | — |
| 다른 모듈 (identity / catalog / chat / …) | 없음 (admin-ops 격리) | 모듈 격리 원칙 준수 |
| 기존 access token | 역할 변경 후 access token TTL(15m) 만료까지 구 역할 유효 | 의도된 동작. 즉시 무효화 후속 작업 |
| 기존 refresh session | 강등돼도 유효 → 다음 refresh부터 새 역할 반영 | 의도된 동작 |
| `AdminLoginDto` snake_case 미마이그레이션 | DTO 컨벤션 혼재(legacy) | ADR-023 별도 PR. 본 작업의 신규 DTO는 컨벤션 준수 |
| 비밀번호 정책 함수 출처 | identity 모듈 직접 import 시 격리 위반 가능 | R1: shared 승격 vs inline 복제 결정 후 진행 |
| 트레이스빌리티 | FR-102 + 화면 ID 신규 등록 | req-definition.md 동시 갱신 |
| Audit log 부재 | POL-010 미충족 (계속 deferred) | NestJS Logger 기록 + interface 슬롯 + TODO 주석 |
| CMS 코드 | 본 PLN 구현 범위에 미포함 | 와이어프레임은 §1에서 확정 → 후속 PLN의 입력으로 사용 |

---

## 6. 리스크

| # | 리스크 | 대응 |
|---|---|---|
| R1 | 비밀번호 정책 함수가 identity 모듈에 묶여 있어 직접 import 시 모듈 격리 위반 | 검증 함수 위치 확인 후 (a) shared로 승격, (b) admin-ops에 inline 복제 중 택일. **PLN 승인 직후 1차 코드 확인하여 결정 보고** |
| R2 | `ADMIN_NOT_FOUND` ErrorCode 신규 추가 vs `SESSION_NOT_FOUND` 재사용 | 의미 명확화를 위해 신규 추가 권장 |
| R3 | `displayName` 길이 검증 이중 (DTO + Prisma column 40) | 컨벤션상 DTO 측 명시 — 이중 보호 정상 |
| R4 | `AdminRole` enum 정의가 shared와 Prisma 양쪽에 존재 — 일치 보장 | 기존 패턴 그대로 유지. 코드에서 명시적 매핑 |
| R5 | 역할 변경 후 즉시 권한 회수 미지원 — 보안 우려 | access TTL 15분이라 영향 제한적. 후속 작업으로 명시 |
| R6 | 클라이언트 측 self-modification 가드 누락 시 서버 fail-safe 의존 | 서버 가드(use case 1번 검증)가 진실의 원천. CMS PLN에서 클라이언트 가드 추가 |

---

## 7. 승인 체크리스트 (사용자 확인 사항)

다음 항목에 대해 확인/조정 후 진행 지시 부탁드립니다:

### 7.1 범위
- [ ] §0 "포함/제외" 범위 적절
- [ ] CMS 화면은 본 PLN에서 **와이어프레임만 확정**, 코드 구현은 별도 PLN

### 7.2 정책
- [ ] MFA / audit_logs / suspend / 비밀번호 리셋 후속 미루기 동의
- [x] **비밀번호는 운영자 직접 입력 방식** — 2026-05-06 확정. 이메일 초대 / 첫 로그인 강제 변경 / 자동 발송 모두 미사용. 비밀번호 전달은 out-of-band(구두/사내 메신저) 운영 정책 책임
- [ ] **자기 자신 역할 변경 금지** (서버 가드 + 클라이언트 ⋮ 메뉴 비활성)
- [ ] **마지막 admin 강등 금지** + **admin ≤ 3명**

### 7.3 화면구성도 (§1)
- [ ] SCR-CMS-OPS-LIST 레이아웃 / 컬럼 구성 OK
- [ ] SCR-CMS-OPS-CREATE 입력 필드 / 에러 메시지 노출 위치 OK
- [ ] SCR-CMS-OPS-ROLE-CHANGE 모달 흐름 OK
- [ ] i18n 메시지 키 네이밍(§1.5) OK — 4언어 등록은 CMS PLN에서

### 7.4 기타
- [ ] 기존 `AdminLoginDto` snake_case 마이그레이션은 별도 PR
- [ ] FR-102 신규 ID 부여 + req-definition.md 업데이트 포함
- [ ] 신규 ErrorCode 4–5개 등록
- [ ] 역할 변경 시 토큰/세션 즉시 무효화는 후속 작업으로 분리

승인 의견 주시면 Step 1부터 순서대로 구현 시작하겠습니다.
