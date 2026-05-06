# PLN-260507 — CMS 운영자 관리 UI (신규 등록 + 역할 변경) 구현 계획

- 작성일: 2026-05-07
- 작성자: Gray Kim
- 상태: **승인 대기 (사용자 진행 지시 필요)**
- 선행: [REQ-260507-cms-operator-management-ui](../analysis/REQ-260507-cms-operator-management-ui.md)
- 예상 소요: **2.5 ~ 3h** (CMS 단독 — backend 변경 없음)

---

## 0. 작업 범위

✅ 본 PLN 포함
- `[+ 신규 어드민]` 버튼 + `OperatorFormDialog` 모달
- 행 ⋮ 메뉴 + "역할 변경" → `RoleChangeDialog` 모달
- 등록 성공 후 평문 비번 1회 표시 confirm 다이얼로그
- `admin-api.ts` — `createOperator` / `updateRole` 메서드 신규
- 에러 인라인/Toast 처리 (5종 ErrorCode)
- `operator` i18n namespace 4 언어
- 본인 행 ⋮ 메뉴 비활성 (자기 자신 변경 클라이언트 가드)
- 트레이스빌리티 매트릭스 갱신 (FR-102 CMS ⬜ → ✅)

⛔ 본 PLN 제외 (후속)
- 비밀번호 자동 생성 (`[↻ 자동 생성]` 버튼) — REQ §6 #2
- suspend / unsuspend
- 비밀번호 reset (notification 모듈 의존)
- MFA enrollment

---

## 1. 화면구성도 (UI Wireframe)

PLN-260506 §1.2~§1.4 와이어프레임을 코드로 옮긴다. 본 PLN 에서 핵심만 재기재.

### 1.1 SCR-CMS-OPS-LIST — 운영자 목록 (보강)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 운영자 관리                                  [+ 신규 어드민]        │  ← 신규 버튼 (admin only)
│ CMS admin / operator / viewer 계정. 잠금 해제·신규 등록·역할 변경.   │  ← 카피 변경
├─────────────────────────────────────────────────────────────────────┤
│ [잠금 해제 패널 — 기존 그대로]                                        │
├─────────────────────────────────────────────────────────────────────┤
│ 전체 (N)                                                            │
│ 이메일             │ 이름     │ 역할     │ 상태 │ 최근로그인 │생성일│⋮│
│ ─────────────────── ┼────────── ┼────────── ┼───── ┼────────── ┼─────┼─│
│ admin@a-idol.dev   │ Gray Kim │ admin    │ ●   │ 5분 전     │ ... │⋮│  ← 본인 행: ⋮ 비활성 (회색)
│ ops1@a-idol.dev    │ Yuna     │ operator │ ●   │ 2시간 전   │ ... │⋮│
│ view1@a-idol.dev   │ Mina     │ viewer   │ ●   │ 어제       │ ... │⋮│
└─────────────────────────────────────────────────────────────────────┘

⋮ 메뉴 (admin 권한 + 본인 아닌 행):
   └─ 역할 변경
