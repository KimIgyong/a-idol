# PLN-260507 — CMS 프로젝트 페이지 재구성 + 이슈 보강 + 노트/게시판 신설

- 작성일: 2026-05-07
- 작성자: Gray Kim
- 상태: **승인 대기 (사용자 진행 지시 필요)**
- 선행 문서: [REQ-260507](../analysis/REQ-260507-project-page-redesign-and-notes.md)
- 예상 소요 (전체): **26 ~ 34h** — 4 phases로 분할 머지 권장

---

## 0. 작업 범위 / 단계 분리

본 작업은 **4 Phase로 분할**하여 단계별 머지/검증을 권장. 각 phase는 독립 PR로 분리 가능하며, 최종 머지 순서는 1 → 2 → 3 → 4.

| Phase | 범위 | 예상 | DB 변경 | 신규 의존성 |
|---|---|---|---|---|
| **P1** | 메뉴 재구성 + admin-only 가드 | 2–3h | ❌ | ❌ |
| **P2** | 이슈 작성자 표시 + 시작일 필드 | 4–5h | ✅ Issue.startAt | ❌ |
| **P3** | 리치에디터 + 파일/이미지 업로드 | 12–16h | ✅ Attachment | tiptap, sanitize-html, multer |
| **P4** | 프로젝트 노트/게시판 | 8–10h | ✅ ProjectNote | (P3 인프라 재사용) |

> **본 PLN은 Phase 1~4 전체 설계를 포함**한다. 승인 시점에 사용자 결정에 따라:
> - **(A) 일괄 진행**: 본 PLN 그대로 4단계 순차 구현
> - **(B) Phase 1만 진행 후 재평가**: 본 PLN의 §3.1만 수행하고 P2~P4는 후속 PLN 분리
>
> 권장: **(B)** — Phase 1은 빠른 운영 효과(메뉴 정리)이고 변경면 작아 즉시 머지 가능. P2~P4는 인프라 도입 비용이 커서 별도 평가가 안전.

✅ 본 PLN 포함
- Phase 1~4 전체 범위 설계 / 화면구성도 / 단계별 구현 계획
- 트레이스빌리티 매트릭스 갱신 (FR-103, FR-104)

⛔ 본 PLN 제외
- S3 어댑터 (인터페이스 슬롯만, prod 적용 전 별도 작업)
- 첨부파일 access control(서명 URL, 권한별 접근) — staging 단계는 단순 publish, prod 전 보강
- 노트 댓글 / 멘션 / 활동 피드 (후속)
- 이슈 description plaintext → HTML 일괄 마이그레이션 (lazy wrap만)
- 모바일 앱 영향 없음

---

## 1. 화면구성도 (UI Wireframe)

### 1.1 화면 목록

| 화면 ID | 명칭 | 진입 경로 | 권한 | Phase |
|---|---|---|---|---|
| **SCR-PROJ-NAV** | 프로젝트 GNB / 탭 | `/project/*` | admin / operator | P1 |
| **SCR-PROJ-403** | admin-only 라우트 fallback | direct URL | non-admin | P1 |
| **SCR-ISSUE-LIST** | 이슈 리스트 (테이블) | `/project/issues` | admin / operator | P2/P3 |
| **SCR-ISSUE-KANBAN** | 이슈 칸반 | `/project/issues` (toggle) | 동상 | P2/P3 |
| **SCR-ISSUE-FORM** | 이슈 작성/수정 모달 | LIST/KANBAN → `[+]` / 카드 클릭 | 동상 | P2/P3 |
| **SCR-ISSUE-DETAIL** | 이슈 상세 드로어 | 카드 클릭(보기) | 동상 | P2/P3 |
| **SCR-NOTE-LIST** | 노트 목록 | `/project/notes` | admin / operator | P4 |
| **SCR-NOTE-FORM** | 노트 작성/수정 모달 | LIST → `[+]` / 카드 → `편집` | 동상 | P4 |
| **SCR-NOTE-DETAIL** | 노트 상세 | LIST 카드 클릭 | 동상 | P4 |

### 1.2 SCR-PROJ-NAV — 프로젝트 GNB / 탭 (P1)

