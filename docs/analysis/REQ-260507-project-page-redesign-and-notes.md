# REQ-260507 — CMS 프로젝트 페이지 재구성 + 이슈 보강 + 노트/게시판 신설

- 작성일: 2026-05-07
- 작성자: Gray Kim
- 상태: 분석 완료 (PLN 승인 대기)
- 대상 환경: staging — `https://a-idol-stg.amoeba.site/project`
- 관련 FR: **FR-101** (RBAC) 정책 강화 · **신규 FR-103** (Issue 강화) · **신규 FR-104** (프로젝트 노트/게시판)
- 관련 ADR: ADR-010 (User vs AdminUser), ADR-023 (snake_case Request DTO), ADR-017 (correlation id)
- 관련 정책: POL-010 (Admin Access)

---

## 1. 배경 (Why)

A-idol CMS의 `/project` 페이지는 6개 하위 라우트(개요 · 문서 · 산출물 · WBS · 작업태스크 · 이슈)로 구성되어 있다. 운영 우선순위가 변하면서:
- **이슈 추적이 일상 운영의 1차 진입점**이 되어야 하는데 메뉴 끝에 위치
- **문서/산출물/WBS/작업태스크는 사실상 admin(PM·아키텍트)만 사용**하지만 모든 운영자에게 노출되어 노이즈 발생
- 이슈 description이 plaintext만 가능하여 코드/이미지 첨부가 잦은 운영 컨텍스트에 부적절
- 이슈와 분리된 "프로젝트 메모/회의록/공유 노트" 보관 공간 부재 (현재는 이슈에 억지로 적거나 외부 도구 사용)

이번 라운드에서 위 5개 사항을 동시에 정리한다.

## 2. AS-IS 현황 분석

### 2.1 라우트/메뉴 구조 ([packages/cms/src/features/project/project-layout.tsx](../../packages/cms/src/features/project/project-layout.tsx))
현재 메뉴 순서(좌→우):
```
[개요] [문서(ADR/설계)] [산출물] [WBS] [작업태스크] [이슈]
```
가드:
- `/project` 진입 — admin/operator
- `/project/docs/:slug/edit` — admin only
- 그 외 자식 라우트 — admin/operator/viewer 모두 가능 (RequireRole 별도 미적용)

### 2.2 Issue 데이터 모델 ([packages/backend/prisma/schema.prisma](../../packages/backend/prisma/schema.prisma) L872–898)
| 필드 | 타입 | 비고 |
|---|---|---|
| `key` | String unique | `IIS-N` sequence |
| `title` | String | |
| `description` | String? `@db.Text` | **plaintext only** |
| `type` / `status` / `priority` | enum | |
| `dueDate` | DateTime? | 마감일만 존재 |
| **`startAt`** | — | **❌ 미존재** |
| `reporterAdminId` | String | 작성자 (FK) |
| `assigneeAdminId` | String? | 담당자 (FK, nullable) |
| `labels` | string[] | |
| `orderInColumn` | Int | kanban 정렬 |

### 2.3 Issue UI ([packages/cms/src/features/project/issues-page.tsx](../../packages/cms/src/features/project/issues-page.tsx))
- 리스트(테이블): key/title/type/status/priority/**assigneeName**/dueDate — **reporterName 미표시**
- 칸반(카드): title/key/priority/**assigneeName**/dueDate — **reporterName 미표시**
- 상세 드로어: reporterName 표시됨
- 편집 모달(`IssueFormDialog`): textarea 6줄, type/status/priority/dueDate/labels — **작성자 정보 표시 없음, 시작일 없음, description plaintext**

### 2.4 인프라 부재
| 영역 | AS-IS |
|---|---|
| Rich text editor (tiptap/lexical/quill) | ❌ 미도입 |
| 파일 업로드 백엔드 (S3/local) | ❌ 미구현 — `media`/`storage`/`upload` 모듈 없음 |
| 이미지 업로드 (이슈/문서) | ❌ 미구현 |
| 노트/게시판/포스트 모듈 | ❌ 미구현 |

### 2.5 권한 노출 매트릭스 (현재)
| 메뉴 | admin | operator | viewer |
|---|---|---|---|
| 개요 | ✅ | ✅ | ❌ (라우트 진입 거부) |
| 문서 | ✅ R/W | ✅ R / ❌ W | ❌ |
| 산출물 | ✅ | ✅ | ❌ |
| WBS | ✅ | ✅ | ❌ |
| 작업태스크 | ✅ | ✅ | ❌ |
| 이슈 | ✅ R/W/D | ✅ R/W | ❌ |

> viewer가 `/project` 진입 자체를 못 하는 상태. 본 변경 후에도 동일 가정 (별도 변경 불요).

