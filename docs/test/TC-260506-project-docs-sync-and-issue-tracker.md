# TC-260506 — 프로젝트 문서 동기화 & 이슈 트래커 테스트 케이스

| 항목 | 값 |
|---|---|
| ID | TC-260506 |
| 연관 REQ | [REQ-260506](../analysis/REQ-260506-project-docs-sync-and-issue-tracker.md) |
| 연관 PLN | [PLN-260506](../plan/PLN-260506-project-docs-sync-and-issue-tracker.md) |
| 작성일 | 2026-05-06 |
| 작성자 | Gray Kim |

분류: **Unit (U)** / **Integration (I)** / **E2E (E)** / **Manual (M)**
우선순위: **P0** (배포 차단) / **P1** (필수) / **P2** (있으면 좋음)

---

## A. 문서 동기화 (FR-DOCS-SYNC)

### TC-260506-DOCS-001 [U / P0] — sync 함수: 신규 파일 INSERT
- **AC 매핑**: FR-DOCS-SYNC-001
- **전제**: `project_documents` 테이블 비어 있음. `docs/adr/ADR-099-test.md` 존재 (1줄 본문)
- **입력**: `syncProjectDocs({ prisma, repoRoot, adminId })`
- **기대**: 반환값 `{ created: 1+N, updated: 0, unchanged: 0, archived: 0 }`. DB 에 row 생성, `version=1`, `sourceType='FILE'`

### TC-260506-DOCS-002 [U / P0] — 동일 본문 재실행 시 idempotent
- **AC 매핑**: FR-DOCS-SYNC-002
- **전제**: TC-001 직후
- **입력**: 같은 함수 즉시 재호출
- **기대**: `created: 0, updated: 0, unchanged: 전체수`. 어떤 row 의 `updated_at` 도 변경되지 않음

### TC-260506-DOCS-003 [U / P0] — 본문 변경 시 version 증가
- **AC 매핑**: FR-DOCS-SYNC-003
- **전제**: 기존 doc 1건 (`version=1`)
- **입력**: 해당 파일에 1줄 추가 후 sync 호출
- **기대**: 해당 row `version=2`, `updated_at` 갱신, 다른 row 영향 없음

### TC-260506-DOCS-004 [U / P1] — 삭제된 파일 → ARCHIVED 전환
- **AC 매핑**: FR-DOCS-SYNC-007
- **전제**: 기존 doc 1건 (status='APPROVED')
- **입력**: 해당 마크다운 파일 삭제 후 sync 호출
- **기대**: row 삭제되지 않음, `status='ARCHIVED'`, 반환 `archived: 1`

### TC-260506-DOCS-005 [I / P0] — sync API 권한 (admin only)
- **AC 매핑**: FR-DOCS-SYNC-005, NFR-004
- **시나리오**:
  1. 토큰 없이 호출 → 401
  2. operator 토큰 → 403
  3. admin 토큰 → 200 + body `{ created, updated, unchanged, archived, durationMs }`

### TC-260506-DOCS-006 [E / P1] — CMS "다시 가져오기" 버튼
- **AC 매핑**: FR-DOCS-SYNC-006
- **시나리오**:
  1. operator 로그인 → `/project/docs` → 버튼 비표시
  2. admin 로그인 → 버튼 표시 → 클릭 → confirm → 토스트 `신규 N / 갱신 M / 보관 K (XXXms)`
  3. 목록 자동 새로고침 (react-query `invalidateQueries`)

### TC-260506-DOCS-007 [I / P0] — Path traversal 방지
- **AC 매핑**: NFR-006
- **입력**: `repoRoot` 환경변수에 `/etc` 주입 후 호출
- **기대**: `repoRoot` 가 monorepo root 아래가 아니면 거부 (`Error: invalid repo root`). 200 안 옴

### TC-260506-DOCS-008 [M / P1] — deploy.sh 자동 sync
- **AC 매핑**: FR-DOCS-SYNC-004
- **시나리오**: 로컬에서 ADR 1개 추가 → `./deploy/staging/deploy.sh` 실행 → 로그에 `📚 sync project docs` + 카운트 표시 → 스테이징 `/project/docs` 에서 신규 doc 확인
- **변형**: `--no-docs-sync` 옵션 시 sync 단계 skip 로그

### TC-260506-DOCS-009 [M / P2] — CLI 단독 실행
- **AC 매핑**: FR-DOCS-SYNC-001
- **명령**: `pnpm --filter @a-idol/backend sync-docs`
- **기대**: stdout 에 `created N / updated M / unchanged K / archived L` 출력, exit 0

---

## B. 이슈 트래커 — Backend (FR-ISSUE-001..006)