**admin 시점**
```
┌───────────────────────────────────────────────────────────────────────┐
│ ← A-idol CMS                              [Gray Kim ▾]   [로그아웃]   │
├──────────┬────────────────────────────────────────────────────────────┤
│ 대시보드 │ 프로젝트                                                   │
│ 아이돌   │                                                            │
│ 팬덤     │ ┌──────┬──────┬──────┐  ┌─────┬───────┬────┬──────┐      │
│ 채팅     │ │개요  │이슈  │노트  │  │문서 │산출물 │WBS │작업  │← admin│
│ ...      │ │      │ NEW  │ NEW  │  │     │       │    │태스크│ only  │
│ ▶프로젝트│ └──────┴──────┴──────┘  └─────┴───────┴────┴──────┘      │
│          │                                                            │
│          │ <선택 탭의 컨텐츠>                                         │
└──────────┴────────────────────────────────────────────────────────────┘
```

**operator 시점**
```
┌──────────┬────────────────────────────────────────────────────────────┐
│ ▶프로젝트│ 프로젝트                                                   │
│          │                                                            │
│          │ ┌──────┬──────┬──────┐                                    │
│          │ │개요  │이슈  │노트  │   ← admin 전용 4개 탭은 미표시      │
│          │ └──────┴──────┴──────┘                                    │
└──────────┴────────────────────────────────────────────────────────────┘
```

> 시각적 구분: admin 영역 4개 탭은 좌측 묶음과 시각적 separator(공백 + 얇은 vertical line) + 작은 🔒 admin 아이콘 / 회색 배경.

### 1.3 SCR-PROJ-403 — admin-only 라우트 fallback (P1)
```
┌────────────────────────────────────────────────┐
│  🔒                                             │
│  이 페이지는 admin 권한이 필요합니다.          │
│                                                │
│  프로젝트 운영자가 관리하는 영역입니다.        │
│  필요하면 관리자에게 권한 요청을 부탁드립니다. │
│                                                │
│  [프로젝트 개요로 돌아가기]                    │
└────────────────────────────────────────────────┘
```
- 직접 URL 접근 시 표시 (`/project/docs/*`, `/project/deliverables`, `/project/wbs`, `/project/tasks`).
- `RequireRole`이 reject할 때 redirect 대신 본 fallback을 렌더하여 사용자에게 명확한 컨텍스트 제공.

### 1.4 SCR-ISSUE-LIST — 이슈 리스트 (P2/P3)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 이슈                                          [리스트 / 칸반]  [+ 새 이슈]│
├─────────────────────────────────────────────────────────────────────────┤
│ 검색 [_______]  유형 [▾]  상태 [▾]  우선순위 [▾]                        │
├─────────────────────────────────────────────────────────────────────────┤
│  Key  │ 제목         │ 유형 │ 상태│ 우선│ 담당   │ 작성자  │ 시작 │ 마감 │
│ ───── ┼────────────── ┼───── ┼──── ┼──── ┼─────── ┼──────── ┼───── ┼──── │
│ IIS-1 │ 메뉴 재구성  │ TASK │ TODO│ HIGH│ Gray   │ Yuna ★  │ 5/8  │ 5/9 │
│ IIS-2 │ 노트 모듈    │ FEAT │ IN.. │ MED │ Mina   │ Gray ★  │ 5/10 │ 5/14│
│  …                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```
- 신규 컬럼: **작성자** (`reporterName`) + **시작** (`startAt`)
- 작성자 컬럼은 토글로 켜고 끌 수 있음(공간 제약 시) — 기본 ON
- 컬럼 표시 설정은 localStorage 저장

### 1.5 SCR-ISSUE-KANBAN — 칸반 (P2)

```
┌─ BACKLOG ─────┐ ┌─ TODO ────────┐ ┌─ IN PROGRESS ─┐ ┌─ REVIEW ──┐ ┌─ DONE ─┐
│┌─────────────┐│ │┌─────────────┐│ │┌─────────────┐│ │           │ │        │
││IIS-1        ││ ││IIS-3        ││ ││IIS-7        ││ │           │ │        │
││메뉴 재구성  ││ ││ ...         ││ ││ ...         ││ │           │ │        │
││🟥 HIGH      ││ ││🟧 MED       ││ ││🟦 LOW       ││ │           │ │        │
││📅 5/8→5/9   ││ ││📅 5/10→5/14 ││ ││             ││ │           │ │        │
││👤 Gray      ││ ││👤 Mina      ││ ││             ││ │           │ │        │
││✍ Yuna       ││ ││✍ Gray       ││ ││             ││ │           │ │        │
│└─────────────┘│ │└─────────────┘│ │└─────────────┘│ │           │ │        │
└───────────────┘ └───────────────┘ └───────────────┘ └───────────┘ └────────┘

