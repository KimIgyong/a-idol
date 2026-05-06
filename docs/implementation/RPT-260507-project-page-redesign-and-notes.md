# RPT-260507 — CMS 프로젝트 페이지 재구성 + 이슈 보강 + 노트/게시판 (구현 완료 보고서)

- 작성일: 2026-05-07
- 작성자: Gray Kim
- 상태: ✅ Phase 1~4 백엔드 + CMS 구현 완료 / 미배포
- 선행: [REQ-260507](../analysis/REQ-260507-project-page-redesign-and-notes.md) · [PLN-260507](../plan/PLN-260507-project-page-redesign-and-notes.md) · [TCR-260507](../test/TCR-260507-project-page-redesign-and-notes.md)
- 트레이스빌리티: **FR-103 + FR-104 + FR-INFRA-MEDIA** (req-definition.md 갱신)

---

## 1. 구현 요약

### Phase 1 — 메뉴 재구성 + admin-only 가드
- 메뉴 순서: `[개요] [이슈] [노트] | (admin only) [문서] [산출물] [WBS] [작업태스크]`
- `RequireRole` 가 reject 할 때 fallback 페이지 렌더 (redirect 아님)
- 메뉴는 권한별로 필터링 — operator/viewer 는 admin 4개 탭이 아예 표시되지 않음
- 시각적 separator (🔒 admin 영역 라벨)

### Phase 2 — Issue 작성자 표시 + 시작일
- Prisma 마이그레이션 `20260507000000_add_issue_start_at` — `Issue.startAt DATE`
- DTO/도메인/repository 전체 경로에 `startAt` 추가
- `startAt > dueDate` 시 `ISSUE_INVALID_DATE_RANGE` (422)
- CMS 리스트 컬럼 + 칸반 카드 (✍ reporter, 📅 startAt → dueDate) + 편집 모달 (시작일 input, 작성자 read-only)
- i18n 키 4언어 추가 (`issue.field.startAt`)

### Phase 3 — 리치에디터 + 파일/이미지 업로드
- Prisma 마이그레이션 `20260507010000_add_attachments_and_notes` — `Attachment` 모델 + `AttachmentOwnerType` enum
- 신규 `media` 모듈 (4-layer):
  - `LocalDiskStorage` (`packages/backend/uploads/attachments/`), S3 어댑터 슬롯만
  - `POST/GET/DELETE /api/v1/admin/attachments` (multipart)
  - MIME 화이트리스트 + 20MB 한도 + path traversal 가드
- `sanitize-html` 기반 `sanitizeRichHtml` 유틸 (서버측, NIST/DOMPurify 패턴)
- Issue create/update 에서 description sanitize + `attachment_ids` link
- CMS `RichEditor` 컴포넌트 (tiptap StarterKit + Image + Link)
- Issue 편집 모달 textarea → RichEditor 교체 (이미지 inline + 첨부 리스트)

### Phase 4 — 프로젝트 노트/게시판
- Prisma 마이그레이션은 P3 와 함께 `add_attachments_and_notes` — `ProjectNote` 모델 + `ProjectNoteCategory` enum
- 신규 `project-notes` 모듈 (4-layer):
  - List (pinned desc, updatedAt desc) + Get + Create + Update + Delete + TogglePin
  - 권한: 수정/삭제는 작성자 또는 admin (`NOTE_FORBIDDEN`)
  - body sanitize 동일 적용
  - 첨부 인프라 (P3) 재사용
- CMS `/project/notes` 페이지 + `NoteFormDialog` (RichEditor 재사용) + 카테고리 5종 / 핀 / 검색
- i18n note namespace 4언어 추가

---

## 2. 변경 파일 목록

