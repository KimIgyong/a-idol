# TCR-260506 — CMS 어드민 계정 관리 (신규 추가 · 역할 변경) 테스트 케이스

- 작성일: 2026-05-06
- 작성자: Gray Kim
- 선행 문서: [REQ-260506](../analysis/REQ-260506-cms-admin-account-management.md) · [PLN-260506](../plan/PLN-260506-cms-admin-account-management.md)
- 테스트 범위: 백엔드 (use case / controller). CMS 화면 테스트는 후속 PLN.
- 테스트 프레임워크: Jest (hand-rolled fakes, no `Test.createTestingModule`)

---

## 1. 단위 테스트 (Unit)

### 1.1 CreateAdminOperatorUseCase

파일: [packages/backend/src/modules/admin-ops/application/create-admin-operator.usecase.spec.ts](../../packages/backend/src/modules/admin-ops/application/create-admin-operator.usecase.spec.ts)

| TC ID | 시나리오 | 입력 | 기대 결과 | 상태 |
|---|---|---|---|---|
| TC-CA-001 | Happy: operator 생성 | role=`operator`, 정상 입력 | `repo.create` 호출, `repo.countByRole` 미호출 | ✅ |
| TC-CA-002 | admin 생성, 카운트 < 3 | role=`admin`, count=2 | `repo.countByRole('admin')` 호출 + `repo.create` 호출 | ✅ |
| TC-CA-003 | admin 한도 초과 | role=`admin`, count=3 | `DomainError(ADMIN_LIMIT_EXCEEDED)` + `repo.create` 미호출 | ✅ |
| TC-CA-004 | 이메일 중복 | findByEmail이 기존 admin 반환 | `DomainError(ADMIN_EMAIL_DUPLICATE)` + `repo.create` 미호출 | ✅ |
| TC-CA-005 | 검증 순서: 이메일 우선 | dup + admin 한도 초과 동시 | `ADMIN_EMAIL_DUPLICATE` 우선 반환 (countByRole 미호출) | ✅ |

### 1.2 UpdateAdminRoleUseCase

파일: [packages/backend/src/modules/admin-ops/application/update-admin-role.usecase.spec.ts](../../packages/backend/src/modules/admin-ops/application/update-admin-role.usecase.spec.ts)

| TC ID | 시나리오 | 입력 | 기대 결과 | 상태 |
|---|---|---|---|---|
| TC-UR-001 | Happy: operator → admin (count<3) | target=operator, count=1 | role=admin 갱신 | ✅ |
| TC-UR-002 | Happy: admin → operator (잔여≥2) | target=admin, count=2 | role=operator 갱신 | ✅ |
| TC-UR-003 | 자기 자신 변경 차단 | actorId=targetId | `DomainError(ADMIN_SELF_MODIFICATION_FORBIDDEN)` + findById 미호출 | ✅ |
| TC-UR-004 | 대상 미존재 | findById=null | `DomainError(ADMIN_NOT_FOUND)` | ✅ |
| TC-UR-005 | 동일 role 멱등 no-op | target.role===input.role | 현재 도메인 그대로 반환, updateRole 미호출 | ✅ |
| TC-UR-006 | 마지막 admin 강등 차단 | target=admin, count=1 | `DomainError(ADMIN_LAST_ADMIN_DEMOTION)` | ✅ |
| TC-UR-007 | admin 승격 한도 초과 | target=operator, count=3, role=admin | `DomainError(ADMIN_LIMIT_EXCEEDED)` | ✅ |
| TC-UR-008 | 동시성: findById 후 삭제 | updateRole 반환 null | `DomainError(ADMIN_NOT_FOUND)` (drop-through 가드) | ✅ |

### 1.3 isWeakPassword (shared)

파일: [packages/backend/src/shared/validators/strong-password.validator.spec.ts](../../packages/backend/src/shared/validators/strong-password.validator.spec.ts) — identity의 기존 spec을 shared 함수로 이전.

| 시나리오 | 기대 |
|---|---|
| 정확 일치 흔한 비밀번호 reject | ✅ |
| 짧은(≤12) 길이 + 흔한 root 포함 reject | ✅ |
| passphrase (≥13자) root 포함되어도 통과 | ✅ |
| blocklist 외 짧은 unique 조합 통과 | ✅ |
| non-string input 보수적으로 weak | ✅ |

---

## 2. 통합 시나리오 (Integration / cURL)

> 로컬 개발 환경 (`make dev` + seed `admin@a-idol.dev / admin-dev-0000`).

### 2.1 어드민 등록 (POST /admin/operators)

**ITC-001 — Happy path**
```bash
TOKEN=$(curl -sX POST http://localhost:3000/api/v1/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@a-idol.dev","password":"admin-dev-0000"}' | jq -r .accessToken)

curl -isX POST http://localhost:3000/api/v1/admin/operators \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
        "email":"ops2@a-idol.dev",
        "display_name":"Yuna Park",
        "password":"correct horse battery staple",
        "role":"operator"
      }'
# 기대: 201 + AdminUserResponseDto (passwordHash 미포함)
```

**ITC-002 — 이메일 중복 → 409**
```bash
# 위 요청 재실행
# 기대: 409 { "code":"ADMIN_EMAIL_DUPLICATE", ... }
```