범례: 👤 담당자  ✍ 작성자  📅 시작→마감  🟥/🟧/🟦 우선순위
```

### 1.6 SCR-ISSUE-FORM — 이슈 작성/수정 모달 (P2 + P3)

```
┌──────────────────────────────────────────────────────────────┐
│ 이슈 편집  IIS-1                                       [×]   │
├──────────────────────────────────────────────────────────────┤
│ 제목 *  [메뉴 재구성 ____________________________________]   │
│                                                              │
│ 유형 [TASK ▾]   상태 [TODO ▾]   우선순위 [HIGH ▾]            │
│                                                              │
│ 담당자  [Gray Kim ▾]      라벨  [a, b, c ____________]      │
│                                                              │
│ 시작일  [2026-05-08]      마감일  [2026-05-09]               │
│                                                              │
│ ── 설명 ──────────────────────────────────────────────────   │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ [B] [I] [U] [S]  [H1][H2]  [• ≣]  [📷][📎]  [<>][링크]  ││ ← 툴바
│ │──────────────────────────────────────────────────────────││
│ │ 내용을 작성합니다...                                     ││
│ │                                                          ││
│ │ [업로드된 이미지 inline 표시]                            ││
│ │ 📎 attachment-1.pdf (250KB)  [×]                         ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ 작성자: Yuna Park · 작성일: 2026-05-07 14:21  (read-only)   │
├──────────────────────────────────────────────────────────────┤
│                              [취소]  [저장]                  │
└──────────────────────────────────────────────────────────────┘
```

**툴바 기능 (P3)**
- B/I/U/S — 굵게/기울임/밑줄/취소선
- H1/H2 — 제목
- • ≣ — 목록 / 순번
- 📷 — 이미지 삽입(업로드 또는 URL)
- 📎 — 파일 첨부 (모달 상단 본문 외부 첨부 영역에 표시)
- `< >` — 코드 블록
- 링크 — URL 입력 모달

**파일 업로드 흐름**
1. 📎 또는 📷 클릭 → 파일 선택 다이얼로그
2. 클라이언트에서 MIME / 크기 사전 검증
3. `POST /api/v1/admin/attachments` (multipart, body: file, owner_type=ISSUE, owner_id=optional — 신규 이슈는 임시 client-side draft id)
4. 응답 `{ id, url, mime_type, size_bytes }`
5. 이미지면 에디터에 `<img src=url>` 삽입, 파일이면 첨부 리스트에 표시
6. 이슈 저장 시 body에 `attachment_ids: ['uuid1', ...]` 포함 → 서버가 ownerId 묶음 처리

### 1.7 SCR-ISSUE-DETAIL — 이슈 상세 드로어 (P2)

```
┌──────────────────────────────┐
│ IIS-1 메뉴 재구성        [×] │
├──────────────────────────────┤
│ 유형  TASK    우선순위 HIGH  │
│ 상태  TODO                   │
│ 담당자 Gray Kim              │
│ 작성자 Yuna Park             │
│ 시작 2026-05-08              │
│ 마감 2026-05-09              │
│ 라벨 [a] [b] [c]             │
│ ────────────────────────     │
│ 설명                          │
│ <리치 HTML 렌더링 — sanitize│
│  된 콘텐츠 그대로>           │
│ [📎 file.pdf]                │
│ ────────────────────────     │
│ 작성 2026-05-07 14:21        │
│ 수정 2026-05-07 14:35        │
│                              │
│         [편집] [삭제]        │
└──────────────────────────────┘
```

### 1.8 SCR-NOTE-LIST — 노트 목록 (P4)

```
┌──────────────────────────────────────────────────────────────┐
│ 노트                                              [+ 새 노트]│
├──────────────────────────────────────────────────────────────┤
│ 검색 [_______]   카테고리 [전체 ▾]  [📌 핀만 보기]            │
├──────────────────────────────────────────────────────────────┤
│ 📌 ┌──────────────────────────────────────────────────────┐ │
│    │ [DECISION] DTO snake_case 마이그레이션 합의         │ │
│    │ 작성: Gray · 수정 5분 전                             │ │
│    │ ADR-023에 정리. 아래 ...                             │ │
│    └──────────────────────────────────────────────────────┘ │
│    ┌──────────────────────────────────────────────────────┐ │
│    │ [MEETING] 2026-05-06 운영 미팅 회의록                │ │
│    │ 작성: Yuna · 어제                                    │ │
│    │ 참석자: ...                                          │ │
│    └──────────────────────────────────────────────────────┘ │
│    ┌──────────────────────────────────────────────────────┐ │
│    │ [LINK] 외부 레퍼런스 링크 모음                       │ │
│    │ 작성: Mina · 3일 전                                   │ │
│    └──────────────────────────────────────────────────────┘ │
│ ...                                                           │
└──────────────────────────────────────────────────────────────┘
```

### 1.9 SCR-NOTE-FORM — 노트 작성/수정 모달 (P4)

```
┌──────────────────────────────────────────────────────┐
│ 노트 작성                                       [×]  │
├──────────────────────────────────────────────────────┤
│ 제목 *  [_____________________________________]     │
│                                                      │
│ 카테고리 [NOTE ▾]      [📌 상단 고정]               │
│                                                      │
│ ── 본문 (리치에디터, P3와 동일 컴포넌트) ──        │
│ ┌──────────────────────────────────────────────────┐│
│ │ [툴바 — issue form과 동일]                       ││
│ │──────────────────────────────────────────────────││
│ │ 내용 ...                                         ││
│ └──────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────┤
│                              [취소]  [저장]          │
└──────────────────────────────────────────────────────┘
```

### 1.10 인터랙션 → API 매핑 종합

| Phase | 액션 | 요청 | 권한 |
|---|---|---|---|
| P1 | 탭 진입 (admin-only) | front-end RequireRole | admin only |
| P2 | 이슈 생성 | `POST /api/v1/admin/issues` body `{ ..., start_at?, due_date? }` | admin/operator |
| P2 | 이슈 수정 | `PATCH /api/v1/admin/issues/:id` | 동상 |
| P3 | 첨부 업로드 | `POST /api/v1/admin/attachments` multipart | admin/operator |
| P3 | 첨부 다운로드 | `GET /api/v1/admin/attachments/:id` | admin/operator |
| P4 | 노트 목록 | `GET /api/v1/admin/project-notes?category=&pinned=` | admin/operator |
| P4 | 노트 생성/수정/삭제 | `POST/PATCH/DELETE /api/v1/admin/project-notes/:id` | 작성자 또는 admin |

### 1.11 i18n 키 초안 (전체 phase)

```
project.tabs.overview                = "개요"
project.tabs.issues                  = "이슈"
project.tabs.notes                   = "노트"
project.tabs.docs                    = "문서"
project.tabs.deliverables            = "산출물"
project.tabs.wbs                     = "WBS"
project.tabs.tasks                   = "작업태스크"
project.guard.admin_only.title       = "이 페이지는 admin 권한이 필요합니다."
project.guard.admin_only.body        = "프로젝트 운영자가 관리하는 영역입니다."
project.guard.admin_only.cta         = "프로젝트 개요로 돌아가기"