## 3. TO-BE 요구사항

### FR-103-A — 메뉴 재구성 + admin-only 영역 분리 (요구사항 1)
**TO-BE 메뉴 순서** (좌→우):
```
[개요] [이슈] ⎯⎯⎯⎯ admin 전용 ⎯⎯⎯⎯ [문서] [산출물] [WBS] [작업태스크]
```
- **이슈를 두 번째**(개요 다음)로 이동
- 문서 / 산출물 / WBS / 작업태스크 4개 라우트 모두 **admin 역할만** 진입 가능
- operator는 메뉴에서 4개 항목이 **숨김**(아예 표시 안 됨), 직접 URL 접근 시 RequireRole이 거부 → 적절한 fallback 페이지(403 또는 `/project`로 리다이렉트)
- viewer 권한이 추후 `/project` 접근을 받게 되면 동일 규칙 적용

### FR-103-B — 이슈 카드/수정에 작성자 표시 (요구사항 2)
| 위치 | AS-IS | TO-BE |
|---|---|---|
| 리스트 | assignee만 | **assignee + reporter** (또는 컬럼 토글) |
| 칸반 카드 | assignee만 | **assignee + reporter** (작은 라벨/아바타) |
| 편집 모달 | 미표시 | **작성자(reporter) 표시 (read-only)** + 작성일 |

> 작성자는 생성 시 자동 채워지므로 편집 불가. 표시만 추가.

### FR-103-C — 이슈 시작일 신규 필드 (요구사항 3)
- **신규 컬럼**: `Issue.startAt` `DateTime?`
- DB 마이그레이션 필요 (Prisma)
- API: Create/Update body에 `start_at` (snake_case) 필드 추가, Response는 `startAt` (camelCase)
- UI: 편집 모달의 `dueDate` 옆에 `startAt` 추가, 카드/리스트에서도 표시(공간 허용 시)
- 검증: `startAt <= dueDate` (둘 다 있을 때) — 위반 시 `ISSUE_INVALID_DATE_RANGE` (신규 ErrorCode)

### FR-103-D — 이슈 description 리치에디터 + 파일 업로드 + 이미지 삽입 (요구사항 4)

