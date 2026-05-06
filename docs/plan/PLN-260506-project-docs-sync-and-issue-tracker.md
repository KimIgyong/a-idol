# PLN-260506 — 프로젝트 문서 동기화 & 이슈 트래커 작업 계획

| 항목 | 값 |
|---|---|
| ID | PLN-260506 |
| 연관 REQ | [REQ-260506](../analysis/REQ-260506-project-docs-sync-and-issue-tracker.md) |
| 작성일 | 2026-05-06 |
| 작성자 | Gray Kim |

---

## 1. 작업 분해 (WBS)

### Track A — 문서 동기화 (요구 1)

| Task | 설명 | 산출물 | 의존 | 예상 |
|---|---|---|---|---|
| **T-A1** | `prisma/seed.ts` 의 project-doc 부분을 `lib/project-doc-sync.ts` 로 추출 (순수 함수, prisma client 주입) | `packages/backend/src/lib/project-doc-sync.ts` | - | S |
| **T-A2** | `pnpm --filter @a-idol/backend sync-docs` 스크립트 (CLI entry) | `packages/backend/scripts/sync-docs.ts` + `package.json` script | T-A1 | XS |
| **T-A3** | Admin 재동기화 use-case + controller endpoint `POST /admin/project-docs/sync-from-repo` | `application/sync-from-repo.usecase.ts`, controller method | T-A1 | S |
| **T-A4** | sync 결과 archive 처리 로직 (FR-DOCS-SYNC-007) | T-A1 보강 + 단위 테스트 | T-A1 | S |
| **T-A5** | CMS "리포지토리에서 다시 가져오기" 버튼 + confirm + toast | `docs-list-page.tsx`, `admin-api.ts` 메서드 추가 | T-A3 | S |
| **T-A6** | `deploy/staging/deploy.sh` 에 `--no-docs-sync` 옵션, 기본 자동 실행 | shell diff | T-A2 | XS |

### Track B — 이슈 트래커 (요구 2)

| Task | 설명 | 산출물 | 의존 | 예상 |
|---|---|---|---|---|
| **T-B1** | Prisma schema: `Issue` 모델 + enums + 시퀀스 + migration | `prisma/schema.prisma`, `migrations/<ts>_add_issues/` | - | S |
| **T-B2** | `@a-idol/shared` 도메인 entity + DTO 계약 (List / Kanban / Create / Update / Move) | `packages/shared/src/domain/issue.ts`, `contracts/issue.ts` | T-B1 | S |
| **T-B3** | `issue-tracker` 모듈 4-layer 골격 (domain/application/infrastructure/presentation) | `packages/backend/src/modules/issue-tracker/**` | T-B2 | M |
| **T-B4** | Use-cases: `listIssues`, `getIssue`, `createIssue`, `updateIssue`, `moveIssue`, `deleteIssue` (+ 단위 테스트) | spec.ts 각 use-case | T-B3 | M |
| **T-B5** | Prisma 어댑터: `prisma-issue.repository.ts` (트랜잭션 reorder 포함) | infrastructure/ | T-B3 | S |
| **T-B6** | Admin controller `admin-issues.controller.ts` (RBAC, snake_case Request DTO) | presentation/ | T-B4, T-B5 | S |
| **T-B7** | CMS API client 메서드 (`adminApi.listIssues / kanban / create / update / move / delete`) | `cms/src/lib/admin-api.ts` | T-B6 | XS |
| **T-B8** | CMS `IssuesPage` shell + view 토글 + URL/localStorage 상태 | `features/project/issues/issues-page.tsx` | T-B7 | S |
| **T-B9** | List view (sortable table + drawer 편집) | `issues-list-view.tsx`, `issue-detail-drawer.tsx` | T-B8 | M |
| **T-B10** | Kanban view (`@dnd-kit/core` 기반 6컬럼 DnD) | `issues-kanban-view.tsx`, `issue-card.tsx`, `kanban-column.tsx` | T-B8 | M |
| **T-B11** | "이슈 추가" 모달 폼 (title 필수 + 옵션 필드) | `issue-create-dialog.tsx` | T-B9 | S |
| **T-B12** | i18n `issue` namespace 4언어 (`ko/en/vi/zh-CN`) | `cms/src/i18n/<locale>/issue.json` | T-B8 | XS |
| **T-B13** | sub-nav 항목 추가, router 등록, RequireRole 적용 | `project-layout.tsx`, `app/router.tsx` | T-B8 | XS |