```

### 1.2 SCR-CMS-OPS-CREATE — 신규 어드민 등록 모달

```
┌────────────────────────────────────────────────┐
│ 신규 어드민 등록                         [×]   │
├────────────────────────────────────────────────┤
│ 이메일 *      [____________________________]  │
│               ⚠ 이미 등록된 이메일입니다.      │ ← ADMIN_EMAIL_DUPLICATE
│                                                │
│ 이름 *        [_________________] (1–40자)    │
│                                                │
│ 비밀번호 *    [____________________________]  │
│               · 8자 이상                       │
│               · 영문 + 숫자 + 특수문자 조합    │
│                                                │
│ 역할 *        ( ) admin                        │
│               (•) operator                     │
│               ( ) viewer                       │
│               ⚠ admin 역할은 최대 3명까지      │ ← ADMIN_LIMIT_EXCEEDED
│                                                │
│ ℹ 등록 후 비밀번호를 신규 사용자에게 안전한    │
│   채널로 전달하세요. 시스템에서 자동 발송      │
│   하지 않습니다.                                │
├────────────────────────────────────────────────┤
│                          [취소]  [등록]        │
└────────────────────────────────────────────────┘
```

**성공 후 확인 다이얼로그**
```
┌────────────────────────────────────────────────┐
│ ✓ 어드민이 등록되었습니다                      │
├────────────────────────────────────────────────┤
│ 이메일   ops2@a-idol.dev                       │
│ 비밀번호 ████████████████  [👁 보기] [📋 복사] │
│                                                │
│ ⚠ 이 비밀번호는 한 번만 표시됩니다.            │
│   안전한 채널로 사용자에게 전달하세요.         │
├────────────────────────────────────────────────┤
│                                  [확인]        │
└────────────────────────────────────────────────┘
```
- 평문 비번은 등록 모달이 입력 받은 값 그대로 (서버 응답에는 미포함, 클라이언트 메모리 임시 보유)
- "확인" 클릭 시 메모리에서 즉시 소거 — 페이지 이탈 시에도 마찬가지

### 1.3 SCR-CMS-OPS-ROLE-CHANGE — 역할 변경 모달

```
┌────────────────────────────────────────────────┐
│ 역할 변경                                [×]   │
├────────────────────────────────────────────────┤
│ 대상       ops1@a-idol.dev (Yuna)              │
│ 현재 역할  operator                            │
│                                                │
│ 변경 역할  [operator ▾]                        │
│             ├ admin                            │
│             ├ operator                         │
│             └ viewer                           │
│                                                │
│ ⚠ admin → 다른 역할 변경 시 admin 이 1명만    │ ← ADMIN_LAST_ADMIN_DEMOTION
│   남는 경우 변경할 수 없습니다.                │
│                                                │
│ ⚠ admin 역할은 최대 3명까지 등록 가능합니다.  │ ← ADMIN_LIMIT_EXCEEDED
├────────────────────────────────────────────────┤
│                          [취소]  [저장]        │
└────────────────────────────────────────────────┘
```

### 1.4 인터랙션 → API 매핑

| 액션 | 요청 | 응답 처리 |
|---|---|---|
| `[+ 신규 어드민]` 클릭 | UI only | 모달 open |
| 등록 모달 `[등록]` | `POST /api/v1/admin/operators` body `{ email, display_name, password, role }` | 201 → 평문 비번 confirm 다이얼로그 → 목록 갱신 + Toast |
| `ADMIN_EMAIL_DUPLICATE` (409) | — | 이메일 필드 하단 인라인 |
| `ADMIN_LIMIT_EXCEEDED` (409) | — | 역할 라디오 하단 인라인 |
| 약한 비밀번호 (400 BadRequest) | — | 비밀번호 필드 하단 인라인 (class-validator 메시지) |
| 행 ⋮ → "역할 변경" | UI only | 모달 open (본인 행 비활성) |
| 역할 변경 `[저장]` | `PATCH /api/v1/admin/operators/:id/role` body `{ role }` | 200 → 행 갱신 + Toast |
| `ADMIN_LAST_ADMIN_DEMOTION` (409) | — | 모달 하단 인라인 |
| `ADMIN_LIMIT_EXCEEDED` (409) | — | 모달 하단 인라인 |
| `ADMIN_SELF_MODIFICATION_FORBIDDEN` (403) | — | Toast (UI 가드 우회 시 fail-safe) |

### 1.5 i18n 키 초안 (`operator` namespace)

```
operator.title                          = "운영자 관리"
operator.subtitle                       = "CMS admin / operator / viewer 계정"
operator.actions.create                 = "신규 어드민"
operator.actions.role_change            = "역할 변경"
operator.actions.cancel                 = "취소"
operator.actions.save                   = "저장"
operator.actions.register               = "등록"
operator.actions.confirm                = "확인"
operator.field.email                    = "이메일"
operator.field.display_name             = "이름"
operator.field.password                 = "비밀번호"
operator.field.role                     = "역할"
operator.field.current_role             = "현재 역할"
operator.field.target                   = "대상"
operator.create_modal.title             = "신규 어드민 등록"
operator.create_modal.password_hint     = "8자 이상 · 영문 + 숫자 + 특수문자 조합"
operator.create_modal.handover_notice   = "등록 후 비밀번호를 신규 사용자에게 안전한 채널로 전달하세요. 시스템에서 자동 발송하지 않습니다."
operator.role_change_modal.title        = "역할 변경"
operator.password_shown.title           = "어드민이 등록되었습니다"
operator.password_shown.warning         = "이 비밀번호는 한 번만 표시됩니다. 안전한 채널로 사용자에게 전달하세요."
operator.password_shown.show            = "보기"
operator.password_shown.copy            = "복사"
operator.errors.email_duplicate         = "이미 등록된 이메일입니다."
operator.errors.limit_exceeded          = "admin 역할은 최대 3명까지 등록 가능합니다."
operator.errors.last_admin_demotion     = "마지막 admin 계정은 강등할 수 없습니다."
operator.errors.self_modification       = "자기 자신의 역할은 변경할 수 없습니다."
operator.errors.weak_password           = "비밀번호 정책에 맞지 않습니다 (8자 이상 + 흔한 패턴 제외)."
operator.toast.created                  = "어드민이 등록되었습니다."
operator.toast.role_updated             = "역할이 변경되었습니다."
operator.menu.self_disabled_tooltip     = "자기 자신의 역할은 변경할 수 없습니다."
```

4 언어: `ko / en / vi / zh-CN`. 4 JSON 파일 추가 + `i18n.ts` namespace 등록.

---

## 2. 시스템 개발 현황 분석 요약

| 영역 | 상태 |
|---|---|
| FR-102 backend 엔드포인트 | ✅ staging 라이브 (POST/PATCH 401 응답 확인) |
| `OperatorsPage` 목록 + UnlockAccountPanel | ✅ 구현 |
| `admin-api.ts` 의 `createOperator` / `updateRole` | ❌ 없음 |
| 등록 / 역할변경 모달 | ❌ 없음 |
| `operator` i18n namespace | ❌ 없음 |
| 라우터 가드 (`/operators` admin only) | ✅ 적용됨 |
| 트레이스빌리티 (FR-102) | 🟡 backend ✅ / CMS ⬜ — 본 PLN 후 ✅ |

---

## 3. 구현 단계별 계획

### Step 1 — admin-api.ts 메서드 추가 (15 min)

[packages/cms/src/lib/admin-api.ts](../../packages/cms/src/lib/admin-api.ts)

```ts
createOperator: (body: {
  email: string;
  display_name: string;
  password: string;
  role: 'admin' | 'operator' | 'viewer';
}) =>
  apiFetch<AdminUserDto>('/api/v1/admin/operators', {
    method: 'POST',
    body,
    token: token(),
  }),