### TC-260506-ISSUE-001 [U / P0] — Issue 생성 use-case
- **AC 매핑**: FR-ISSUE-003
- **입력**: `{ title:'t', type:'TASK', priority:'P1', reporterAdminId }`
- **기대**: row 생성, `key='IIS-1'` (시퀀스 첫 호출), `status='BACKLOG'` (기본), `orderInColumn=0`

### TC-260506-ISSUE-002 [U / P0] — Key 자동 증가
- **AC 매핑**: FR-ISSUE-001
- **입력**: 연속 3건 createIssue
- **기대**: `IIS-1, IIS-2, IIS-3`. 트랜잭션 동시성에서도 중복 없음

### TC-260506-ISSUE-003 [U / P0] — listIssues 필터
- **AC 매핑**: FR-ISSUE-002
- **입력**: 5건 시드 (status/priority 다양) → `list({ status:['TODO','IN_PROGRESS'], priority:['P0'] })`
- **기대**: 조건 일치 행만 반환, `orderInColumn` 정렬

### TC-260506-ISSUE-004 [U / P0] — kanban view 그룹핑
- **AC 매핑**: FR-ISSUE-002
- **입력**: 5건 시드 → `list({ view:'kanban' })`
- **기대**: `{ BACKLOG:[…], TODO:[…], IN_PROGRESS:[…], REVIEW:[…], DONE:[…], CANCELED:[…] }`. 빈 컬럼은 빈 배열

### TC-260506-ISSUE-005 [U / P0] — moveIssue: 같은 컬럼 reorder
- **AC 매핑**: FR-ISSUE-005
- **전제**: TODO 컬럼에 IIS-1(0), IIS-2(1), IIS-3(2)
- **입력**: `move(IIS-3, { to_status:'TODO', to_index:0 })`
- **기대**: 순서 IIS-3(0), IIS-1(1), IIS-2(2). 단일 트랜잭션, gap 없음

### TC-260506-ISSUE-006 [U / P0] — moveIssue: 다른 컬럼 이동 + 양쪽 재정렬
- **AC 매핑**: FR-ISSUE-005, NFR-008
- **전제**: TODO[IIS-1(0), IIS-2(1)], IN_PROGRESS[IIS-3(0)]
- **입력**: `move(IIS-1, { to_status:'IN_PROGRESS', to_index:1 })`
- **기대**: TODO[IIS-2(0)], IN_PROGRESS[IIS-3(0), IIS-1(1)]

### TC-260506-ISSUE-007 [U / P1] — updateIssue partial
- **AC 매핑**: FR-ISSUE-004
- **입력**: `update(id, { priority:'P0' })`만 전달
- **기대**: priority 만 변경, 다른 필드 보존

### TC-260506-ISSUE-008 [I / P0] — RBAC controller
- **AC 매핑**: FR-ISSUE-013, NFR-004
- **시나리오**:
  - GET 목록: viewer/operator/admin 200
  - POST 생성: viewer 403, operator/admin 201
  - DELETE: operator 403, admin 204
  - 토큰 없음: 401

### TC-260506-ISSUE-009 [I / P1] — Request DTO snake_case 검증
- **AC 매핑**: FR-ISSUE-003 (CLAUDE.md 컨벤션)
- **입력**: `{ "assigneeAdminId": "..." }` (camelCase)
- **기대**: 400 Bad Request (forbidNonWhitelisted). snake_case (`assignee_admin_id`) 만 통과

### TC-260506-ISSUE-010 [I / P1] — moveIssue 잘못된 to_index
- **AC 매핑**: FR-ISSUE-005
- **입력**: 컬럼 size=2 인데 `to_index=99`
- **기대**: 끝(idx=2)에 배치, gap 없이 정상 처리 (clamp)

---

## C. 이슈 트래커 — CMS (FR-ISSUE-007..012)

### TC-260506-ISSUE-011 [E / P0] — View 토글 + localStorage 유지
- **AC 매핑**: FR-ISSUE-007
- **시나리오**: List view 진입 → Kanban 토글 → 새로고침 → Kanban 으로 복원

### TC-260506-ISSUE-012 [E / P0] — List view 정렬·필터·drawer
- **AC 매핑**: FR-ISSUE-008
- **시나리오**: priority 컬럼 헤더 클릭 → 오름차순 정렬 → 행 클릭 → drawer 열림 → priority 변경 후 저장 → 목록 즉시 갱신

### TC-260506-ISSUE-013 [E / P0] — Kanban DnD 동작
- **AC 매핑**: FR-ISSUE-009, NFR-003
- **시나리오**: 카드 BACKLOG → IN_PROGRESS 드래그 → optimistic 이동 → 200 응답 → 토스트 없음
- **실패 케이스**: 네트워크 에러 mock → rollback (원래 위치 복귀) + error 토스트