### Track C — 검증

| Task | 설명 | 산출물 |
|---|---|---|
| **T-C1** | TC 작성 (`docs/test/TC-260506-…md`) | TC 문서 |
| **T-C2** | 단위/통합 테스트 실행 + lint + typecheck | 결과 캡처 |
| **T-C3** | 스테이징 deploy & smoke (`make smoke`, sync API 호출 확인) | 캡처 |
| **T-C4** | 완료 보고서 `RPT_260506_project-docs-sync-and-issue-tracker.md` | 보고서 |

### 예상 규모

S=0.5d / M=1d / L=2d 기준 — Track A ≈ 1.5d, Track B ≈ 4d, Track C ≈ 0.5d. **총 ≈ 6d**.

## 2. 의존성 다이어그램

```
T-A1 ─┬─> T-A2 ─> T-A6
      ├─> T-A3 ─> T-A5
      └─> T-A4

T-B1 ─> T-B2 ─> T-B3 ─┬─> T-B4 ─> T-B6 ─> T-B7 ─> T-B8 ─┬─> T-B9 ─┬─> T-B11
                       └─> T-B5 ─────────────────────────┤         └─> T-B12
                                                          └─> T-B10
                                                          └─> T-B13
```

## 3. 화면 구성안 (UI 와이어프레임)

### 3.1 `/project/docs` — 동기화 버튼 추가 (AS-IS → TO-BE)

**AS-IS**
```
┌─ /project/docs ─────────────────────────────────────────────────┐
│ 문서 (ADR / 설계)                                                 │
│ [ 검색 ▢ ] [ 카테고리 ▼ ] [ 상태 ▼ ]                                │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ slug             │ 제목              │ 카테고리 │ 상태 │ 버전│ │
│ │ adr-ADR-010-…    │ Admin User 분리   │ ADR      │ APP  │ 1   │ │
│ │ ...                                                         │ │
│ └────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

**TO-BE**
```
┌─ /project/docs ─────────────────────────────────────────────────┐
│ 문서 (ADR / 설계)               [🔄 리포지토리에서 다시 가져오기] │  ← admin only
│ [ 검색 ▢ ] [ 카테고리 ▼ ] [ 상태 ▼ ]                                │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ ... (동일)                                                  │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ 클릭 → confirm("로컬 docs/* 를 다시 읽어 갱신합니다. 진행?")     │
│      → 로딩 spinner → toast: "신규 3, 갱신 12, 보관 1 (320ms)"   │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 `/project/issues` — 신규 페이지 (List view)

```
┌─ /project (sub-nav 좌측) ──┐  ┌─ /project/issues — List ────────────────────────────────┐
│ 개요                        │  │ 이슈                  [📋 List] [🟰 Kanban]   [+ 이슈 추가] │
│ 문서 (ADR/설계)             │  │ ┌──────────────────────────────────────────────────────┐ │
│ 산출물                      │  │ │ 🔎 검색  type[▼] status[▼] priority[▼] assignee[▼] │ │
│ WBS                         │  │ └──────────────────────────────────────────────────────┘ │
│ 작업 태스크                 │  │ ┌──────────────────────────────────────────────────────┐ │
│ ▶ 이슈              ◀ NEW   │  │ │ Key   │ 제목         │ Type │ Status │ P  │ 담당 │ 기한 │ │
│                             │  │ │ IIS-1 │ Sync 동작 점검│ TASK │ TODO   │ P0 │ Gray │ 5/8  │ │
│                             │  │ │ IIS-2 │ Kanban DnD 버그│ BUG │ IN_PRG │ P1 │ —    │ —    │ │
│                             │  │ │ ...                                                 │ │
│                             │  │ └──────────────────────────────────────────────────────┘ │
│                             │  │ ▼ 행 클릭 → 우측 drawer (제목/설명/속성 인라인 편집 + Save) │
└─────────────────────────────┘  └──────────────────────────────────────────────────────────┘
```

### 3.3 `/project/issues` — Kanban view