issue.field.start_at                 = "시작일"
issue.field.reporter                 = "작성자"
issue.errors.invalid_date_range      = "시작일이 마감일보다 늦을 수 없습니다."

attachment.errors.too_large          = "파일 크기는 {limit}MB 이하여야 합니다."
attachment.errors.mime_not_allowed   = "지원하지 않는 파일 형식입니다."

note.title                           = "제목"
note.category.note                   = "메모"
note.category.meeting                = "회의록"
note.category.decision               = "결정사항"
note.category.link                   = "외부 링크"
note.category.other                  = "기타"
note.pinned                          = "상단 고정"
note.errors.not_found                = "노트를 찾을 수 없습니다."
note.errors.forbidden                = "이 노트를 수정할 권한이 없습니다."
```

---

## 2. 시스템 개발 현황 분석 요약

| 영역 | 상태 | 비고 |
|---|---|---|
| Issue 모듈 (3-tier) | ✅ 완비 | controller / usecase / repository 존재 |
| Issue.startAt | ❌ 없음 | 신규 컬럼 + 마이그레이션 필요 |
| 작성자 표시 | 🟡 상세에만 | 리스트/칸반/수정 보강 필요 |
| 리치에디터 | ❌ 없음 | tiptap 신규 도입 (Phase 3) |
| 파일 업로드 backend | ❌ 없음 | `media` 모듈 신규 (Phase 3) |
| 노트/게시판 | ❌ 없음 | `project-notes` 모듈 신규 (Phase 4) |
| RequireRole 가드 | ✅ 적용 패턴 확립 | router.tsx에 적용 |
| 트레이스빌리티 | 🟡 FR-101까지 | FR-103, FR-104 신규 등록 필요 |

---

## 3. 구현 단계별 계획 (Phase 1~4)

### 3.1 Phase 1 — 메뉴 재구성 + admin-only 가드 (2~3h)

**P1-1 메뉴 재배열** ([packages/cms/src/features/project/project-layout.tsx](../../packages/cms/src/features/project/project-layout.tsx))
- nav 배열 순서 변경: `overview → issues → notes(P4 후) → docs → deliverables → wbs → tasks`
- admin 영역 4개에 `adminOnly: true` 플래그
- 시각적 separator (구분선 + 작은 회색 라벨 "admin 영역")

**P1-2 라우터 가드 강화** ([packages/cms/src/app/router.tsx](../../packages/cms/src/app/router.tsx))
- `/project/docs` `/project/docs/:slug` `/project/docs/:slug/edit` `/project/deliverables` `/project/wbs` `/project/tasks` 6개 라우트의 RequireRole을 `allow=['admin']`으로 변경
- 기존 `/project/docs/:slug/edit`만 admin이었던 것 → 4개 영역 전체 admin only

**P1-3 admin-only fallback 페이지** (신규)
- 컴포넌트: `packages/cms/src/features/project/admin-only-fallback.tsx`
- `RequireRole`이 reject할 때 redirect 대신 본 컴포넌트 렌더 (옵션 추가)
- 또는 `RequireRole`에 `fallback` prop 추가하여 children 대신 렌더

**P1-4 i18n** — 위 §1.11 의 `project.tabs.*` / `project.guard.admin_only.*` 4언어 등록 (`ko/en/vi/zh-CN`).

**P1-5 typecheck/lint/test** + smoke (CMS 빌드 통과 + dev 서버에서 admin/operator 로그인하여 메뉴 노출 확인).

### 3.2 Phase 2 — 이슈 작성자 표시 + 시작일 필드 (4~5h)

**P2-1 Prisma 마이그레이션**
- `packages/backend/prisma/schema.prisma` Issue 모델에 `startAt DateTime? @map("start_at")` 추가
- 마이그레이션 이름: `add_issue_start_at`
- 명령: `pnpm --filter @a-idol/backend prisma:migrate -- --name add-issue-start-at`

**P2-2 Domain / DTO**
- `Issue` 도메인 / 매퍼에 `startAt` 추가
- `CreateIssueBody` / `UpdateIssueBody` (snake_case `start_at`) — `@IsDateString() @IsOptional()`
- 검증: `startAt > dueDate` 시 `DomainError(ISSUE_INVALID_DATE_RANGE)` (use case 내부)
- 신규 ErrorCode: `ISSUE_INVALID_DATE_RANGE` → 422 매핑

**P2-3 Repository / use case**
- `prisma-issue.repository.ts` create/update에 startAt 반영
- 필요 시 listByBoard에 startAt 노출

**P2-4 CMS UI**
- 리스트 컬럼: `작성자(reporterName)` + `시작(startAt)` 추가, localStorage column visibility
- 칸반 카드: `✍ reporterName` + `📅 startAt → dueDate` 표기
- `IssueFormDialog`에 `시작일` 입력 추가 + `작성자 / 작성일` read-only 표시
- 상세 드로어: 시작일 추가

**P2-5 테스트**
- usecase spec: invalid date range 케이스
- 트레이스빌리티: `FR-103` 행 추가 (req-definition.md)

### 3.3 Phase 3 — 리치에디터 + 파일/이미지 업로드 (12~16h)

**P3-1 Prisma 마이그레이션**
- 신규 모델 `Attachment`:
  ```
  model Attachment {
    id           String         @id @default(uuid()) @db.Uuid
    ownerType    AttachmentOwnerType
    ownerId      String?        @map("owner_id") @db.Uuid  // nullable for draft
    filename     String         @db.VarChar(255)
    mimeType     String         @map("mime_type") @db.VarChar(120)
    sizeBytes   Int            @map("size_bytes")
    storageKey   String         @map("storage_key") @db.VarChar(500)
    uploadedById String         @map("uploaded_by_id") @db.Uuid
    createdAt    DateTime       @default(now()) @map("created_at")

    @@index([ownerType, ownerId])
    @@map("attachments")
  }
  enum AttachmentOwnerType { ISSUE NOTE DOC DRAFT }
  ```
- 마이그레이션 이름: `add_attachments`

**P3-2 Backend `media` 모듈 신규** (`packages/backend/src/modules/media/`)
- 4-layer 구조: domain / application / infrastructure / presentation
- Storage 인터페이스 (`StoragePort`)
  - `LocalDiskStorage` 구현 (`packages/backend/uploads/`)
  - `S3Storage` 인터페이스 슬롯만 (구현 deferred)
- Use cases: `UploadAttachmentUseCase`, `LinkAttachmentToOwnerUseCase` (이슈/노트 저장 시 호출), `DeleteAttachmentUseCase`
- Controller: `POST /api/v1/admin/attachments` (multer multipart) / `GET /:id` (download/stream) / `DELETE /:id`
- 검증:
  - MIME 화이트리스트 (jpg/png/gif/webp/pdf/zip/csv/xlsx/docx/txt/md)
  - 크기 ≤ 20MB (env `ATTACHMENT_MAX_BYTES`)
  - SVG 금지
- 신규 ErrorCodes: `ATTACHMENT_TOO_LARGE` (413), `ATTACHMENT_MIME_NOT_ALLOWED` (415), `ATTACHMENT_NOT_FOUND` (404)

**P3-3 Sanitize 레이어**
- 의존성: `sanitize-html`
- 위치: `packages/backend/src/shared/security/sanitize-html.ts`
- 화이트리스트:
  - 태그: `p, br, strong, em, u, s, h1, h2, h3, ul, ol, li, blockquote, code, pre, a, img`
  - 속성: `a[href|target|rel]`, `img[src|alt|width|height]`
  - URL 스킴: `http`, `https` (`data:` 금지 — 첨부 URL만)
- Issue/Note use case 진입 시 description/body sanitize

**P3-4 Issue description 처리 변경**
- `description` 컬럼 그대로(`Text`) — sanitized HTML 저장
- 기존 plaintext 데이터는 자동 wrap (`<p>{escape(text)}</p>`) — lazy migration
- Create/Update DTO: `description` (HTML) + `attachment_ids: string[]` (선택)

**P3-5 CMS — tiptap 도입**
- 의존성: `@tiptap/react` `@tiptap/starter-kit` `@tiptap/extension-image` `@tiptap/extension-link`
- 컴포넌트: `packages/cms/src/shared/rich-editor/rich-editor.tsx` — props `value: string` `onChange(html)` `onUploadFile(file): Promise<{url, id}>`
- 툴바: 위 §1.6 명세
- IssueFormDialog: textarea → `<RichEditor>` 교체
- 첨부 영역(이미지 외 파일): 모달 하단에 별도 리스트 (`AttachmentList` 컴포넌트)
- lazy load (`React.lazy`) — 다른 페이지 번들 영향 최소화

**P3-6 테스트**
- Backend: media module use case spec, sanitize-html 화이트리스트 spec
- 트레이스빌리티: FR-103-D 보강

### 3.4 Phase 4 — 프로젝트 노트/게시판 (8~10h)

**P4-1 Prisma 마이그레이션**
- 신규 모델 `ProjectNote`:
  ```
  model ProjectNote {
    id           String       @id @default(uuid()) @db.Uuid
    title        String       @db.VarChar(120)
    body         String       @db.Text  // sanitized HTML
    category     ProjectNoteCategory @default(NOTE)
    pinned       Boolean      @default(false)
    authorAdminId String      @map("author_admin_id") @db.Uuid
    author       AdminUser    @relation(fields: [authorAdminId], references: [id], onDelete: Restrict)
    createdAt    DateTime     @default(now()) @map("created_at")
    updatedAt    DateTime     @updatedAt @map("updated_at")

    @@index([category])
    @@index([pinned, updatedAt(sort: Desc)])
    @@map("project_notes")
  }
  enum ProjectNoteCategory { NOTE MEETING DECISION LINK OTHER }
  ```
- 마이그레이션 이름: `add_project_notes`

**P4-2 Backend `project-notes` 모듈 신규**
- 4-layer 구조
- Use cases: `ListProjectNotesUseCase` (filter+pinned+search), `GetProjectNoteUseCase`, `CreateProjectNoteUseCase`, `UpdateProjectNoteUseCase`, `DeleteProjectNoteUseCase`, `TogglePinUseCase`
- Controller endpoints (모두 `/api/v1/admin/project-notes`):
  | Method | Path | 권한 |
  |---|---|---|
  | GET | `/` | admin/operator |
  | GET | `/:id` | admin/operator |
  | POST | `/` | admin/operator |
  | PATCH | `/:id` | author 또는 admin |
  | PATCH | `/:id/pin` | admin/operator |
  | DELETE | `/:id` | author 또는 admin |
- 권한 검증 — `author or admin` 체크는 use case 내부 (`actor.role === 'admin' || actor.id === note.authorAdminId`)
- 신규 ErrorCodes: `NOTE_NOT_FOUND` (404), `NOTE_FORBIDDEN` (403)
- body sanitize는 P3 sanitize 미들웨어 재사용

**P4-3 CMS — 노트 페이지**
- 신규 라우트: `/project/notes` (RequireRole admin/operator)
- 페이지 컴포넌트: `packages/cms/src/features/project/notes-page.tsx`
- 모달: `note-form-dialog.tsx` — RichEditor 재사용
- 카드 그리드 + 핀 그룹 + 카테고리 칩 + 검색

**P4-4 트레이스빌리티**
- `FR-104` 신규 행 추가 (req-definition.md)
- ADR 신규 불요 (Phase 3의 첨부 인프라 그대로 재사용)

---

## 4. 신규/수정 파일 목록 (예상)

### Phase 1 (적은 변경)
| 종류 | 파일 |
|---|---|
| 수정 | `packages/cms/src/features/project/project-layout.tsx` (메뉴 순서/플래그) |
| 수정 | `packages/cms/src/app/router.tsx` (RequireRole 강화) |
| 수정 | `packages/cms/src/shared/auth/require-role.tsx` (fallback prop 추가) |
| 신규 | `packages/cms/src/features/project/admin-only-fallback.tsx` |
| 수정 | i18n `ko/en/vi/zh-CN` 4 파일 |

### Phase 2 (DB 변경 + UI)
| 종류 | 파일 |
|---|---|
| 수정 | `packages/backend/prisma/schema.prisma` (Issue.startAt) |
| 신규 | `packages/backend/prisma/migrations/20260507_add_issue_start_at/migration.sql` |
| 수정 | `packages/shared/src/domain/errors.ts` (`ISSUE_INVALID_DATE_RANGE`) + `app-exception.filter.ts` (422 매핑) |
| 수정 | `packages/backend/src/modules/issue-tracker/...` (도메인/DTO/usecase/repository) |
| 수정 | `packages/cms/src/features/project/issues-page.tsx` (컬럼/카드/모달) |
| 수정 | `docs/design/a-idol-req-definition.md` (FR-103) |

### Phase 3 (인프라 신규)
| 종류 | 파일 |
|---|---|
| 수정 | `packages/backend/prisma/schema.prisma` (Attachment + enum) |
| 신규 | `packages/backend/prisma/migrations/20260507_add_attachments/migration.sql` |
| 신규 | `packages/backend/src/modules/media/**` (4-layer, ~10 파일) |
| 신규 | `packages/backend/src/shared/security/sanitize-html.ts` |
| 수정 | `packages/backend/package.json` (`sanitize-html`, `multer`, `@types/...`) |
| 수정 | `packages/cms/package.json` (tiptap 의존성) |
| 신규 | `packages/cms/src/shared/rich-editor/rich-editor.tsx` + 관련 컴포넌트 |
| 신규 | `packages/cms/src/shared/attachments/attachment-list.tsx` |
| 수정 | `packages/cms/src/features/project/issues-page.tsx` (RichEditor + AttachmentList 적용) |
| 수정 | `packages/shared/src/domain/errors.ts` (Attachment 3종) + filter 매핑 |

### Phase 4 (모듈 + 페이지)
| 종류 | 파일 |
|---|---|
| 수정 | `packages/backend/prisma/schema.prisma` (ProjectNote + enum) |
| 신규 | `packages/backend/prisma/migrations/20260507_add_project_notes/migration.sql` |
| 신규 | `packages/backend/src/modules/project-notes/**` (4-layer) |
| 신규 | `packages/cms/src/features/project/notes-page.tsx` + `note-form-dialog.tsx` |
| 수정 | `packages/cms/src/app/router.tsx` (`/project/notes` 라우트 등록) |
| 수정 | `packages/cms/src/features/project/project-layout.tsx` (탭 추가) |
| 수정 | `packages/shared/src/domain/errors.ts` (`NOTE_NOT_FOUND`, `NOTE_FORBIDDEN`) |
| 수정 | `docs/design/a-idol-req-definition.md` (FR-104) |

---

## 5. 사이드 임팩트 분석

| 항목 | 영향 | 완화 |
|---|---|---|
| Prisma 마이그레이션 3회 (P2/P3/P4) | staging DB에 순차 적용 | 단계별 머지로 위험 분산 |
| 기존 이슈 description plaintext | 그대로 존재, 편집 진입 시 lazy wrap | 일괄 변환 안 함 |
| CMS 번들 사이즈 | tiptap 약 +150KB gzip | 이슈/노트 페이지 lazy load → 다른 페이지 영향 0 |
| operator 권한 수정 | admin-only 4개 라우트 — 정책 강화 | 운영팀에 변경 사전 공지 필요 (메뉴 사라짐) |
| 보안 표면 | 파일 업로드 / HTML 입력 | sanitize-html 화이트리스트 + MIME/크기 검증 + SVG 금지 |
| 권한 상승 위험 | 노트 수정/삭제 author check | usecase 내부 actor 검증 |
| 디스크 사용량 | 첨부파일 누적 | env로 한도 관리, 향후 S3 마이그레이션 / lifecycle |
| 모바일 앱 | 영향 없음 (mobile은 admin API 미사용) | — |

---

## 6. 리스크

| # | 리스크 | 대응 |
|---|---|---|
| R1 | 로컬 디스크는 컨테이너 휘발성 — staging 재배포 시 첨부 유실 | staging까지만 허용. prod 적용 전 S3 어댑터 강제 |
| R2 | sanitize-html 화이트리스트 미흡 시 stored XSS 위험 | 표준 라이브러리 사용 + e2e 테스트(악성 payload 케이스) + content-type guard |
| R3 | tiptap 번들 사이즈 | lazy load + 코드 스플리팅 + bundle-analyzer 측정 |
| R4 | Prisma 마이그레이션 3회 → staging 다운타임 | 각 마이그레이션은 backward-compat 추가형. 별도 rollback 플랜은 단순 (revert + 재배포) |
| R5 | 기존 이슈 description 호환 | lazy wrap (text-to-html) 유틸 + 시각 회귀 검증 |
| R6 | RequireRole fallback과 NotFound 라우트 우선순위 충돌 | RequireRole이 child route로 들어가도록 라우터 재구성, fallback prop 명시 |
| R7 | 노트 권한 (author or admin) 검증 누락 시 권한 상승 | usecase 단위 테스트 + e2e |
| R8 | tiptap Image extension URL 검증 누락 | 클라이언트에서 첨부 endpoint 응답 URL만 허용. 외부 URL 붙여넣기 차단(또는 화이트리스트) |

---

## 7. 승인 체크리스트 (사용자 확인 사항)

### 7.1 진행 방식
- [ ] **(A) 4 phases 일괄 진행** vs **(B) Phase 1 먼저 머지 후 P2~P4 재평가** — 권장 (B)
- [ ] 각 phase별로 PLN/TCR/RPT를 별도 작성할지, 본 PLN을 phase별 섹션으로 유지할지

### 7.2 Phase 1 — 메뉴/가드
- [ ] 탭 순서: `[개요] [이슈] [노트] | [문서] [산출물] [WBS] [작업태스크]` 동의
- [ ] admin-only 4개 라우트의 fallback은 **fallback 페이지** (redirect 아님)
- [ ] 노트 탭은 Phase 4 머지 시점에 노출 (Phase 1에선 placeholder/비표시 중 택1) — **placeholder 보다 비표시 권장**

### 7.3 Phase 2 — 작성자/시작일
- [ ] `Issue.startAt` Prisma 필드 신규 추가
- [ ] 검증 규칙 `startAt <= dueDate` (둘 다 있을 때만)
- [ ] 작성자 컬럼은 리스트/칸반 모두 기본 노출 + localStorage column visibility

### 7.4 Phase 3 — 리치에디터/업로드
- [ ] 에디터 라이브러리: **tiptap**
- [ ] 저장 포맷: **sanitized HTML**
- [ ] Storage: 로컬 디스크 우선 (S3 인터페이스 슬롯만)
- [ ] 파일 크기: 20MB / 파일 (env override)
- [ ] 허용 MIME: jpg/png/gif/webp/pdf/zip/csv/xlsx/docx/txt/md — **SVG 금지**
- [ ] sanitize 라이브러리: `sanitize-html`
- [ ] **prod 적용 전 S3 어댑터 강제** 정책 동의

### 7.5 Phase 4 — 노트/게시판
- [ ] 노트 권한: admin/operator 양쪽 (viewer 제외)
- [ ] 카테고리: `NOTE / MEETING / DECISION / LINK / OTHER`
- [ ] 수정/삭제 권한: 작성자 본인 또는 admin
- [ ] 핀 토글: admin/operator 모두 가능 (저자 제한 없음)

### 7.6 트레이스빌리티
- [ ] FR-103 (Issue 강화) + FR-104 (Notes) 신규 ID 부여 — req-definition.md 갱신 포함

---

## 8. 다음 단계

승인 또는 조정 의견을 다음 중 선택하여 알려주십시오:

1. **(A) 일괄 진행 승인** — Phase 1부터 순차 구현 시작
2. **(B) Phase 1만 진행 승인** — Phase 1만 본 PLN 범위로 즉시 구현, P2~P4는 후속 PLN
3. **조정 후 진행** — 위 §7 항목 중 일부 수정 의견 + 진행 방식 선택

승인 의견 주시면 해당 phase의 Step 1부터 구현 시작하겠습니다.