### 신규 (백엔드 — 16)
- `packages/backend/prisma/migrations/20260507000000_add_issue_start_at/migration.sql`
- `packages/backend/prisma/migrations/20260507010000_add_attachments_and_notes/migration.sql`
- `packages/backend/src/shared/security/sanitize-html.ts`
- `packages/backend/src/modules/media/domain/attachment.ts`
- `packages/backend/src/modules/media/application/interfaces.ts`
- `packages/backend/src/modules/media/application/attachment.usecases.ts` + `.spec.ts`
- `packages/backend/src/modules/media/infrastructure/local-disk-storage.ts`
- `packages/backend/src/modules/media/infrastructure/prisma-attachment.repository.ts`
- `packages/backend/src/modules/media/presentation/admin-attachments.controller.ts`
- `packages/backend/src/modules/media/media.module.ts`
- `packages/backend/src/modules/project-notes/domain/project-note.ts`
- `packages/backend/src/modules/project-notes/application/interfaces.ts`
- `packages/backend/src/modules/project-notes/application/project-note.usecases.ts` + `.spec.ts`
- `packages/backend/src/modules/project-notes/infrastructure/prisma-project-note.repository.ts`
- `packages/backend/src/modules/project-notes/presentation/dto/project-note.dto.ts`
- `packages/backend/src/modules/project-notes/presentation/admin-project-notes.controller.ts`
- `packages/backend/src/modules/project-notes/project-notes.module.ts`

### 신규 (CMS — 6)
- `packages/cms/src/shared/rich-editor/rich-editor.tsx`
- `packages/cms/src/features/project/notes-page.tsx`
- `packages/cms/src/i18n/{ko,en,vi,zh-CN}/note.json` (4)

### 신규 (문서 — 4)
- `docs/analysis/REQ-260507-project-page-redesign-and-notes.md`
- `docs/plan/PLN-260507-project-page-redesign-and-notes.md`
- `docs/test/TCR-260507-project-page-redesign-and-notes.md`
- `docs/log/2026-05-07/00_01_project-page-redesign-and-notes.md`

### 수정 (백엔드)
- `packages/backend/prisma/schema.prisma` — Issue.startAt + Attachment + ProjectNote + 2 enums
- `packages/backend/src/app.module.ts` — MediaModule + ProjectNotesModule 등록
- `packages/backend/src/shared/errors/app-exception.filter.ts` — 6 신규 ErrorCode HTTP 매핑
- `packages/backend/src/modules/issue-tracker/**` — domain/dto/usecase/repository/controller 에 startAt + attachment_ids + sanitize
- `packages/backend/src/modules/issue-tracker/issue-tracker.module.ts` — MediaModule import
- `packages/backend/package.json` — sanitize-html, @types/sanitize-html, @types/multer

### 수정 (Shared)
- `packages/shared/src/contracts/index.ts` — IssueDto.startAt + CreateIssueDto/UpdateIssueDto.start_at
- `packages/shared/src/domain/errors.ts` — 6 신규 ErrorCode (ISSUE_INVALID_DATE_RANGE / ATTACHMENT_NOT_FOUND/TOO_LARGE/MIME_NOT_ALLOWED / NOTE_NOT_FOUND/FORBIDDEN)

### 수정 (CMS)
- `packages/cms/src/app/router.tsx` — admin-only 라우트 가드 강화 + /project/notes 등록
- `packages/cms/src/features/project/project-layout.tsx` — 메뉴 재배열 + adminOnly 필터
- `packages/cms/src/features/project/issues-page.tsx` — reporter/startAt 컬럼·카드·모달 + RichEditor
- `packages/cms/src/lib/api.ts` — apiUpload (multipart 전용) 신규
- `packages/cms/src/lib/admin-api.ts` — uploadAttachment / project-notes CRUD
- `packages/cms/src/i18n/i18n.ts` — note namespace 등록
- `packages/cms/src/i18n/{ko,en,vi,zh-CN}/issue.json` — issue.field.startAt 4언어
- `packages/cms/package.json` — @tiptap/react, starter-kit, image, link

### 수정 (문서)
- `docs/design/a-idol-req-definition.md` — FR-103, FR-104, FR-INFRA-MEDIA 트레이스빌리티 행

---

## 3. 검증 결과

| 검증 | 결과 |
|---|---|
| `make typecheck` (4 packages) | ✅ pass |
| `make lint` | ✅ 0 errors (cms 기존 경고 2건 무관) |
| issue-tracker / media / project-notes 단위 테스트 | ✅ 20 / 20 pass (신규 13 + 기존 7) |
| Prisma 마이그레이션 2건 | ✅ staging local 적용 (`23 migrations`) |

---

## 4. 결정 사항 (PLN §7 승인 반영)

