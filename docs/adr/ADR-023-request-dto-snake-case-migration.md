---
id: ADR-023
title: Request DTO snake_case migration (Phase D)
status: Accepted
date: 2026-04-27
author: Gray Kim
related_tasks: [T-082, T-084, T-088]
related_context: amb-starter-kit v2.0 standardization
---

## Context

CLAUDE.md "amb-starter-kit deviation" 표:

| 항목 | 상태 |
|---|---|
| DTO case (Request=snake_case, Response=camelCase) | ✅ Applied (new code); existing backend Request DTOs use camelCase — migrate during Phase D |

현재 상태:

- 모든 Request DTO 가 **camelCase** (예: `SignupDto.deviceId`, `LoginDto.refreshToken`,
  `UpdateUserMeDto.avatarUrl`, `CreateDesignAssetBody.fileUrl`, `CreateProjectDocBody.sourceType`).
- Response DTO 는 이미 camelCase (의도된 표준).
- 모바일 / CMS / ITC 모두 camelCase request body 로 호출 중.

amb-starter-kit v2.0 표준 vs 현 코드 사이의 gap 을 Phase D 안에 좁힌다.

## Decision

**모듈 단위 hard-cutover**. 각 모듈의 Request DTO 필드를 snake_case 로 변경하고,
같은 PR 에서 모든 클라이언트 (mobile / CMS / ITC) 호출부 도 함께 수정. 단 한
번이라도 wire format 이 깨진 채로 main 에 올라가지 않도록 atomic 하게 묶는다.

### 채택 안 한 대안

- **Dual-accept (snake_case + camelCase alias)** — `@Transform` 으로 양 케이스 모두
  수용. 점진적 cutover 가능하지만 DTO 표면이 두 배가 되고 schema 검증 로직
  복잡. staging burn-in 만 거치는 구조에서는 불필요한 비용.
- **Big-bang (한 번에 전 모듈)** — 단일 거대 PR. 리뷰 어려움 + regression 발생 시
  롤백 단위가 큼.

### 모듈 우선순위 (핵심 트래픽 → 가장자리 순)

| 순서 | 모듈 | DTO 수 | 영향 받는 클라이언트 |
|---|---|---|---|
| 1 (pilot) | identity | signup / login / refresh / update-me | mobile (auth, settings) + ITC (auth.spec, security.spec, app-harness.signupUser) |
| 2 | admin-ops | admin-login / unlock-account | CMS (auth, operators) + ITC |
| 3 | catalog | admin idol/agency/schedule CRUD | CMS (idols / agencies) + ITC |
| 4 | fandom | cheer 등록 | mobile + ITC |
| 5 | chat | send-message | mobile (chat) |
| 6 | commerce | create-purchase | mobile + ITC |
| 7 | audition | round/entry/voterule | CMS + ITC |
| 8 | photocard | template/draw/grant | CMS / mobile + ITC |
| 9 | design-assets | create/update | CMS only |
| 10 | project-docs | create/update | CMS only |

후순위는 구체적 일정 미정 — pilot 결과 후 재평가.

### 실행 절차 (모듈별)

각 모듈 PR 의 단위 작업:

1. **DTO 필드 rename**: `class CreateXBody` 의 camelCase 필드를 snake_case 로 (필요 시
   `@Expose({ name: '...' })` 사용).
2. **Mapper 갱신**: input 을 application 레이어로 전달할 때 다시 camelCase 도메인
   property 로 변환 (도메인은 변경 없음).
3. **Swagger `@ApiProperty`** 의 `name` 필드도 정합 (Swagger UI 노출 정확).
4. **클라이언트 호출부**:
   - 모바일: `apiFetch` body 인자 snake_case 로
   - CMS: `adminApi.*` body 인자 snake_case 로
   - 필요 시 `@a-idol/shared` 의 Create/Update DTO interface 도 변경 (wire shape이라 동일)
5. **ITC**: `.send({...})` 의 키들 snake_case 로 + `signupUser` 같은 helper.
6. **회귀 검증**:
   - `pnpm --filter @a-idol/backend test:integration`
   - `pnpm --filter @a-idol/mobile test`
   - `pnpm --filter @a-idol/cms typecheck && pnpm --filter @a-idol/cms build`

### Response 는 변경 없음

Response DTO 는 이미 camelCase (CLAUDE.md 표준). 본 마이그레이션은 **Request 본문/쿼리만**.

### Path / Query parameter

- Path param (`/admin/project-docs/:slug`) 은 단일 토큰이라 케이스 무관.
- Query param 은 amb-starter-kit 권고 대로 snake_case (`?sort_by=popularity&page_size=20`).
  현재 대부분 단일 토큰이라 영향 미미. 발견 시 동일 모듈에서 함께 처리.

## Consequences

### 긍정

- amb-starter-kit v2.0 컨벤션 준수 → 다른 amoeba 프로젝트 와 호환성.
- 새 신규 코드 (디자인 자산 / 프로젝트 관리) 도 일관성 회복 (이번 마이그레이션 대상에 포함).

### 부정

- 모든 모듈이 끝나기 전까지 코드베이스에 두 케이스가 공존 → 새 코드 작성 시
  주의 (해당 모듈이 마이그레이션 완료됐는지 확인).
- 모바일이 OTA / store update 없이 staging API 만 가리키는 구조라면 wire 깨짐.
  → mobile + backend 동시 ship 강제 (commit atomicity 로 보장).

### 대응

- 각 모듈 PR 에 **마이그레이션 완료 체크리스트** 첨부.
- WBS 에 `T-089 (Request DTO snake_case migration)` 신규 task 등록 — 진행률 트래킹.

## Status legend

- pilot 완료: identity (이 ADR 의 후속 commit)
- 잔여 9개 모듈: WBS T-089 진행률로 추적