updateOperatorRole: (id: string, role: 'admin' | 'operator' | 'viewer') =>
  apiFetch<AdminUserDto>(`/api/v1/admin/operators/${id}/role`, {
    method: 'PATCH',
    body: { role },
    token: token(),
  }),
```

### Step 2 — i18n `operator` namespace (15 min)

- 신규 4 파일: `packages/cms/src/i18n/{ko,en,vi,zh-CN}/operator.json`
- `i18n.ts` resources + ns 배열에 추가

### Step 3 — `OperatorFormDialog` 컴포넌트 (45 min)

파일: `packages/cms/src/features/operators/operator-form-dialog.tsx`

- 입력: email / display_name / password / role
- 클라이언트 가드: 이메일 형식 / 길이 / 빈 값
- `useMutation` → `createOperator`
- 성공: 평문 비번을 부모로 넘김 + 모달 close
- 에러 매핑:
  - 응답 `code === 'ADMIN_EMAIL_DUPLICATE'` → 이메일 필드 하단
  - `'ADMIN_LIMIT_EXCEEDED'` → 역할 라디오 하단
  - `400` BadRequest (class-validator) → 비밀번호 필드 또는 generic message
  - 그 외 → Toast / 모달 하단

### Step 4 — `PasswordShownDialog` (15 min)

파일: 동일 디렉토리

- props: `{ email, password, open, onClose }`
- 비번 표시: 기본 `••••••••` 마스킹, `[보기]` 토글, `[복사]` 클립보드
- "확인" 클릭 → `onClose()` (부모가 password state 즉시 null 처리)

### Step 5 — `RoleChangeDialog` 컴포넌트 (30 min)

파일: `packages/cms/src/features/operators/role-change-dialog.tsx`

- props: `{ target: AdminUserDto, open, onClose }`
- select: admin / operator / viewer (현재 값 default)
- `useMutation` → `updateOperatorRole`
- 에러 매핑: `ADMIN_LAST_ADMIN_DEMOTION` / `ADMIN_LIMIT_EXCEEDED` / `ADMIN_SELF_MODIFICATION_FORBIDDEN`

### Step 6 — `OperatorsPage` 보강 (30 min)

[packages/cms/src/features/operators/operators-page.tsx](../../packages/cms/src/features/operators/operators-page.tsx)

- 헤더 우측 `[+ 신규 어드민]` 버튼 — `useAuthStore` 로 admin 권한 확인 (이미 라우터에서 admin 보장이지만 클라이언트 가드 재확인)
- 행 마지막 컬럼 `⋮` 메뉴 (Headless UI `Menu` 또는 inline button)
  - 본인 행: `disabled` + tooltip
  - 그 외: "역할 변경" 항목
- 페이지 카피 "*…다음 sprint*" 제거 → 새 카피 ("CMS admin / operator / viewer 계정. 잠금 해제·신규 등록·역할 변경.")
- 모달 state: `creatingOpen`, `passwordShown: { email, password } | null`, `roleChangeTarget: AdminUserDto | null`

### Step 7 — 트레이스빌리티 (5 min)

[docs/design/a-idol-req-definition.md](../../docs/design/a-idol-req-definition.md) FR-102 행:
- `✅ (backend) / ⬜ (CMS)` → `✅ (backend + CMS)`

### Step 8 — 검증 (15 min)

- `make typecheck` (cms 만 변경 — 통과 확인)
- `make lint`
- 로컬 dev 서버에서 admin 로그인 → smoke:
  - 신규 등록 happy path
  - 이메일 중복 에러
  - 역할 변경 happy path
  - 본인 행 ⋮ 비활성

---

## 4. 신규 / 수정 파일 목록

### 신규
| 파일 | 용도 |
|---|---|
| `packages/cms/src/features/operators/operator-form-dialog.tsx` | 신규 등록 모달 |
| `packages/cms/src/features/operators/password-shown-dialog.tsx` | 평문 비번 1회 표시 |
| `packages/cms/src/features/operators/role-change-dialog.tsx` | 역할 변경 모달 |
| `packages/cms/src/i18n/{ko,en,vi,zh-CN}/operator.json` | i18n 4 언어 (4 파일) |

### 수정
| 파일 | 변경 |
|---|---|
| `packages/cms/src/lib/admin-api.ts` | `createOperator` + `updateOperatorRole` 메서드 |
| `packages/cms/src/features/operators/operators-page.tsx` | 헤더 버튼 + ⋮ 메뉴 + 모달 state + 카피 |
| `packages/cms/src/i18n/i18n.ts` | `operator` namespace import + register |
| `docs/design/a-idol-req-definition.md` | FR-102 행 갱신 |

---

## 5. 사이드 임팩트

| 항목 | 영향 |
|---|---|
| Backend / Prisma / DB | 없음 |
| 다른 CMS 페이지 | 없음 (operators 한정) |
| 번들 사이즈 | 모달 2개 + i18n 4 파일 → 약 +5KB gzip |
| staging 배포 | CMS dist 만 재빌드 + rsync. backend 재배포 불요 (`deploy.sh` 가 자동으로 함께 처리) |
| 트레이스빌리티 | FR-102 CMS 컬럼 ✅ |
| 보안 | 평문 비번을 클라이언트 메모리에 임시 보유 — 모달 close 시 state null. 서버 응답에 비번 없음 |

---

## 6. 리스크

| # | 리스크 | 대응 |
|---|---|---|
| R1 | 클라이언트가 본인 행 ⋮ 비활성을 우회 (개발자 도구로 클릭) | 서버의 `ADMIN_SELF_MODIFICATION_FORBIDDEN` 가드가 fail-safe |
| R2 | 평문 비밀번호 메모리 노출 (devtools/extension) | 프론트엔드 한계 — 운영 정책상 admin 만 사용. 대응: `PasswordShownDialog` close 시 즉시 state null + 모달 외부 클릭 시 close 차단 (확인 강제) |
| R3 | 약한 비밀번호 → 400 응답의 `message` 가 NIST/한국어 혼합 | 서버측 IsStrongPassword decorator 의 한국어 메시지 그대로 노출 — 일관됨 |
| R4 | admin 한도 race (3명 동시 등록) | 서버에서 카운트 검증 — 4번째 거부. 클라이언트 추가 가드 불필요 (서버 권위) |
| R5 | i18n 누락 키 → fallback 안 되면 `operator.toast.created` 식 raw 키 노출 | 4 언어 모두 동일 키 set 보장. `fallbackLng: 'ko'` 가 안전망 |

---

## 7. 승인 체크리스트

### 7.1 범위
- [ ] §0 포함/제외 범위 적절
- [ ] 비밀번호 자동 생성 버튼은 후속 작업으로 분리 (REQ §6 #2)
- [ ] suspend / 비밀번호 reset 후속 미루기 동의

### 7.2 화면구성도 (§1)
- [ ] LIST 보강 (헤더 버튼 + ⋮ 메뉴) OK
- [ ] CREATE 모달 — 입력 필드 / 에러 노출 위치 OK
- [ ] PasswordShownDialog — 평문 비번 1회 표시 + "확인" 후 메모리 소거 OK
- [ ] ROLE-CHANGE 모달 — 본인 행 비활성 + select 흐름 OK
- [ ] i18n `operator` namespace 키 네이밍 (§1.5) OK

### 7.3 기타
- [ ] FR-102 트레이스빌리티 갱신 포함
- [ ] 본인 행 ⋮ 비활성 vs hide → **비활성** 채택
- [ ] 약한 비밀번호 (400) 메시지는 서버 메시지 그대로 노출

---

## 8. 다음 단계

승인 또는 조정 의견 주시면 Step 1 부터 구현 시작하겠습니다.