**ITC-003 — 약한 비밀번호 → 400 (ValidationPipe)**
```bash
curl -isX POST http://localhost:3000/api/v1/admin/operators \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"email":"weak@a-idol.dev","display_name":"X","password":"password","role":"viewer"}'
# 기대: 400 (class-validator IsStrongPassword 메시지)
```

**ITC-004 — admin 한도 초과 → 409**
```bash
# 사전: admin 역할 3명까지 등록한 상태에서
curl -isX POST http://localhost:3000/api/v1/admin/operators \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"email":"admin4@a-idol.dev","display_name":"X","password":"correct horse battery staple","role":"admin"}'
# 기대: 409 { "code":"ADMIN_LIMIT_EXCEEDED", "details":{"current":3} }
```

**ITC-005 — operator 권한으로 호출 → 403**
```bash
OPS_TOKEN=$(curl -sX POST http://localhost:3000/api/v1/admin/auth/login \
  -d '{"email":"ops2@a-idol.dev","password":"..."}' | jq -r .accessToken)

curl -isX POST http://localhost:3000/api/v1/admin/operators \
  -H "Authorization: Bearer $OPS_TOKEN" -d '{...}'
# 기대: 403 (RolesGuard)
```

### 2.2 역할 변경 (PATCH /admin/operators/:id/role)

**ITC-010 — Happy: operator → viewer**
```bash
TARGET=ops2-uuid
curl -isX PATCH http://localhost:3000/api/v1/admin/operators/$TARGET/role \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"role":"viewer"}'
# 기대: 200 + 갱신된 AdminUserResponseDto
```

**ITC-011 — 자기 자신 변경 → 403**
```bash
SELF=$(curl -s http://localhost:3000/api/v1/admin/me -H "Authorization: Bearer $TOKEN" | jq -r .id)
curl -isX PATCH http://localhost:3000/api/v1/admin/operators/$SELF/role \
  -H "Authorization: Bearer $TOKEN" -d '{"role":"viewer"}'
# 기대: 403 { "code":"ADMIN_SELF_MODIFICATION_FORBIDDEN" }
```

**ITC-012 — 마지막 admin 강등 → 409**
```bash
# 사전: admin 1명만 남은 상태
LAST_ADMIN=$(get id of the only admin via /admin/operators)
curl -isX PATCH http://localhost:3000/api/v1/admin/operators/$LAST_ADMIN/role \
  -H "Authorization: Bearer $OTHER_ADMIN_TOKEN" -d '{"role":"operator"}'
# 기대: 409 { "code":"ADMIN_LAST_ADMIN_DEMOTION" }
```

**ITC-013 — 잘못된 UUID → 400**
```bash
curl -isX PATCH http://localhost:3000/api/v1/admin/operators/not-a-uuid/role \
  -H "Authorization: Bearer $TOKEN" -d '{"role":"viewer"}'
# 기대: 400 (ParseUUIDPipe)
```

**ITC-014 — 미존재 UUID → 404**
```bash
curl -isX PATCH http://localhost:3000/api/v1/admin/operators/00000000-0000-0000-0000-000000000000/role \
  -H "Authorization: Bearer $TOKEN" -d '{"role":"viewer"}'
# 기대: 404 { "code":"ADMIN_NOT_FOUND" }
```

---

## 3. 엣지 케이스

| # | 케이스 | 처리 | 검증 |
|---|---|---|---|
| E-1 | 동시 admin 카운트 race (3개 동시 생성 시도) | DB 트랜잭션 없이 race 발생 가능 → 4번째 admin 생성될 수 있음 | **알려진 한계**. 트랜잭션화는 후속 작업. 3명 한도는 운영 가이드라인으로 보강 |
| E-2 | role enum 외 값 | DTO `@IsIn(['admin','operator','viewer'])` | 400 BadRequest |
| E-3 | display_name 공백 / 41자 | DTO `@Length(1, 40)` | 400 |
| E-4 | password 8자 미만 | DTO `@MinLength(8)` | 400 |
| E-5 | email 잘못된 형식 | DTO `@IsEmail()` | 400 |
| E-6 | snake_case 필드 누락 (예: `displayName` 사용) | `forbidNonWhitelisted: true` (main.ts) | 400 |
| E-7 | 대상 admin 강등 직후 동시성 갱신 | usecase에서 updateRole=null → ADMIN_NOT_FOUND drop-through | TC-UR-008 커버 |

---

## 4. 회귀 영향 검증

| 영역 | 검증 방법 | 결과 |
|---|---|---|
| 기존 admin-ops 6개 use case | `pnpm --filter @a-idol/backend test -- --testPathPattern="admin-ops"` | 36 tests pass (8 suites) |
| identity signup (password validator 경로 변경) | 전체 backend test | 333/334 pass — `identity/application/logout.usecase.spec.ts` 1건 실패는 **main 브랜치에서도 동일** (사전 회귀, 본 PR 무관) |
| typecheck 4개 워크스페이스 | `make typecheck` | All pass |
| lint | `make lint` | 0 errors (cms 측 기존 경고 2건 무관) |

---

## 5. 미커버 영역 (TODO)

- 컨트롤러 e2e 테스트 (NestJS supertest) — 기존 admin-ops에도 e2e 부재. T-082 후속.
- 동시성 테스트 (E-1) — 트랜잭션 도입 후 추가.
- audit_logs 검증 — POL-010 audit 테이블 도입 시.
- CMS UI 테스트 (Playwright/Vitest) — 후속 CMS PLN.
