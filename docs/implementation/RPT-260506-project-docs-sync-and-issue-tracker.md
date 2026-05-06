# RPT-260506 — 프로젝트 문서 동기화 + 이슈 트래커 완료 보고서

> 작성: 2026-05-06 · 관련 분석/계획/TC: REQ-260506, PLN-260506, TC-260506

## 1. 개요

본 작업은 두 개의 독립 트랙을 한 사이클로 묶어 진행했다.

- **Track A — 프로젝트 문서 동기화**: 로컬 `docs/**.md` 파일을 staging
  `https://a-idol-stg.amoeba.site/project` 의 `project_documents` 테이블로 일괄
  반영. seed/CLI/Admin API 3 경로 모두에서 동일 로직(`syncProjectDocs`)을 재사용.
- **Track B — 이슈 트래커**: CMS `/project/issues` 에 List ↔ Kanban 토글 가능한
  이슈 관리 화면을 신규 추가. PostgreSQL `issues` 테이블 + `issue_key_seq`
  시퀀스 기반 `IIS-N` 키 발급, drag-and-drop 으로 칸반 컬럼 간 이동/순서 변경.

## 2. 변경 파일 목록

### Track A — 문서 동기화
- [packages/backend/src/lib/project-doc-sync.ts](packages/backend/src/lib/project-doc-sync.ts) — 순수 함수 `syncProjectDocs` (5 src dir → DB upsert + ARCHIVED 처리 + restore)
- [packages/backend/src/lib/project-doc-sync.spec.ts](packages/backend/src/lib/project-doc-sync.spec.ts) — TC-DOCS-001..005 (5/5 통과)
- [packages/backend/scripts/sync-docs.ts](packages/backend/scripts/sync-docs.ts) — CLI entry (`pnpm sync-docs`)
- [packages/backend/src/modules/project-docs/application/sync-from-repo.usecase.ts](packages/backend/src/modules/project-docs/application/sync-from-repo.usecase.ts) — UseCase wrapper
- [packages/backend/src/modules/project-docs/presentation/admin-project-docs.controller.ts](packages/backend/src/modules/project-docs/presentation/admin-project-docs.controller.ts) — `POST /admin/project-docs/sync-from-repo` (admin only)
- [packages/backend/src/modules/project-docs/project-docs.module.ts](packages/backend/src/modules/project-docs/project-docs.module.ts) — provider 등록
- [packages/backend/prisma/seed.ts](packages/backend/prisma/seed.ts) — inline seed → `syncProjectDocs` 재사용
- [packages/backend/package.json](packages/backend/package.json) — `sync-docs` script
- [packages/backend/tsconfig.seed.json](packages/backend/tsconfig.seed.json) — include 확장
- [packages/cms/src/lib/admin-api.ts](packages/cms/src/lib/admin-api.ts) — `syncProjectDocsFromRepo()` 추가
- [packages/cms/src/features/project/docs-list-page.tsx](packages/cms/src/features/project/docs-list-page.tsx) — admin 전용 "리포지토리에서 다시 가져오기" 버튼
- [deploy/staging/deploy.sh](deploy/staging/deploy.sh) — `--no-docs-sync` 플래그 + 자동 sync 통합

