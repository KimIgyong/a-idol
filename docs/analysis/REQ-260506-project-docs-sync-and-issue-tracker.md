# REQ-260506 — 프로젝트 문서 동기화 & 이슈 트래커

| 항목 | 값 |
|---|---|
| ID | REQ-260506 |
| 작성일 | 2026-05-06 |
| 작성자 | Gray Kim |
| 대상 surface | CMS `/project` (Web, admin/operator) |
| 관련 모듈 | `project-docs` (기존), `issue-tracker` (신규) |
| 우선순위 | P1 |
| 의존성 | `admin-ops` (인증·RBAC), Prisma 스키마, `deploy/staging/*` |

---

## 1. 배경 (AS-IS)

1. CMS `/project` 메뉴는 이미 5개 서브 페이지(개요·문서·산출물·WBS·태스크)를 보유. 데이터 소스는 `project_documents` 테이블이며, 본문은 로컬 `docs/` 마크다운을 `prisma/seed.ts` 가 upsert.
2. 스테이징 (`https://a-idol-stg.amoeba.site/project`) 은 **최초 1회 seed 이후 갱신 채널 없음**.
   - `deploy/staging/deploy.sh` 는 `prisma migrate deploy` 만 수행 → 본문 변경된 ADR / 설계 문서가 스테이징에 반영되지 않음.
   - 운영자가 CMS 안에서 "다시 가져오기" 할 방법이 없음.
3. 프로젝트 산출물은 보이지만 **이슈(작업·버그·리스크) 등록·추적 화면 부재**. 현재는 `docs/implementation/a-idol-wbs.md` 의 정적 표를 파싱해서 보여줄 뿐, 신규 이슈를 CMS 에서 등록·상태 전이할 수 없음.

## 2. 목표 (Goals)

| ID | 목표 | 측정 가능 결과 |
|---|---|---|
| G1 | 로컬 `docs/**.md` 변경분을 스테이징 `project_documents` 에 1-step 으로 반영 | `pnpm sync-docs` 한 번 실행 → 스테이징 `/project/docs` 즉시 갱신 |
| G2 | 운영자가 CMS UI 에서 직접 재동기화 가능 | `/project/docs` 상단 "리포지토리 다시 가져오기" 버튼 클릭 → 변경 카운트 표시 |
| G3 | CMS `/project/issues` 신규 메뉴: List + Kanban 두 view 토글 | 두 화면 모두 동일 데이터 동일 필터, 상태 변경 동기 반영 |
| G4 | 이슈 데이터 영속화 + 4-layer Clean Architecture 준수 | 신규 `issues` 테이블 + 신규 `issue-tracker` 모듈 |
| G5 | i18n 4언어 (`ko`/`en`/`vi`/`zh-CN`) 준수, 하드코딩 0 | `i18n/<locale>/issue.json` 4개 모두 동일 키셋 |

## 3. 비목표 (Non-goals)

- N1. 외부 이슈 시스템(Redmine/Jira/GitHub Issues) 연동 → MVP 제외 (REQ-260506 후속 ADR 로 분리)
- N2. 첨부파일 업로드 → MVP 제외 (Phase 2)
- N3. 댓글 / 활동 로그 / 알림 → MVP 제외 (Phase 2)
- N4. 산출물 마크다운 본문을 CMS 에서 편집 후 **로컬 git 으로 역동기화** → 범위 외. 본 작업은 단방향(local→DB)만.
- N5. 모바일 앱 노출 → 제외. CMS only.

## 4. 사용자 / 시나리오

| 페르소나 | 권한 | 핵심 시나리오 |
|---|---|---|
| `admin` Gray | full | 로컬에서 ADR 추가/편집 → `pnpm sync-docs:staging` → 스테이징 검토 → 이슈 등록 → Kanban 에서 in-progress 로 전이 |
| `operator` PM | read+write 이슈 | CMS 진입 → `/project/issues` Kanban → 본인 담당 카드 클릭 → 상태 done 처리 |
| `viewer` 외부 검토자 | read only | 이슈 목록 필터 (priority=P0) 로 위험 이슈만 조회 |

## 5. 기능 요구사항 (FR)

### 5.1 FR-DOCS-SYNC (요구 1: 문서 동기화)