```
┌─ /project/issues — Kanban ──────────────────────────────────────────────────────────────┐
│ 이슈                          [📋 List] [🟰 Kanban◉]  필터: [type▼][P▼][담당▼]  [+ 추가] │
│ ┌─ BACKLOG (3) ┐ ┌─ TODO (4) ┐ ┌─ IN_PROGRESS (2) ┐ ┌─ REVIEW (1) ┐ ┌─ DONE (12) ┐ ┌ CANCELED (0) ┐ │
│ │┌──────────┐│ │┌──────────┐│ │┌──────────────┐│ │┌──────────┐│ │┌──────────┐│ │              │ │
│ ││IIS-7     ││ ││IIS-1     ││ ││IIS-3 [P0]    ││ ││IIS-5 [P1]││ ││IIS-9     ││ │              │ │
│ ││Add CSV…  ││ ││Sync 동작 ││ ││Kanban impl   ││ ││Doc sync  ││ ││Migrate   ││ │              │ │
│ ││[P2] (—)  ││ ││[P0] @Gray││ ││@Gray  due 5/9││ ││@PM       ││ ││[P3] @Gray││ │              │ │
│ │└──────────┘│ │└──────────┘│ │└──────────────┘│ │└──────────┘│ │└──────────┘│ │              │ │
│ │┌──────────┐│ │┌──────────┐│ │┌──────────────┐│ │            │ │     ⋮      │ │              │ │
│ ││IIS-8 …   ││ ││IIS-2 …   ││ ││IIS-4 …       ││ │            │ │            │ │              │ │
│ │└──────────┘│ │└──────────┘│ │└──────────────┘│ │            │ │            │ │              │ │
│ └────────────┘ └────────────┘ └────────────────┘ └────────────┘ └────────────┘ └──────────────┘ │
│                                                                                                  │
│ DnD: 카드 → 다른 컬럼 drop → optimistic update + PATCH /move (rollback on fail)                 │
│ 카드 클릭 → 상세 drawer (List view 와 동일 컴포넌트 재사용)                                       │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 "이슈 추가" 모달

```
┌─ 새 이슈 ─────────────────────────────────────┐
│ 제목 *  [_______________________________]     │
│ 설명    [_______________________________]     │
│         [   markdown 지원                ]     │
│ 유형 *  ( • TASK   ○ BUG   ○ STORY  ○ RISK ) │
│ 우선순위 ( ○ P0  • P1  ○ P2  ○ P3 )         │
│ 상태    [ BACKLOG ▼ ]                         │
│ 담당자  [ Gray ▼ (admin/operator 만)  ]       │
│ 기한    [ YYYY-MM-DD ]   라벨 [tag1, tag2]    │
│                                                │
│                        [취소]  [등록 ▶]        │
└────────────────────────────────────────────────┘
```

### 3.5 상세 Drawer (List/Kanban 공통)

```
┌─ Drawer (오른쪽 슬라이드) ─────────────────────────┐
│ IIS-3 · Kanban impl                          [✖]  │
│ ───────────────────────────────────────────────── │
│ 상태  [IN_PROGRESS ▼]   P  [P0 ▼]   유형 [TASK ▼] │
│ 담당  [Gray ▼]          기한 [2026-05-09]        │
│ 라벨  [frontend, kanban]                          │
│ ───────────────────────────────────────────────── │
│ 설명 (markdown)                                    │
│ ┌────────────────────────────────────────────┐ │
│ │ - dnd-kit 적용                              │ │
│ │ - 컬럼별 orderInColumn 트랜잭션              │ │
│ └────────────────────────────────────────────┘ │
│ ───────────────────────────────────────────────── │
│ 작성: Gray · 2026-05-06 14:21 · v3                │
│                            [삭제(admin)] [저장 ▶] │
└────────────────────────────────────────────────────┘
```

## 4. 기술 결정 사항

| 항목 | 결정 | 근거 |
|---|---|---|
| DnD 라이브러리 | `@dnd-kit/core` + `@dnd-kit/sortable` | React 19 호환, accessibility 지원, 이미 CMS에 다른 DnD 의존 없음 |
| Sync API 인증 | `AdminJwtAuthGuard` + `Roles('admin')` | 기존 admin-ops 패턴 동일 |
| Sync 파일 스캔 root | `process.env.PROJECT_DOCS_REPO_ROOT ?? path.resolve(__dirname,'../../../..')` | 컨테이너/로컬 양쪽 동작, 기본은 monorepo root 자동 추정 |
| Issue key 생성 | PostgreSQL sequence `issue_key_seq` + Prisma `@default(dbgenerated(...))` 또는 트리거 | 충돌 없음, 단일 트랜잭션 |
| orderInColumn | 정수, 컬럼 단위 0..N. move 시 영향 받는 행만 update (`WHERE status=? AND order_in_column BETWEEN`) | 간단·정확. fractional ordering 은 미사용 (200건 기준 충분) |
| Drawer state | URL search param `?issue=IIS-3` | 공유 가능 + 새로고침 후에도 유지 |
| View 토글 상태 | `localStorage('a-idol.cms.issues.view')` | 사용자 메모리 패턴 동일 |
| Request DTO casing | snake_case (CLAUDE.md 신규 코드 규칙) | 컨벤션 강제 |
| 코멘트/첨부 | MVP 제외 (REQ N2/N3) | 범위 명확화 |

## 5. 변경되는 파일 (예상)

```
packages/shared/src/domain/issue.ts                       (NEW)
packages/shared/src/contracts/issue.ts                    (NEW)
packages/backend/prisma/schema.prisma                     (MOD)
packages/backend/prisma/migrations/<ts>_add_issues/       (NEW)
packages/backend/src/lib/project-doc-sync.ts              (NEW)
packages/backend/scripts/sync-docs.ts                     (NEW)
packages/backend/src/modules/project-docs/
   application/sync-from-repo.usecase.ts                  (NEW)
   presentation/admin-project-docs.controller.ts          (MOD)
