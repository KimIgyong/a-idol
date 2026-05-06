# TCR-260507 — CMS 프로젝트 페이지 재구성 + 이슈 보강 + 노트/게시판

- 작성일: 2026-05-07
- 작성자: Gray Kim
- 선행: [REQ-260507](../analysis/REQ-260507-project-page-redesign-and-notes.md) · [PLN-260507](../plan/PLN-260507-project-page-redesign-and-notes.md)

---

## 1. 단위 테스트 (Unit)

### 1.1 Issue 강화 — `issue.usecases.spec.ts`

| TC | 시나리오 | 기대 |
|---|---|---|
| TC-ISS-001 | create requires title | BadRequestException |
| TC-ISS-002 | create persists and lists | OK |
| TC-ISS-003 | get by key resolves; missing → 404 | OK / NotFoundException |
| TC-ISS-004 | update + move + delete happy path | OK |
| TC-ISS-005 | move rejects negative index | BadRequestException |
| **TC-ISS-006** | **create rejects startAt > dueDate (FR-103-C)** | `ISSUE_INVALID_DATE_RANGE` |
| **TC-ISS-007** | **create accepts startAt <= dueDate** | OK |
| **TC-ISS-008** | **update merges with existing dates for range check** | `ISSUE_INVALID_DATE_RANGE` |
| **TC-ISS-009** | **create sanitizes script tags from description (FR-103-D)** | `<p>hi</p>` 유지 / `<script>`·`onerror` 제거 |

→ 9 / 9 pass

### 1.2 Media — `attachment.usecases.spec.ts`

| TC | 시나리오 | 기대 |
|---|---|---|
| TC-ATT-001 | happy path image (image/png 1KB) | 저장 + repo.create 호출 |
| TC-ATT-002 | 30MB 업로드 거부 | `ATTACHMENT_TOO_LARGE` (storage.save 미호출) |
| TC-ATT-003 | SVG 거부 | `ATTACHMENT_MIME_NOT_ALLOWED` |
| TC-ATT-004 | SVG MIME 화이트리스트에 미존재 | `ALLOWED_MIME_TYPES.includes('image/svg+xml')` === false |

→ 4 / 4 pass

### 1.3 Project Notes — `project-note.usecases.spec.ts`

| TC | 시나리오 | 기대 |
|---|---|---|
| TC-NOT-001 | create sanitizes body | `<script>` 제거 |
| TC-NOT-002 | get not-found | `NOTE_NOT_FOUND` |
| TC-NOT-003 | update by author allowed | OK |
| TC-NOT-004 | update by non-author operator → forbidden | `NOTE_FORBIDDEN` |
| TC-NOT-005 | update by admin (non-author) allowed | OK |
| TC-NOT-006 | delete by non-author operator → forbidden | `NOTE_FORBIDDEN` |
| TC-NOT-007 | update sanitizes body if provided | `<iframe>` 제거 |

→ 7 / 7 pass

**합계**: 신규 13 + 기존 7 = 20 tests pass.

---

## 2. 통합 시나리오 (Integration / cURL)

> 사전 환경: `make dev` + admin 로그인 (`admin@a-idol.dev`).

### 2.1 Phase 1 — 메뉴 / RBAC

**ITC-P1-001 — admin 로그인 후 메뉴 표시**
- 기대: 좌측 GNB → "프로젝트" → 탭 7개 노출 (개요 / 이슈 / 노트 / 문서 / 산출물 / WBS / 작업태스크) + admin 영역 separator

**ITC-P1-002 — operator 로그인 후 메뉴 제한**
- 기대: 탭 3개만 노출 (개요 / 이슈 / 노트). 직접 URL `/project/wbs` 입력 시 RequireRole fallback 페이지(접근 권한 없음 안내)

### 2.2 Phase 2 — startAt / reporter

**ITC-P2-001 — POST /admin/issues with start_at**
```bash
TOKEN=...
curl -X POST http://localhost:3000/api/v1/admin/issues \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Test","start_at":"2026-05-08","due_date":"2026-05-10"}'
# 기대: 201 + Response 의 startAt: "2026-05-08"
```

**ITC-P2-002 — start_at > due_date 거부**
```bash
curl -X POST .../admin/issues \
  -d '{"title":"Bad","start_at":"2026-05-15","due_date":"2026-05-10"}'
# 기대: 422 { "code":"ISSUE_INVALID_DATE_RANGE" }
```

### 2.3 Phase 3 — 첨부 / sanitize

**ITC-P3-001 — 이미지 업로드 (multipart)**
```bash
curl -X POST .../admin/attachments \
  -H "Authorization: Bearer $TOKEN" \
  -F file=@local.png -F owner_type=DRAFT
# 기대: 201 { id, url: "/api/v1/admin/attachments/..." }
```