**리치에디터**
- 라이브러리: **tiptap (StarterKit + Image + Link + CodeBlock)** — React/CMS 호환, MIT, 의존성 가벼움
- 출력 포맷: HTML 또는 ProseMirror JSON. **HTML 채택 권장** (저장/검색 단순, sanitize 후 안전)
- description 컬럼 타입은 `Text`(현재) 그대로, content는 sanitized HTML
- Sanitize: 서버 측 [DOMPurify](https://github.com/cure53/DOMPurify) (jsdom 기반) 또는 [sanitize-html](https://github.com/apostrophecms/sanitize-html) — 화이트리스트 태그/속성 정의

**파일 업로드 / 이미지 삽입**
- 신규 모듈: **`media`** (또는 `attachments`)
- 백엔드: 로컬 디스크 어댑터 우선(`packages/backend/uploads/` 이미 gitignore), S3 어댑터는 인터페이스만 노출하고 후속
- 신규 Prisma 모델 `Attachment`:
  ```
  id (uuid)
  ownerType  enum  (ISSUE | NOTE | DOC)
  ownerId    string
  filename   string
  mimeType   string
  sizeBytes  int
  storageKey string  // local: filesystem path, s3: bucket key
  uploadedById  string  // adminUserId
  createdAt  timestamptz
  ```
- 신규 엔드포인트: `POST /api/v1/admin/attachments` (multipart) → 응답 `{ id, url }`. issue/note에 attachment id를 묶어 저장.
- 이미지 inline 삽입: tiptap `Image` extension이 src에 업로드된 URL을 사용 → DOMPurify allowlist에 `img[src]` 포함
- 보안:
  - MIME / 확장자 화이트리스트 (jpg/png/gif/webp/svg+sanitize/pdf/zip/csv/xlsx 등)
  - 파일 크기 제한 (default 20MB, env로 조정)
  - 업로드 권한: admin/operator (이슈는 양쪽 W 가능)

### FR-104 — 프로젝트 노트/게시판 신규 기능 (요구사항 5)
**컨셉**: 이슈 트래커와 분리된, 자유 양식의 **자료 노트** 보관소. 회의록 / 의사결정 요약 / 외부 링크 정리 / 단순 게시 등 용도.

**모델**
```
ProjectNote
  id (uuid)
  title       string  (1–120)
  body        Text    (sanitized HTML — 동일 리치에디터 사용)
  category    enum?   (NOTE | MEETING | DECISION | LINK | OTHER) — 기본 NOTE
  pinned      boolean
  authorAdminId  string  (FK AdminUser, restrict)
  createdAt   timestamptz
  updatedAt   timestamptz
  attachments — Attachment.ownerType=NOTE 으로 연결
```

**엔드포인트** (모두 `/api/v1/admin/...`)
| Method | Path | 권한 |
|---|---|---|
| GET    | `/admin/project-notes` | admin / operator |
| GET    | `/admin/project-notes/:id` | admin / operator |
| POST   | `/admin/project-notes` | admin / operator |
| PATCH  | `/admin/project-notes/:id` | 작성자 본인 또는 admin |
| DELETE | `/admin/project-notes/:id` | 작성자 본인 또는 admin |

**메뉴 위치**: `[개요] [이슈] [노트] ⎯⎯ admin ⎯⎯ [문서] [산출물] [WBS] [작업태스크]`
> "노트"는 admin/operator 양쪽 노출. viewer는 본 PR 범위 외.

## 4. 갭 분석

| 영역 | AS-IS | TO-BE | 갭 |
|---|---|---|---|
| 메뉴 순서 / 가드 | 6 메뉴, 이슈 끝, operator도 4개 admin 영역 노출 | 이슈 2번째, 4개는 admin only | `project-layout.tsx`/`router.tsx` 수정 |
| 이슈 reporter 표시 | 상세에만 | 리스트/칸반/수정에도 | `issues-page.tsx` 컴포넌트 보강 |
| Issue.startAt | 없음 | DateTime? | **Prisma 마이그레이션** + DTO + UI |
| Description plaintext | textarea | 리치에디터(HTML, sanitized) | tiptap 도입 + sanitize 미들웨어 |
| 파일/이미지 업로드 | 없음 | 신규 `media` 모듈 + `Attachment` 모델 | **신규 마이그레이션 + 모듈** |
| 노트/게시판 | 없음 | 신규 `project-notes` 모듈 + UI | **신규 마이그레이션 + 모듈 + 페이지** |
| ErrorCodes | 없음 | `ISSUE_INVALID_DATE_RANGE` · `ATTACHMENT_TOO_LARGE` · `ATTACHMENT_MIME_NOT_ALLOWED` · `NOTE_NOT_FOUND` · `NOTE_FORBIDDEN` | shared/errors.ts 등록 |
| 트레이스빌리티 | 미정의 | FR-103/FR-104 | req-definition.md 행 추가 |

## 5. 사용자 플로우

### 5.1 admin 로그인 후 메뉴
```
GNB: 대시보드 / 아이돌 / … / 프로젝트
프로젝트 진입 → 탭: [개요] [이슈] [노트] | (admin) [문서] [산출물] [WBS] [작업태스크]
```

### 5.2 operator 로그인 후 메뉴
```
프로젝트 진입 → 탭: [개요] [이슈] [노트]
(문서/산출물/WBS/작업태스크 4개 탭 자체가 보이지 않음)
직접 URL 입력 시 → 403 안내 또는 /project로 리다이렉트
```

### 5.3 이슈 생성 with 이미지/파일
```
[+ 새 이슈] → 모달
  제목: ...
  시작일: 2026-05-08
  마감일: 2026-05-15
  설명 (리치에디터):
     - 텍스트 작성
     - 툴바에서 [📎 파일] 클릭 → 다이얼로그 → 업로드 진행률 → URL 자동 삽입
     - 툴바에서 [🖼 이미지] 클릭 → 동일 흐름, inline 표시
  [작성자: Gray Kim · 2026-05-07] (read-only 표시)
[저장] → POST /admin/issues body { ..., start_at, due_date, description_html, attachment_ids: [...] }
```

### 5.4 노트 생성
```
[/project/notes] → [+ 새 노트] → 모달
  제목 / 카테고리(드롭다운) / 본문(리치에디터, 동일) / 첨부
[저장] → POST /admin/project-notes
목록: 핀(상단) + 카테고리 칩 + 작성자 + 최근수정일
```

## 6. 결정 포인트 (사용자 확정 필요)

| # | 결정 포인트 | 권장 | 사용자 확정 필요 |
|---|---|---|---|
| 1 | 리치에디터 라이브러리 | **tiptap** (확장성·React 호환) | ✅ |
| 2 | description 저장 포맷 | **sanitized HTML** (검색·렌더링 단순) | ✅ |
| 3 | 파일 저장소 어댑터 | **로컬 디스크 우선**(`packages/backend/uploads/`), S3 인터페이스 슬롯만 | ✅ |
| 4 | 첨부 파일 크기 한도 | **20MB / 파일** (env override) | ✅ |
| 5 | 허용 MIME | jpg/png/gif/webp / pdf / zip / csv / xlsx / docx / txt / md | ✅ |
| 6 | SVG 업로드 | **금지** (XSS 위험) | ✅ |
| 7 | 노트 — viewer 노출 | 본 PR **제외** (admin/operator만) | ✅ |
| 8 | 노트 카테고리 enum | NOTE / MEETING / DECISION / LINK / OTHER | ✅ |
| 9 | Issue.startAt 검증 | `startAt <= dueDate` 필수, 단독 startAt은 허용 | ✅ |
| 10 | 단계 분리 | **PLN에서 4 phases로 split** 권장 (아래 §8) | ✅ |
| 11 | 4개 admin-only 메뉴 직접 URL 접근 시 | **403 페이지 표시 후 /project로 리다이렉트 버튼** | ✅ |
| 12 | 기존 이슈의 description plaintext → HTML 마이그레이션 | **lazy 변환** (텍스트 그대로 보여주되, 편집 시 `<p>{text}</p>`로 wrapping). 일괄 변환은 안 함 | ✅ |

## 7. 기술 제약사항

- **Prisma 마이그레이션 2회**: (a) `Issue.startAt` 추가, (b) `Attachment` + `ProjectNote` 모델 신규. 한 마이그레이션으로 묶을지 단계별로 분리할지는 PLN에서 결정.
- **tiptap = ProseMirror 기반** — peer deps(`prosemirror-*`) 다수 추가. CMS 번들 사이즈 ~150KB gzip 증가 예상. 코드 스플리팅으로 이슈/노트 페이지에서만 로드.
- **sanitize-html / DOMPurify**는 서버측 jsdom 의존 — Node-only. backend에서 인입 단계(use case 내부)에서 sanitize 수행. 클라이언트에서도 미리 sanitize하면 이중 안전.
- **파일 저장 디스크 vs S3**: 로컬 디스크는 staging/prod 배포 시 컨테이너 휘발성 → MVP에서 로컬은 staging까지만. prod 적용 전 S3 어댑터 필수 (별도 작업).
- **multipart upload**: NestJS는 기본 Express + `multer` 또는 Fastify + `@fastify/multipart`. 현재 backend 셋업 확인 필요(PLN에서).
- **CMS 번들**: tiptap을 lazy load(`React.lazy`)하여 이슈/노트 페이지 진입 시에만 로드. 다른 페이지 영향 최소화.

## 8. 단계 분리 권장 (PLN에서 4 phases로)

요구사항 5개를 한 PR/한 작업 단위로 묶으면 변경면이 너무 커진다. PLN에서 다음과 같이 쪼갠다 (각 phase 별 PR/머지 가능):

| Phase | 범위 | 예상 소요 |
|---|---|---|
| **Phase 1** | (1) 메뉴 재구성 + admin-only 가드 | 2~3h |
| **Phase 2** | (2) 작성자 표시 + (3) startAt 필드 (Prisma + DTO + UI) | 4~5h |
| **Phase 3** | (4) 리치에디터 + 파일/이미지 업로드 (media 모듈 + tiptap + sanitize) | 12~16h |
| **Phase 4** | (5) 프로젝트 노트/게시판 (모델 + 모듈 + UI, Phase 3의 첨부 인프라 재사용) | 8~10h |

**권장 머지 순서**: 1 → 2 → 3 → 4. 각 phase는 PLN/TCR/RPT 별도 작성 가능 (또는 한 PLN에 phase별 섹션 분리).

> 본 REQ는 5개 요구사항 전체 범위. PLN은 Phase 1만 우선 작성하거나 4 phases 종합으로 작성 가능 — **사용자 결정 필요(§6 #10)**.

## 9. 영향 범위 (사이드 임팩트 요약)

| 항목 | 영향 |
|---|---|
| Prisma 마이그레이션 | **2개 신규** (startAt / Attachment+ProjectNote) |
| 모듈 신규 | **media** (필수), **project-notes** (Phase 4) |
| CMS 번들 | tiptap +~150KB gzip, 이슈/노트 페이지 lazy load |
| 권한 정책 | admin-only 4개 라우트 신규 (FR-101 운영 정책 강화) |
| 운영 시드 | 신규 모델은 빈 상태로 배포, 별도 시드 불요 |
| 보안 표면 확대 | 파일 업로드 → MIME/크기/sanitize 정책 필수, 신규 ErrorCodes 3종 |
| 기존 이슈 | description 그대로 호환 (편집 시 자동 wrap) |

## 10. 산출물 (예상)

PLN에서 phase별로 상세화. 본 REQ는 분석에 한정.