| FR ID | 설명 | AC (Acceptance Criteria) |
|---|---|---|
| **FR-DOCS-SYNC-001** | 신규 CLI: `pnpm --filter @a-idol/backend sync-docs` 가 `prisma/seed.ts` 의 `projectDocSeeds` 로직만 추출하여 실행. seed 의 다른 (idol/fan-club/…) 부분은 건너뜀 | `pnpm sync-docs` 실행 시 `project_documents` 만 upsert. 실행 결과 stdout 에 `created N / updated M / unchanged K` 출력 |
| **FR-DOCS-SYNC-002** | 본문이 동일하면 `updatedAt` / `version` 변경하지 않음 (idempotent) | 같은 commit 에서 두 번 실행 시 두 번째 결과 `created 0 / updated 0` |
| **FR-DOCS-SYNC-003** | 본문이 변경된 경우 `version` +1, `updatedAt = now`, `updatedBy = sync admin` | 1줄 수정 후 재실행 시 해당 doc `version` 증가 |
| **FR-DOCS-SYNC-004** | `deploy/staging/deploy.sh` 에 `--with-docs-sync` 옵션 추가, 기본값 ON | 옵션 없이 실행 시 sync 자동 수행. `--no-docs-sync` 로 끌 수 있음 |
| **FR-DOCS-SYNC-005** | 신규 admin endpoint `POST /api/v1/admin/project-docs/sync-from-repo` (admin only) — 컨테이너 내부 파일시스템을 스캔해 동일 로직 실행. 응답 `{ created, updated, unchanged, durationMs }` | 401 (unauth) / 403 (operator) / 200 (admin). 응답 본문 정상 |
| **FR-DOCS-SYNC-006** | CMS `/project/docs` 상단에 "리포지토리에서 다시 가져오기" 버튼 (admin only). 클릭 → confirm → `POST /sync-from-repo` → toast 결과 카운트 표시 | operator 로그인 시 버튼 비표시. admin 클릭 → 5초 내 응답 + 토스트 + 목록 자동 새로고침 |
| **FR-DOCS-SYNC-007** | sync 도중 sourcePath 가 더 이상 존재하지 않는 doc 은 `status='ARCHIVED'` 로 자동 전환 (삭제 X) | 로컬에서 ADR 파일 삭제 후 sync → 해당 row archived, 목록 기본 필터(approved) 에서 사라짐 |

### 5.2 FR-ISSUE (요구 2: 이슈 트래커)

| FR ID | 설명 | AC |
|---|---|---|
| **FR-ISSUE-001** | DB 모델 `Issue`: `id, key(IIS-001..), title, description(md), type(TASK/BUG/STORY/RISK), status(BACKLOG/TODO/IN_PROGRESS/REVIEW/DONE/CANCELED), priority(P0/P1/P2/P3), assigneeAdminId?, reporterAdminId, dueDate?, labels[], orderInColumn, createdAt, updatedAt` | Prisma migration 생성, snake_case 매핑. `IIS-` 접두 키 자동 생성(시퀀스) |
| **FR-ISSUE-002** | API `GET /api/v1/admin/issues` — 필터: `status[]`, `type[]`, `priority[]`, `assigneeId`, `q`(title contains), `view=list|kanban`. Response: list (분류 X) 또는 kanban shape (`{ status: Issue[] }`) | 200, 필터 조합 정상. Kanban 응답은 status 별 grouped, 각 컬럼 `orderInColumn` 오름차순 |
| **FR-ISSUE-003** | API `POST /api/v1/admin/issues` — 신규 등록. Request DTO snake_case (`title, description, type, priority, assignee_admin_id, due_date, labels`). 201 응답 | 필수값 누락 → 400, 정상 → 201 + 생성 row |
| **FR-ISSUE-004** | API `PATCH /api/v1/admin/issues/:id` — 부분 수정 (status / priority / assignee / due_date / labels / title / description) | partial body 허용, 응답 200 |
| **FR-ISSUE-005** | API `PATCH /api/v1/admin/issues/:id/move` — Kanban DnD 전용. body `{ to_status, to_index }`. 트랜잭션으로 같은 컬럼 내 다른 카드 `orderInColumn` 재정렬 | 200, DB 일관성 (gap 없음 보장) |
| **FR-ISSUE-006** | API `DELETE /api/v1/admin/issues/:id` (admin only) | operator 403, admin 204 |
| **FR-ISSUE-007** | CMS 신규 페이지 `/project/issues` — view 토글 (List ↔ Kanban) 우상단. 선택 상태 `localStorage` 기억 | 새로고침 후에도 마지막 view 유지 |
| **FR-ISSUE-008** | List view: 정렬 가능한 표 (key·title·type·status·priority·assignee·due). 헤더 클릭 정렬, 행 클릭 → 상세 drawer | 정렬·필터 동작, drawer 에서 inline 편집 가능 |
| **FR-ISSUE-009** | Kanban view: 6개 컬럼 (status enum 순). 카드 DnD 로 컬럼 이동 → `PATCH /move` 호출. 카드 본문은 key + title + priority 칩 + assignee 아바타 | DnD 후 즉시 반영, 실패 시 rollback + toast |
| **FR-ISSUE-010** | "이슈 추가" 버튼 (admin/operator). 모달 폼 (title 필수, 그 외 선택). 등록 후 backlog 컬럼 최상단 추가 | 폼 검증 동작, 추가 후 화면 즉시 반영 |
| **FR-ISSUE-011** | i18n: 신규 namespace `issue` 4언어 동시 등록. status/type/priority enum 라벨 다국어 | 언어 전환 시 컬럼 헤더·필터 라벨 모두 전환 |
| **FR-ISSUE-012** | 좌측 sub-nav 에 "이슈" 메뉴 추가 (Lucide `BugPlay` 또는 `KanbanSquare` outline) | `/project/issues` 활성 시 highlight |
| **FR-ISSUE-013** | RBAC: read = admin/operator/viewer, create/update = admin/operator, delete = admin only | 각 role 로 로그인 후 동작 검증 |