**ITC-P3-002 — 30MB 파일 거부**
```bash
# 기대: 413 { "code":"ATTACHMENT_TOO_LARGE", "details": { "maxBytes": 20971520 } }
```

**ITC-P3-003 — SVG 거부**
```bash
curl -X POST .../admin/attachments -F file=@a.svg -F owner_type=DRAFT
# 기대: 415 { "code":"ATTACHMENT_MIME_NOT_ALLOWED" }
```

**ITC-P3-004 — script 포함 description sanitize**
```bash
curl -X POST .../admin/issues \
  -d '{"title":"X","description":"<p>ok</p><script>alert(1)</script>"}'
# 기대: 201 + Response 의 description 에서 <script> 제거
```

### 2.4 Phase 4 — 노트

**ITC-P4-001 — 노트 생성**
```bash
curl -X POST .../admin/project-notes \
  -d '{"title":"회의록","body":"<p>참석자: ...</p>","category":"MEETING","pinned":true}'
# 기대: 201 + ProjectNoteDto
```

**ITC-P4-002 — 비-작성자 operator 가 수정 시도 → 403**
```bash
# 다른 operator 토큰으로 PATCH
# 기대: 403 { "code":"NOTE_FORBIDDEN" }
```

**ITC-P4-003 — admin 이 비-작성자 노트 수정 → 200**
```bash
# admin 토큰으로 PATCH
# 기대: 200 + 갱신된 ProjectNoteDto
```

**ITC-P4-004 — 노트 목록 (pinned 우선)**
```bash
curl .../admin/project-notes
# 기대: pinned: true 가 상단, 그 다음 updatedAt desc
```

### 2.5 e2e 시나리오 (CMS)

| # | 시나리오 | 기대 |
|---|---|---|
| E2E-1 | admin 로그인 → /project/issues → 이슈 생성 (시작일 5/8, 마감일 5/10, 본문에 이미지 업로드) | 카드에 ✍ + 📅 5/8→5/10 표시, 상세에 이미지 인라인 렌더 |
| E2E-2 | operator 로그인 → /project 메뉴 4개 admin-only 미노출 확인 | OK |
| E2E-3 | operator 로그인 → /project/notes 노트 생성 → admin 이 수정 → operator 가 다시 보면 변경 반영 | OK |
| E2E-4 | operator 가 다른 operator 의 노트 수정 시도 → 403 토스트 | OK |
| E2E-5 | 핀 토글 클릭 → 즉시 상단 그룹으로 이동 | OK |

---

## 3. 엣지 케이스

| # | 케이스 | 처리 | 검증 |
|---|---|---|---|
| E-1 | description 에 `data:` URL 이미지 | sanitize-html 의 `allowedSchemes`/`allowedSchemesByTag` 화이트리스트 (http/https 만) → 차단 | TC-ISS-009 확장 가능 |
| E-2 | description 에 `<a href="javascript:...">` | sanitize-html 이 차단 | unit |
| E-3 | 0byte 파일 | multer + 백엔드 validator (sizeBytes ≥ 0, MIME 검증). 의도적 차단 X (작은 텍스트는 허용) | manual |
| E-4 | 동일 첨부 ID 중복 link | `linkToOwner` updateMany — idempotent | manual |
| E-5 | issue update 시 startAt 만 변경 → 기존 dueDate 와 비교 | use case 가 existing 값 merge 후 검증 | TC-ISS-008 |
| E-6 | 노트 카테고리 enum 외 값 | DTO `@IsIn(CATEGORY_VALUES)` → 400 | manual |
| E-7 | tiptap empty document `<p></p>` | sanitize-html 통과, 저장 시 빈 문자열 또는 `<p></p>` 유지 | manual |
| E-8 | path traversal 시도 (`storageKey="../etc/passwd"`) | LocalDiskStorage `resolveSafe` 가 ROOT 외부 path 차단 | unit (후속 추가 가능) |

---

## 4. 회귀 검증

| 영역 | 결과 |
|---|---|
| 전체 typecheck (4 packages) | ✅ pass |
| 전체 lint (cms 기존 경고 2건은 무관) | ✅ pass |
| issue-tracker / media / project-notes spec | ✅ 20/20 pass |
| 기존 admin-ops + identity 회귀 | 별도 영향 없음 (코드 분리). identity logout spec 1건은 main 동일 사전 회귀 (본 PR 무관) |

---

## 5. 미커버 영역

- e2e (Playwright) 테스트 — 후속
- Storage path traversal unit test (`resolveSafe`) — 1줄 가드는 있음, 명시 테스트는 후속
- Multer 파일 한도와 backend `DEFAULT_MAX_BYTES` 의 이중 가드 통합 테스트 — manual 검증
- prod 배포 전 S3 어댑터 강제 정책 — 별도 작업
- 첨부 access control(서명 URL) — staging 단계 단순 publish, prod 전 보강 필요