packages/backend/src/modules/issue-tracker/               (NEW dir)
   domain/issue.ts
   application/{interfaces,*.usecase}.ts                  (NEW)
   infrastructure/prisma-issue.repository.ts              (NEW)
   presentation/admin-issues.controller.ts                (NEW)
   presentation/dto/issue.dto.ts                          (NEW)
   issue-tracker.module.ts                                (NEW)
packages/backend/src/app.module.ts                        (MOD: register module)
packages/cms/src/lib/admin-api.ts                         (MOD)
packages/cms/src/features/project/project-layout.tsx     (MOD: sub-nav)
packages/cms/src/features/project/docs-list-page.tsx     (MOD: sync btn)
packages/cms/src/features/project/issues/                 (NEW dir)
   issues-page.tsx
   issues-list-view.tsx
   issues-kanban-view.tsx
   issue-card.tsx
   kanban-column.tsx
   issue-detail-drawer.tsx
   issue-create-dialog.tsx
packages/cms/src/i18n/{ko,en,vi,zh-CN}/issue.json         (NEW × 4)
packages/cms/src/i18n/i18n.ts                              (MOD: add ns)
packages/cms/src/app/router.tsx                            (MOD: route)
deploy/staging/deploy.sh                                   (MOD: --no-docs-sync)
docs/analysis/REQ-260506-…md                              (DONE)
docs/plan/PLN-260506-…md                                  (DONE)
docs/test/TC-260506-…md                                   (다음 단계)
```

## 6. 리스크 & 완화

| 리스크 | 완화 |
|---|---|
| Docker 이미지에 `docs/` 포함 안 되면 sync API 동작 X | deploy.sh 가 이미 `docs/` 포함 rsync 함. 컨테이너 안에서는 `/app/docs` 경로 확인. 누락 시 README 보강 |
| Kanban DnD 모바일 미고려 (CMS 는 데스크톱 only) | sub-nav 자체가 데스크톱 전제 — 스코프 외 |
| `@dnd-kit` 신규 의존 | 번들 사이즈 ~20KB. 수용 가능 |
| sequence 사용 시 Prisma 마이그레이션 raw SQL 필요 | migration 에 `CREATE SEQUENCE issue_key_seq` 명시 |
| 이슈 sync ↔ 문서 sync 동시 호출 시 lock | 별도 테이블이라 영향 없음 |

## 7. 진행 게이트 (사용자 승인 지점)

- [ ] **G1**: 본 PLN + REQ 검토 → 사용자 OK → Track C/T-C1 (TC 작성) 진행
- [ ] **G2**: TC 작성 완료 → 사용자 "구현해" 지시 → Track A·B 구현 시작
- [ ] **G3**: 구현 완료 → 테스트 실행 + 보고서 작성

> 본 작업 계획서는 사용자 메모리 워크플로우 규칙(분석→계획→TC 후 사용자 승인 → 구현)을 따릅니다.