### TC-260506-ISSUE-014 [E / P0] — 이슈 추가 모달
- **AC 매핑**: FR-ISSUE-010
- **시나리오**:
  1. 제목 비움 → 등록 비활성 (검증 메시지)
  2. 제목 + type=TASK + priority=P1 입력 → 등록 → BACKLOG 컬럼 최상단에 추가
  3. 모달 닫힘 + 토스트

### TC-260506-ISSUE-015 [E / P1] — i18n 4언어 전환
- **AC 매핑**: FR-ISSUE-011, NFR-005
- **시나리오**: 언어 ko → en → vi → zh-CN 순으로 전환 → 컬럼 헤더(BACKLOG/TODO/…), 필터 라벨, 모달 라벨 모두 해당 언어로 표시. 누락 키 0

### TC-260506-ISSUE-016 [E / P1] — sub-nav + RBAC route
- **AC 매핑**: FR-ISSUE-012, FR-ISSUE-013
- **시나리오**: viewer 로그인 → 좌측 sub-nav "이슈" 표시 + 진입 가능, "추가" 버튼 비표시. operator 진입 후 "추가" 표시, "삭제" 비표시. admin 모두 표시

### TC-260506-ISSUE-017 [E / P2] — Drawer URL 공유
- **AC 매핑**: PLN-260506 §4 (Drawer state)
- **시나리오**: drawer 연 상태 URL `?issue=IIS-3` → 새 탭에서 같은 URL → 동일 drawer 자동 열림

---

## D. 비기능 (NFR)

### TC-260506-NFR-001 [M / P1] — Sync 성능
- **NFR**: NFR-001
- **시나리오**: docs 100건 시드 후 sync API 호출 → durationMs ≤ 3000

### TC-260506-NFR-002 [M / P1] — Kanban 렌더링 성능
- **NFR**: NFR-002
- **시나리오**: 200 issues 시드 → /project/issues Kanban 진입 → Performance 패널 First Paint ≤ 500ms (로컬 Chrome)

### TC-260506-NFR-003 [E / P1] — DnD 응답 시간
- **NFR**: NFR-003
- **시나리오**: 카드 이동 → network tab 응답 시간 ≤ 300ms (P95, 10회)

---

## E. 회귀 (Regression)

### TC-260506-REG-001 [M / P0] — 기존 /project/docs 영향 없음
- **시나리오**: sync API/버튼 미호출 시 기존 목록·상세·편집 동작 그대로

### TC-260506-REG-002 [M / P0] — admin/operator 다른 메뉴 영향 없음
- **시나리오**: catalog/chat/commerce 등 기존 메뉴 진입 OK

### TC-260506-REG-003 [I / P1] — Prisma migration 적용 후 seed 정상
- **시나리오**: `make reset && make bootstrap` 성공, `seed-contract.spec.ts` 통과

---

## 커버리지 매트릭스

| FR/NFR | 단위 | 통합 | E2E | Manual |
|---|---|---|---|---|
| FR-DOCS-SYNC-001 | 001 | - | - | 009 |
| FR-DOCS-SYNC-002 | 002 | - | - | - |
| FR-DOCS-SYNC-003 | 003 | - | - | - |
| FR-DOCS-SYNC-004 | - | - | - | 008 |
| FR-DOCS-SYNC-005 | - | 005 | - | - |
| FR-DOCS-SYNC-006 | - | - | 006 | - |
| FR-DOCS-SYNC-007 | 004 | - | - | - |
| FR-ISSUE-001 | 001,002 | - | - | - |
| FR-ISSUE-002 | 003,004 | - | - | - |
| FR-ISSUE-003 | 001 | 008,009 | - | - |
| FR-ISSUE-004 | 007 | - | 012 | - |
| FR-ISSUE-005 | 005,006 | 010 | 013 | - |
| FR-ISSUE-006 | - | 008 | - | - |
| FR-ISSUE-007 | - | - | 011 | - |
| FR-ISSUE-008 | - | - | 012 | - |
| FR-ISSUE-009 | - | - | 013 | - |
| FR-ISSUE-010 | - | - | 014 | - |
| FR-ISSUE-011 | - | - | 015 | - |
| FR-ISSUE-012 | - | - | 016 | - |
| FR-ISSUE-013 | - | 008 | 016 | - |
| NFR-001 | - | - | - | NFR-001 |
| NFR-002 | - | - | - | NFR-002 |
| NFR-003 | - | - | NFR-003 | - |
| NFR-004 | - | 005,008 | - | - |
| NFR-005 | - | - | 015 | - |
| NFR-006 | - | 007 | - | - |
| NFR-008 | 005,006 | - | - | - |

전체 31개 TC. P0 = 17건, P1 = 11건, P2 = 3건.