| 결정 | 선택 |
|---|---|
| 진행 방식 | (A) 일괄 4 phases 순차 |
| 에디터 라이브러리 | tiptap (StarterKit + Image + Link) |
| description 저장 포맷 | sanitized HTML (sanitize-html, 화이트리스트) |
| 파일 저장소 | LocalDiskStorage (`uploads/attachments/`) — prod 전 S3 강제 |
| 파일 한도 | 20MB / 파일 (env `ATTACHMENT_MAX_BYTES` override) |
| 허용 MIME | jpg/png/gif/webp / pdf / zip / csv / xlsx / docx / txt / md (SVG 금지) |
| 노트 권한 | admin/operator (viewer 제외) |
| 노트 수정/삭제 | 작성자 또는 admin |
| 핀 토글 | admin/operator 모두 가능 |
| 카테고리 | NOTE / MEETING / DECISION / LINK / OTHER |
| 시작일 검증 | `startAt <= dueDate` (둘 다 있을 때) |
| Phase 1 admin-only fallback | redirect 아님, 페이지 렌더 (RequireRole 기존 패턴) |

---

## 5. 알려진 한계 / 후속 작업

1. **로컬 디스크 휘발성**: staging 컨테이너 재배포 시 첨부파일 유실 — staging 단계까지만 허용, prod 전 S3 어댑터 강제. `media` 모듈 `STORAGE_PORT` 인터페이스가 슬롯 역할.
2. **첨부 access control**: 현재는 `/api/v1/admin/attachments/:id` 인증만 — 권한별 권리(예: 다른 노트 첨부 다운로드) 검증은 후속.
3. **DRAFT cleanup**: `owner_type=DRAFT` 로 업로드되었으나 entity 저장에 실패한 첨부는 영구 잔존 (orphan). cron job 으로 1일 이상 DRAFT 정리 필요 — 후속.
4. **e2e 테스트**: 백엔드 unit 만 추가. CMS Playwright e2e 미구현.
5. **rich text 렌더링 회귀**: 기존 plaintext description 은 자동 wrap 없이 `RichHtmlView` 가 raw 출력 → `\n` 이 줄바꿈 안 됨. 첫 편집 시 사용자가 명시적으로 줄 단위 wrap 필요. 일괄 마이그레이션은 후속.
6. **operator 권한 변경 사전 공지**: 4개 탭(문서/산출물/WBS/작업태스크)이 사라지므로 운영팀에 변경 안내 필요.

---

## 6. 배포 체크리스트 (staging)

- [ ] `pnpm install` (sanitize-html, multer types, tiptap 추가)
- [ ] Prisma 마이그레이션 자동 적용 (deploy 명령에 `prisma migrate deploy` 포함되어 있는지 확인)
- [ ] `.env` 에 `ATTACHMENT_LOCAL_ROOT` 명시 (옵션, 기본 `uploads/attachments`)
- [ ] 컨테이너 볼륨에 `/uploads` 디렉토리 마운트 (휘발성 인지)
- [ ] CMS 빌드 확인 (`packages/cms` lazy chunk 추가 — tiptap)
- [ ] 운영팀에 메뉴 변경 안내 (admin-only 4 탭)

---

## 7. 커밋 메시지 초안

```
feat(project): redesign CMS project page + issue richen + project notes

Phase 1 — Menu reorder + admin-only guards
- [/project/{docs,deliverables,wbs,tasks}] now admin-only
- Issue tab moved to second position
- ProjectLayout filters tabs by role with visual separator

Phase 2 — Issue.startAt + reporter display (FR-103-A/B/C)
- Prisma migration: add Issue.startAt
- DTO start_at (snake_case) + IssueDto.startAt
- usecase validates startAt <= dueDate (ISSUE_INVALID_DATE_RANGE)
- CMS list/kanban/modal show reporter + startAt

Phase 3 — Rich editor + file/image upload (FR-103-D, FR-INFRA-MEDIA)
- New media module (4-layer): LocalDiskStorage + Attachment model
- POST /api/v1/admin/attachments multipart, MIME whitelist, 20MB
- sanitize-html on Issue.description (server-side)
- CMS RichEditor (tiptap) replaces textarea, image/file toolbar

Phase 4 — Project notes/board (FR-104)
- New project-notes module: 5 categories + pinned + author RBAC
- CMS /project/notes page (lazy load)
- 4-language i18n note namespace

req-definition.md FR-103 / FR-104 / FR-INFRA-MEDIA traceability added.
```