## 6. 비기능 요구사항 (NFR)

| NFR ID | 항목 | 기준 |
|---|---|---|
| NFR-001 | 동기화 성능 | 100 docs sync ≤ 3초 (P95, staging 기준) |
| NFR-002 | Kanban 렌더링 | 200 issues, 6 컬럼, 초기 paint ≤ 500ms |
| NFR-003 | DnD 응답 | optimistic update, 서버 응답 ≤ 300ms (P95) |
| NFR-004 | 권한 분리 | 모든 API admin-jwt + RolesGuard 통과 |
| NFR-005 | i18n 커버리지 | 신규 키 4언어 누락 0 (CI 검증 — 기존 lint 규칙 재사용) |
| NFR-006 | 보안 | sync API 는 admin only, repo 외부 경로 traversal 방지 (`path.resolve` + base check) |
| NFR-007 | 테스트 커버리지 | 신규 use-case 단위 테스트 ≥ 1개/use-case, controller integration ≥ key path |
| NFR-008 | 트랜잭션 | `move` 는 같은 컬럼 reorder 와 컬럼 변경 모두 단일 Prisma transaction |

## 7. 데이터 모델 (요약)

### 7.1 `issues` 테이블

```
issues
├─ id            UUID PK
├─ key           VARCHAR(20) UNIQUE     -- IIS-001..
├─ title         VARCHAR(200) NOT NULL
├─ description   TEXT                    -- markdown
├─ type          ENUM(TASK,BUG,STORY,RISK)
├─ status        ENUM(BACKLOG,TODO,IN_PROGRESS,REVIEW,DONE,CANCELED)
├─ priority      ENUM(P0,P1,P2,P3)
├─ assignee_admin_id UUID FK admin_users.id NULL
├─ reporter_admin_id UUID FK admin_users.id NOT NULL
├─ due_date      DATE NULL
├─ labels        TEXT NULL              -- comma-separated, 검색용 단순 보관
├─ order_in_column INT NOT NULL DEFAULT 0
├─ created_at / updated_at TIMESTAMPTZ
INDEX (status, order_in_column), (assignee_admin_id), (priority)
```

### 7.2 `issue_keys` 시퀀스

PostgreSQL 시퀀스 `issue_key_seq` + 헬퍼 함수 → `IIS-${nextval}` 포맷팅.

## 8. 트레이서빌리티

| FR | 구현 위치(예정) | TC ID |
|---|---|---|
| FR-DOCS-SYNC-001..003 | `packages/backend/scripts/sync-docs.ts` | TC-260506-DOCS-001..003 |
| FR-DOCS-SYNC-005..007 | `admin-project-docs.controller.ts` + new use-case | TC-260506-DOCS-005..007 |
| FR-DOCS-SYNC-006 | `packages/cms/src/features/project/docs-list-page.tsx` | TC-260506-DOCS-006 (E2E) |
| FR-ISSUE-001..006 | `packages/backend/src/modules/issue-tracker/**` | TC-260506-ISSUE-001..006 |
| FR-ISSUE-007..012 | `packages/cms/src/features/project/issues/**` | TC-260506-ISSUE-007..012 (E2E) |

## 9. 리스크

| ID | 리스크 | 대응 |
|---|---|---|
| R1 | sync API 가 Docker 컨테이너 내부 파일시스템을 본다 → 컨테이너에 `docs/` 가 mount 되지 않으면 동작 X | deploy 시 `docker-compose.staging.yml` 에 `./docs:/app/docs:ro` bind mount 추가 또는 release 디렉터리에 docs 포함 (현재 rsync 가 docs 포함하므로 OK) |
| R2 | `project_documents.slug` 충돌 (다른 폴더 동일 파일명) | seed 의 `slugify` 가 path 전체 사용 — 변경 X |
| R3 | Kanban DnD orderInColumn 재정렬이 동시 편집 시 race | 단일 트랜잭션 + version optimistic lock 후속 검토 |
| R4 | 이슈 키 시퀀스가 staging/local 분기될 경우 충돌 | DB 단위 시퀀스이므로 환경 격리됨, 문제 없음 |

## 10. 승인 대기

본 분석서 검토 후 다음 단계:
- `docs/plan/PLN-260506-project-docs-sync-and-issue-tracker.md` (작업 계획 + 화면 구성도)
- `docs/test/TC-260506-project-docs-sync-and-issue-tracker.md` (테스트 케이스)

검토 의견 / OK 사인 부탁드립니다.