### Track B — 이슈 트래커
- [packages/backend/prisma/schema.prisma](packages/backend/prisma/schema.prisma) — `Issue` 모델 + 3 enum (TYPE/STATUS/PRIORITY)
- [packages/backend/prisma/migrations/20260506052842_add_issues/migration.sql](packages/backend/prisma/migrations/20260506052842_add_issues/migration.sql) — 테이블 + 인덱스 + `CREATE SEQUENCE issue_key_seq`
- [packages/shared/src/domain/issue.ts](packages/shared/src/domain/issue.ts) — 타입 union + 상수 배열 (`ISSUE_KANBAN_COLUMNS` 등)
- [packages/shared/src/contracts/index.ts](packages/shared/src/contracts/index.ts) — `IssueDto`, `KanbanIssuesDto`, `CreateIssueDto`, `UpdateIssueDto`, `MoveIssueDto`
- [packages/backend/src/modules/issue-tracker/domain/issue.ts](packages/backend/src/modules/issue-tracker/domain/issue.ts) — `IssueRecord`, `IssueWithReporters`
- [packages/backend/src/modules/issue-tracker/application/interfaces.ts](packages/backend/src/modules/issue-tracker/application/interfaces.ts) — Repository port + `ISSUE_REPOSITORY` token
- [packages/backend/src/modules/issue-tracker/application/issue.usecases.ts](packages/backend/src/modules/issue-tracker/application/issue.usecases.ts) — List/Get/Create/Update/Move/Delete UseCase
- [packages/backend/src/modules/issue-tracker/application/issue.usecases.spec.ts](packages/backend/src/modules/issue-tracker/application/issue.usecases.spec.ts) — TC-ISS-001..005 (5/5 통과)
- [packages/backend/src/modules/issue-tracker/infrastructure/prisma-issue.repository.ts](packages/backend/src/modules/issue-tracker/infrastructure/prisma-issue.repository.ts) — Prisma 어댑터 (sequence-based key, transactional move)
- [packages/backend/src/modules/issue-tracker/presentation/dto/issue.dto.ts](packages/backend/src/modules/issue-tracker/presentation/dto/issue.dto.ts) — class-validator DTO + view mappers
- [packages/backend/src/modules/issue-tracker/presentation/admin-issues.controller.ts](packages/backend/src/modules/issue-tracker/presentation/admin-issues.controller.ts) — `/api/v1/admin/issues` 라우트
- [packages/backend/src/modules/issue-tracker/issue-tracker.module.ts](packages/backend/src/modules/issue-tracker/issue-tracker.module.ts)
- [packages/backend/src/app.module.ts](packages/backend/src/app.module.ts) — `IssueTrackerModule` 등록
- [packages/cms/src/lib/admin-api.ts](packages/cms/src/lib/admin-api.ts) — `listIssues`, `getIssueBoard`, `getIssue`, `createIssue`, `updateIssue`, `moveIssue`, `deleteIssue`
- [packages/cms/src/features/project/issues-page.tsx](packages/cms/src/features/project/issues-page.tsx) — 단일 파일 안에 `IssuesPage`/`IssuesListView`/`IssuesKanbanView`/`KanbanColumn`/`IssueDetailDrawer`/`IssueFormDialog`
- [packages/cms/src/features/project/project-layout.tsx](packages/cms/src/features/project/project-layout.tsx) — `이슈` 메뉴 (`KanbanSquare` outline)
- [packages/cms/src/app/router.tsx](packages/cms/src/app/router.tsx) — `/project/issues` 라우트
- [packages/cms/src/i18n/i18n.ts](packages/cms/src/i18n/i18n.ts) — `issue` namespace 등록
- [packages/cms/src/i18n/ko/issue.json](packages/cms/src/i18n/ko/issue.json), [packages/cms/src/i18n/en/issue.json](packages/cms/src/i18n/en/issue.json), [packages/cms/src/i18n/vi/issue.json](packages/cms/src/i18n/vi/issue.json), [packages/cms/src/i18n/zh-CN/issue.json](packages/cms/src/i18n/zh-CN/issue.json) — 4 locale × `issue` 사전
- [packages/cms/src/i18n/ko/nav.json](packages/cms/src/i18n/ko/nav.json) 외 3개 — `nav.issues` 키 추가

## 3. 핵심 설계 의사결정

### 3.1 단일 동기화 함수 (Track A)
`syncProjectDocs` 는 prisma client 를 인자로 받는 **순수 함수**로 추출했다. 결과:
- `seed.ts` 가 inline 코드(110 LOC)를 import 한 줄로 대체
- Admin API (`POST /sync-from-repo`)와 CLI (`pnpm sync-docs`)가 동일 로직 사용
- 테스트는 fake prisma Map + 실제 tmp filesystem 으로 5 시나리오 검증

ARCHIVED 처리는 `sourceType=FILE` row 중 현재 스캔에 없는 path 를 일괄 표기.
재등장 시 `restoreArchived=true` 로 자동 복원.

### 3.2 Issue.key 발급 (Track B)
DB 시퀀스 `issue_key_seq` 로 `IIS-1`, `IIS-2`, … 발급. Prisma `@default` 미사용
이유:
- 시퀀스 값은 트랜잭션 외에서도 advance 하는 PG 특성 — 충돌 없는 단조 증가 보장
- App 코드에서 `prisma.$queryRaw\`SELECT nextval('issue_key_seq')\`` 한 번 호출
  후 `prisma.issue.create({ data: { key, ... } })` — 명시적 흐름이라 디버깅 용이

