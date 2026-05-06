# REQ-260507 — CMS 운영자 관리 UI (신규 등록 + 역할 변경)

- 작성일: 2026-05-07
- 작성자: Gray Kim
- 상태: 분석 완료 (PLN 승인 대기)
- 관련 FR: **FR-102** (CMS 측 보강) — backend 는 RPT-260506 에서 완료, CMS UI 만 후속
- 선행 문서: [REQ-260506](REQ-260506-cms-admin-account-management.md), [PLN-260506](../plan/PLN-260506-cms-admin-account-management.md), [RPT-260506](../implementation/RPT-260506-cms-admin-account-management.md)

---

## 1. 배경

FR-102 backend 는 staging 라이브 (`POST /admin/operators` + `PATCH /admin/operators/:id/role`). PLN-260506 §0 에서 CMS 화면을 의도적으로 제외했고 와이어프레임만 §1 에 확정. 본 REQ 는 그 와이어프레임을 코드로 옮기는 후속 작업.

backend 변경 없음 — 기존 엔드포인트 호출만 추가.

## 2. AS-IS

[packages/cms/src/features/operators/operators-page.tsx](../../packages/cms/src/features/operators/operators-page.tsx)

- ✅ **목록**: `GET /admin/operators` 호출, 테이블 표시 (이메일/이름/역할/상태/최근 로그인/생성일)
- ✅ **계정 잠금 해제**: `UnlockAccountPanel` 모달
- ❌ **신규 등록 모달**: 없음 (페이지 카피 "*신규 추가·역할 변경·정지는 다음 sprint*")
- ❌ **역할 변경 모달**: 없음
- ❌ **admin-api.ts 의 `createOperator` / `updateRole` 메서드**: 없음

## 3. TO-BE

| 기능 | 동작 | 권한 |
|---|---|---|
| **`[+ 신규 어드민]` 버튼** (헤더) | `OperatorFormDialog` 모달 오픈 | admin only (UI 가드 + 서버 가드) |
| **신규 등록 모달** | 이메일 / 이름 / 비밀번호 / 역할 입력 → `POST /admin/operators` → 성공 시 평문 비번 1회 표시 confirm + 목록 갱신 | admin only |
| **목록 행 ⋮ 메뉴 → "역할 변경"** | `RoleChangeDialog` 모달 오픈 | admin only, 본인 행 비활성 |
| **역할 변경 모달** | 현재 역할 표시 + 신규 역할 select → `PATCH /admin/operators/:id/role` → 성공 시 목록 갱신 | admin only |
| **에러 인라인 처리** | `ADMIN_EMAIL_DUPLICATE` (이메일 필드 하단), `ADMIN_LIMIT_EXCEEDED` (역할 라디오 하단), `ADMIN_LAST_ADMIN_DEMOTION` (모달 하단), `ADMIN_SELF_MODIFICATION_FORBIDDEN` (Toast) | — |

페이지 카피 "*…다음 sprint*" 제거.

와이어프레임: PLN-260506 §1.2~§1.4 그대로 적용 (SCR-CMS-OPS-LIST/CREATE/ROLE-CHANGE).

## 4. 갭 분석

| 영역 | AS-IS | TO-BE | 갭 |
|---|---|---|---|
| `admin-api.ts` 의 운영자 write 메서드 | 없음 | `createOperator` + `updateRole` | **2 메서드 추가** |
| 헤더 버튼 | 없음 | `[+ 신규 어드민]` (admin only) | 컴포넌트 + 권한 가드 |
| 모달 — 등록 | 없음 | `OperatorFormDialog` | 신규 컴포넌트 |
| 모달 — 역할 변경 | 없음 | `RoleChangeDialog` | 신규 컴포넌트 |
| 행 ⋮ 메뉴 | 없음 | "역할 변경" 항목 | 신규 컴포넌트 (또는 행 클릭 → modal) |
| 평문 비번 1회 표시 | 없음 | 등록 성공 후 confirm 다이얼로그 (PLN-260506 §1.3 명세) | 신규 |
| i18n | 일부 (admin/operator 등) | `operator.errors.*` / `operator.modal.*` 4언어 | namespace 추가 또는 common 확장 |
| 자기 자신 가드 | 없음 | 본인 행의 ⋮ "역할 변경" 비활성 + Toast 안내 | 클라이언트 가드 (서버 fail-safe 별개) |
| 라우터 가드 | `/operators` admin only ✅ | 변경 없음 | — |

## 5. 사용자 플로우

PLN-260506 §1 와 동일. 핵심만 재기재:

```
[/operators 페이지] → admin 로그인 → 헤더 [+ 신규 어드민] 클릭
  → 모달: email / display_name / password / role 입력
  → [등록] → POST /admin/operators
  → 201 → 평문 비번 1회 표시 다이얼로그 ("안전한 채널로 전달") → close
  → 목록 갱신 + Toast "어드민이 등록되었습니다"

[행 ⋮ 메뉴] → "역할 변경" (본인 행 비활성)
  → 모달: 대상 / 현재 역할 / 신규 역할 select
  → [저장] → PATCH /admin/operators/:id/role
  → 200 → 목록 행 갱신 + Toast "역할이 변경되었습니다"
```

## 6. 결정 포인트

| # | 결정 | 권장 |
|---|---|---|
| 1 | 평문 비밀번호 1회 표시 확인 다이얼로그 | **포함** (PLN-260506 §1.3) — 운영자가 신규 사용자에게 out-of-band 전달용. 모달 입력값을 클라이언트 메모리에 임시 보유 |
| 2 | 자동 비밀번호 생성 버튼 (`[↻ 자동 생성]`) | **포함 안 함** (선택 구현) — 본 작업 범위 축소. 후속 작업으로 분리 |
| 3 | 행 클릭 vs 행 ⋮ 메뉴 | **⋮ 메뉴** (PLN-260506 §1.2 와이어프레임) |
| 4 | i18n 신규 namespace `operator` | **추가** — 기존 common 에 inline 보다 namespace 분리가 일관됨 |
| 5 | suspend / unsuspend / 비밀번호 reset | **본 작업 제외** — 후속 |
| 6 | 자기 자신 ⋮ 메뉴 비활성 vs hide | **비활성 (회색 + tooltip)** — UI hint 명시 |

## 7. 기술 제약사항

- backend 변경 없음 → Prisma 마이그레이션 / API 신규 모두 불필요
- staging 적용 시 backend 재배포 불요 — CMS dist rsync 만으로 충분
- ErrorCode HTTP 매핑은 backend 에 이미 적용됨 (409/403/404). 클라이언트는 응답 `code` 를 보고 분기

## 8. 영향 범위

| 항목 | 영향 |
|---|---|
| Backend | 없음 |
| Prisma | 없음 |
| CMS 다른 페이지 | 없음 (operators 페이지 한정) |
| CMS 번들 | 모달 2개 추가 → +~5KB gzip 추정 |
| i18n | `operator` namespace 신규 4 언어 |
| 트레이스빌리티 | FR-102 행의 "⬜ (CMS)" → "✅" 갱신 |
| 라우터 / GNB | 변경 없음 (`/operators` 는 이미 admin only) |
