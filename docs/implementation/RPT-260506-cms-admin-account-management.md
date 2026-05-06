# RPT-260506 — CMS 어드민 계정 관리 (신규 추가 · 역할 변경) 구현 완료 보고서

- 작성일: 2026-05-06
- 작성자: Gray Kim
- 상태: ✅ 백엔드 구현 완료 / 배포 미진행
- 관련 문서: [REQ-260506](../analysis/REQ-260506-cms-admin-account-management.md) · [PLN-260506](../plan/PLN-260506-cms-admin-account-management.md) · [TCR-260506](../test/TCR-260506-cms-admin-account-management.md)
- 트레이스빌리티: **FR-102** (req-definition.md 갱신 완료)

---

## 1. 구현 요약

A-idol CMS의 어드민 계정 관리(신규 등록 · 역할 변경) 백엔드 API를 구현했다. **이메일 초대 흐름 없이** admin 운영자가 직접 이메일·비밀번호·역할을 입력하여 계정을 생성한다(2026-05-06 요구사항 확정).

### 추가된 엔드포인트
| Method | Path | 권한 | 설명 |
|---|---|---|---|
| POST  | `/api/v1/admin/operators` | admin only | 신규 어드민 등록 — 즉시 활성 |
| PATCH | `/api/v1/admin/operators/:id/role` | admin only | 역할 변경 |

### 정책 (POL-010 반영)
- `admin` 역할 ≤ 3명 강제
- 자기 자신 역할 변경 금지
- 마지막 admin 강등 금지
- 이메일 unique
- 비밀번호 정책: identity와 동일한 `IsStrongPassword` (NIST §5.1.1.2 blocklist)

---

## 2. 변경 파일 목록

### 신규 (10)
- `packages/shared/src/domain/password-policy.ts` — `isWeakPassword` 순수함수 (R1 해소: identity → shared 승격)
- `packages/backend/src/shared/validators/strong-password.validator.ts` — `IsStrongPassword` 데코레이터 (identity·admin-ops 공용)
- `packages/backend/src/shared/validators/strong-password.validator.spec.ts` — 위 함수 단위 테스트
- `packages/backend/src/modules/admin-ops/application/create-admin-operator.usecase.ts` — `CreateAdminOperatorUseCase` + `CreateAdminOperatorService`(평문→해시 thin wrapper)
- `packages/backend/src/modules/admin-ops/application/create-admin-operator.usecase.spec.ts` — 5 케이스
- `packages/backend/src/modules/admin-ops/application/update-admin-role.usecase.ts` — `UpdateAdminRoleUseCase`
- `packages/backend/src/modules/admin-ops/application/update-admin-role.usecase.spec.ts` — 8 케이스
- `packages/backend/src/modules/admin-ops/presentation/dto/create-admin-operator.dto.ts` — Request DTO (snake_case)
- `packages/backend/src/modules/admin-ops/presentation/dto/update-admin-role.dto.ts` — Request DTO
- `docs/test/TCR-260506-cms-admin-account-management.md` — 테스트 케이스 문서

### 수정 (8)
- `packages/shared/src/domain/errors.ts` — ErrorCodes 5종 추가 (`ADMIN_NOT_FOUND`, `ADMIN_EMAIL_DUPLICATE`, `ADMIN_LIMIT_EXCEEDED`, `ADMIN_SELF_MODIFICATION_FORBIDDEN`, `ADMIN_LAST_ADMIN_DEMOTION`)
- `packages/shared/src/domain/index.ts` — `password-policy` export 추가
- `packages/backend/src/shared/errors/app-exception.filter.ts` — 신규 ErrorCode HTTP 매핑 (404/409/403)
- `packages/backend/src/modules/admin-ops/application/interfaces.ts` — `AdminUserRepository`에 `create`/`updateRole`/`countByRole` 추가
- `packages/backend/src/modules/admin-ops/infrastructure/prisma-admin-user.repository.ts` — 신규 메서드 구현 (P2025 → null 변환 포함)
- `packages/backend/src/modules/admin-ops/presentation/admin-operators.controller.ts` — `POST /` + `PATCH /:id/role` 추가
- `packages/backend/src/modules/admin-ops/admin-ops.module.ts` — providers 등록 (use case 2 + service 1)
- `packages/backend/src/modules/identity/presentation/dto/signup.dto.ts` — `IsStrongPassword` import 경로 업데이트
- `docs/design/a-idol-req-definition.md` — FR-102 행 신규 등록

### 삭제 (2)
- `packages/backend/src/modules/identity/presentation/dto/password.validator.ts` — shared로 이전됨
- `packages/backend/src/modules/identity/presentation/dto/password.validator.spec.ts` — shared/validators로 이전됨

### 기존 spec 보강 (3)
- `admin-ops/application/get-admin-me.usecase.spec.ts`
- `admin-ops/application/list-operators.usecase.spec.ts`
- `admin-ops/application/refresh-admin-token.usecase.spec.ts`
> 사유: `AdminUserRepository` 인터페이스 확장에 따라 hand-rolled fakes에 `create`/`updateRole`/`countByRole` 추가.

---

## 3. 검증 결과