### 3.3 칸반 이동 트랜잭션 (Track B)
`PrismaIssueRepository.move()` 는 `prisma.$transaction` 내에서:
- **같은 컬럼**: `orderInColumn` 재배치 후 affected row 일괄 update
- **다른 컬럼**: source 컬럼 close-gap → target 컬럼 insert-at-index → 모두 update

Race 가능성은 단일 admin/operator 동시 사용 가정으로 낙관적 처리 (FE invalidate
on success). 추후 추가 사용자 발생 시 advisory lock 또는 version column 고려.

### 3.4 DnD 라이브러리 미도입 (Track B)
`@dnd-kit/*` 대신 HTML5 native drag-and-drop API 사용 — 번들 크기 ~50KB 절감,
의존성 0 추가. 칸반 카드 5 컬럼 × 평균 10장 규모에서 충분한 UX.

## 4. 테스트 결과

### 4.1 단위 테스트
| Suite | Pass | Total | Note |
|-------|------|-------|------|
| `project-doc-sync.spec.ts` | 5 | 5 | TC-DOCS-001..005 |
| `issue.usecases.spec.ts` | 5 | 5 | TC-ISS-001..005 |

```
Test Suites: 2 passed (issue + docs)
Tests:       10 passed
```

전체 backend jest: 315/316 통과, 1 실패는 **사전 존재**하던 `logout.usecase.spec.ts:58` (revoked flag 매핑) — 본 작업 무관.

### 4.2 정적 검사
- `pnpm --filter @a-idol/backend exec tsc --noEmit` — clean
- `pnpm --filter @a-idol/cms exec tsc --noEmit` — clean
- `pnpm --filter @a-idol/backend lint` — clean (issue dto 미사용 import 제거)
- `pnpm --filter @a-idol/cms lint` — pre-existing 2 warnings only
- `pnpm --filter @a-idol/shared build` — clean

### 4.3 마이그레이션
- `20260506052842_add_issues` — 적용 완료. `issue_key_seq` 시퀀스 수동 생성 후
  migration.sql 에도 `CREATE SEQUENCE IF NOT EXISTS` append. (재배포 시 멱등.)

## 5. 회귀 영향 분석

| 영역 | 영향 | 검증 |
|------|------|------|
| `project_documents` 테이블 | seed 가 `syncProjectDocs` 사용 — 신규/갱신/보관 동일 결과. 기존 row 변동 없음 (content hash 기준). | seed 재실행 후 5/5 unit test 통과 |
| `_prisma_migrations` 테이블 | 신규 row 1개 (`add_issues`) — 기존 마이그레이션 영향 없음 | DB 적용 확인 |
| Admin API 라우트 | `/api/v1/admin/issues/*` 신규 — 기존 라우트 충돌 없음 (네임스페이스 분리) | typecheck pass |
| CMS 라우트 | `/project/issues` 신규 — `RequireRole admin/operator` 가드 (`/project` 부모에서 상속) | router.tsx |
| i18n | `issue` namespace 신규 — 기존 키 변경 없음 | 4 locale json 일관성 검증 |

## 6. 후속 작업 / 알려진 한계

- **칸반 동시 이동 race**: 다중 admin 동시 사용 시 `orderInColumn` 충돌 가능. 현재는
  마지막 write wins. 운영자 2 인 이상 협업 시 advisory lock 또는 optimistic version
  도입 검토.
- **이슈 댓글/첨부**: 현재 description 단일 필드. 협업이 활성화되면 별도 issue
  comment / attachment 모듈 추가.
- **검색 인덱스**: `q` 필터는 `LIKE` 기반. 이슈 1k+ 누적 시 PG `pg_trgm` GIN 인덱스
  또는 ts_vector 검색 검토.
- **삭제 권한**: 현재 admin only. operator 도 본인 작성건 한정 삭제 허용은 후속 ADR.
- **이슈 → 문서 백링크**: `labels` 필드에 `doc:slug` 컨벤션을 적용해 추후 양방향
  링크 자동 추출 가능 — UI 미구현.

## 7. 메모리/문서 갱신

- 본 보고서: `docs/implementation/RPT-260506-project-docs-sync-and-issue-tracker.md`
- 사전 산출물: `REQ-260506`, `PLN-260506`, `TC-260506`
- 메모리 갱신 없음 (기존 컨벤션 준수, 새로운 패턴/예외 없음).