| 검증 | 명령 | 결과 |
|---|---|---|
| Typecheck | `make typecheck` | ✅ 4 packages all pass |
| Lint | `make lint` | ✅ 0 errors (cms 기존 경고 2건 무관) |
| Unit (admin-ops 범위) | `pnpm --filter @a-idol/backend test -- --testPathPattern="admin-ops"` | ✅ 36 tests pass (8 suites) — 신규 13 + 기존 23 |
| Unit (전체 backend) | `make test` | 333/334 pass. 1건 실패 (`identity/application/logout.usecase.spec.ts`) — **main 브랜치에서도 동일하게 실패하는 사전 회귀**, 본 PR 무관 |

---

## 4. R1 해결 보고 (PLN §6 R1)

**문제**: 비밀번호 정책 함수가 identity 모듈의 presentation/dto에 묶여 있어 admin-ops에서 직접 import 시 모듈 격리 위반.

**해결 방안**: 정공법 채택 — shared로 승격 + decorator는 backend 공용 위치로.
1. `isWeakPassword` 순수함수 → `packages/shared/src/domain/password-policy.ts`
2. `IsStrongPassword` 데코레이터 → `packages/backend/src/shared/validators/strong-password.validator.ts` (shared 함수 사용)
3. identity의 기존 파일 삭제, signup.dto.ts import 경로 업데이트
4. 테스트는 shared 함수에 대한 테스트로 이전

**효과**: identity와 admin-ops가 동일한 비밀번호 정책을 일관되게 적용. 향후 reset-password / change-password 등 후속 모듈에서도 재사용 가능.

---

## 5. 정책 결정 이력

| 결정 | 선택 | 사유 |
|---|---|---|
| 이메일 초대(magic link) | ❌ 미사용 | 2026-05-06 요구사항 확정 — notification 모듈 의존 회피 |
| 비밀번호 발급 | 운영자 직접 입력 | out-of-band(구두/사내 메신저) 운영 책임 |
| 첫 로그인 강제 변경 | 후속 작업 | UX 별도 설계 필요 |
| MFA enrollment | 후속 작업 | 인프라 미구축 |
| audit_logs 테이블 | 후속 작업 | 일단 NestJS Logger로 trace + use case에 `TODO(audit)` 마커 |
| 역할 변경 후 토큰 즉시 무효화 | ❌ 후속 작업 | access TTL 15분이라 영향 제한적 |
| `AdminLoginDto` snake_case | ❌ 별도 PR | ADR-023 cutover 작업 분리 |
| 자기 자신 변경 차단 | ✅ 서버 가드 (`ADMIN_SELF_MODIFICATION_FORBIDDEN`) | 클라이언트 가드는 후속 CMS PLN 책임 |
| 마지막 admin 강등 차단 | ✅ usecase 검증 | `countByRole('admin') ≤ 1` 시 차단 |

---

## 6. 알려진 한계 / 후속 작업

1. **동시성 race**: 3개 admin 동시 생성 시 트랜잭션 부재로 4번째 생성 가능. 운영 가이드라인 + 후속 작업으로 트랜잭션화 검토.
2. **audit_logs 테이블 부재**: POL-010 요구사항이지만 별도 ADR로 deferred. 현재는 NestJS structured log만.
3. **CMS 화면 미구현**: 와이어프레임은 PLN-260506 §1에 확정 (SCR-CMS-OPS-LIST/CREATE/ROLE-CHANGE). CMS 코드 구현은 별도 PLN.
4. **e2e 테스트 부재**: admin-ops 모듈 전반 e2e가 없음 (T-082 후속 시 일괄).
5. **identity logout spec 사전 회귀**: 본 PR 외부 이슈, 별도 픽스 필요.

---

## 7. 배포 상태

- ❌ 미배포 (staging / prod). 본 PR 머지 후 staging 배포 시 다음 절차:
  1. `pnpm install` (변경 없음 — peer deps 추가 없음)
  2. Prisma 마이그레이션 불필요 (스키마 변경 없음)
  3. 기존 admin 계정 그대로 동작
  4. Swagger UI(`/docs`)에서 신규 엔드포인트 검증

---

## 8. 커밋 메시지 초안 (참고)

```
feat(admin-ops): add admin operator create / role-change endpoints (FR-102)

- POST   /api/v1/admin/operators       — 신규 어드민 등록 (admin only)
- PATCH  /api/v1/admin/operators/:id/role — 역할 변경 (admin only)
- 정책: admin ≤ 3, 자기 자신 변경 금지, 마지막 admin 강등 금지, 이메일 unique
- 이메일 초대 미사용 — 운영자 직접 입력 (2026-05-06 요구사항 확정)
- ErrorCodes 5종 추가 + AppExceptionFilter HTTP 매핑
- isWeakPassword 순수함수를 shared로 승격, IsStrongPassword decorator를
  backend 공용 위치로 이동 (identity·admin-ops 공용)
- 신규 use case 2종 + 13 단위 테스트, 기존 spec hand-rolled fake 보강

req-definition.md FR-102 트레이스빌리티 추가.
TCR-260506 / RPT-260506 / PLN-260506 동반.
```
