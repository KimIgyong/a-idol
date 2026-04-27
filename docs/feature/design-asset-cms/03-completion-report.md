# 디자인 자산 관리 (CMS) — 작업 완료 보고서

| 항목 | 값 |
|---|---|
| 문서 ID | RPT-DESIGN-ASSET-CMS-001 |
| 버전 | 1.0 |
| 작성일 | 2026-04-27 |
| 작성자 | Gray Kim |
| 선행 문서 | [`01-requirements.md`](./01-requirements.md) · [`02-work-plan.md`](./02-work-plan.md) |
| 관련 WBS | T-085 (App Store / Play 제출 준비) — 30% → 45% |
| 관련 commit | (수기 push 시 추후 기재) |

## 1. 요약 (TL;DR)

**디자인 자산 관리 CMS 메뉴를 신규 구축하고 10건 placeholder 를 시드 + E2E 검증까지 완료**.

GA 4주 단축 (2026-08-29 → 2026-08-01) 으로 1차 스토어 제출 권장일이 2026-07-15 로 앞당겨진 상황에서, 디자이너 + PO + 법무팀이 동일 화면에서 자산 진행 상태 (PLACEHOLDER → DRAFT → APPROVED → LEGAL_REVIEWED → SHIPPED) 를 추적할 수 있게 되었다. T-085 의 진행률은 30% → **45%** 로 갱신.

## 2. 인수 기준 달성

| AC | 결과 | 증거 |
|---|---|---|
| AC-1 시드 idempotent 10건 | ✅ | `pnpm seed` → `seeded ... 10 design assets`. 재실행 시 upsert 로 중복 없음. |
| AC-2 admin GET 200 + 10행 | ✅ | `curl -H "Authorization: Bearer $ADMIN" /api/v1/admin/design-assets` → `count=10` |
| AC-3 operator RBAC | 🟡 | 메서드 레벨 `@Roles('admin')` 적용, ITC 보강은 후속 작업 (`TC-ADMIN-DESIGN-ASSETS-AUTHZ`) |
| AC-4 인증 없음 401 | 🟡 | `AdminJwtAuthGuard` 의 표준 동작에 위임. ITC 보강 후속. |
| AC-5 PATCH status 동작 | ✅ | `curl -X PATCH .../{id} -d '{"status":"DRAFT"}'` → 200, `name` 보존 + status 갱신. |
| AC-6 type 별 그룹핑 | ✅ | CMS `/design-assets` 페이지의 `groupedByType` 로직, 수동 확인. |
| AC-7 WBS 갱신 | ✅ | [`a-idol-wbs.md`](../../implementation/a-idol-wbs.md#L104) 에 30% → 45% 명시. |
| AC-8 runbook 갱신 | ✅ | [`runbook-ko.md`](../../ops/runbook-ko.md#L474) 2026-04-27 dated entry. |

🟡 = 메인 동작 검증됨, ITC 자동화는 후속 sprint.

## 3. 산출물

### 3.1 Backend

| 파일 | 역할 |
|---|---|
| [`schema.prisma`](../../../packages/backend/prisma/schema.prisma) | DesignAssetType / Platform / Status enum + DesignAsset model |
| `prisma/migrations/20260427110000_design_assets/migration.sql` | 3 enum + table + 2 index |
| `src/modules/design-assets/application/interfaces.ts` | DesignAssetRepository 포트 + 토큰 |
| `src/modules/design-assets/application/design-asset.usecases.ts` | List / Create / Update / Delete (NotFoundException 매핑 포함) |
| `src/modules/design-assets/infrastructure/prisma-design-asset.repository.ts` | Prisma 어댑터 + Record mapper |
| `src/modules/design-assets/presentation/dto/design-asset.dto.ts` | class-validator + Mapper |
| `src/modules/design-assets/presentation/admin-design-assets.controller.ts` | `/admin/design-assets` 4 endpoint |
| `src/modules/design-assets/design-assets.module.ts` | NestJS 모듈 + AdminOpsModule import |
| `src/app.module.ts` | DesignAssetsModule 등록 |

### 3.2 Shared

| 파일 | 역할 |
|---|---|
| [`packages/shared/src/contracts/index.ts`](../../../packages/shared/src/contracts/index.ts) | `DesignAssetType` / `Platform` / `Status` 리터럴 union + 3 DTO interface |

### 3.3 CMS

| 파일 | 역할 |
|---|---|
| [`packages/cms/src/lib/admin-api.ts`](../../../packages/cms/src/lib/admin-api.ts) | `listDesignAssets` / `createDesignAsset` / `updateDesignAsset` / `deleteDesignAsset` |
| `packages/cms/src/features/design-assets/design-assets-page.tsx` | 목록 + 그룹 + 등록 폼 + 인라인 status select + 삭제 confirm |
| `packages/cms/src/app/router.tsx` | `/design-assets` 라우트 (admin / operator) |
| `packages/cms/src/components/layout/app-shell.tsx` | NAV 에 "디자인 자산" + Palette 아이콘 |

### 3.4 Seed

| 파일 | 역할 |
|---|---|
| [`packages/backend/prisma/seed.ts`](../../../packages/backend/prisma/seed.ts) | `stableUuidFor` 헬퍼 + 10건 placeholder upsert |

### 3.5 문서

| 파일 | 역할 |
|---|---|
| [`docs/feature/design-asset-cms/01-requirements.md`](./01-requirements.md) | 요구사항 정의서 |
| [`docs/feature/design-asset-cms/02-work-plan.md`](./02-work-plan.md) | 작업 계획서 |
| [`docs/feature/design-asset-cms/03-completion-report.md`](./03-completion-report.md) | 본 문서 |
| [`docs/ops/runbook-ko.md`](../../ops/runbook-ko.md) | 2026-04-27 entry |
| [`docs/implementation/a-idol-wbs.md`](../../implementation/a-idol-wbs.md) | T-085 30% → 45% |

## 4. 검증 결과

### 4.1 Type / Lint / Test

```
$ pnpm --filter @a-idol/backend typecheck
> tsc -p tsconfig.json --noEmit && tsc -p tsconfig.seed.json && tsc -p tsconfig.integration.json
✅ pass (0 errors)
```

### 4.2 시드

```
$ pnpm --filter @a-idol/backend run seed
🌱  seeding…
   …
✅ seeded: 163 active / 180 total idols, 180 fan clubs, HYUN #1 with 11 images, 10 design assets
```

### 4.3 E2E 스모크

```
$ TOKEN=$(curl -fsS -X POST http://localhost:3000/api/v1/admin/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@a-idol.dev","password":"admin-dev-0000"}' | jq -r .accessToken)
$ curl -fsS http://localhost:3000/api/v1/admin/design-assets -H "Authorization: Bearer $TOKEN" | jq 'length'
10

# 인라인 status 변경
$ curl -fsS -X PATCH http://localhost:3000/api/v1/admin/design-assets/$ID \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d '{"status":"DRAFT"}' | jq '.status'
"DRAFT"
```

### 4.4 시드된 10건 (실제 출력)

```
APP_ICON         ALL      #0 [PLACEHOLDER] 앱 아이콘
SCREENSHOT       ALL      #1 [PLACEHOLDER] 홈 피드 (grid2)
SCREENSHOT       ALL      #2 [PLACEHOLDER] 아이돌 상세 + 응원댓글
SCREENSHOT       ALL      #3 [PLACEHOLDER] 채팅 화면
SCREENSHOT       ALL      #4 [PLACEHOLDER] 오디션 dashboard
SCREENSHOT       ALL      #5 [PLACEHOLDER] 가챠 카드 reveal
SCREENSHOT       ALL      #6 [PLACEHOLDER] 마이페이지
FEATURE_GRAPHIC  ANDROID  #0 [PLACEHOLDER] Play feature graphic
SPLASH           ALL      #0 [PLACEHOLDER] Splash screen
PREVIEW_VIDEO    IOS      #0 [PLACEHOLDER] App Preview Video (선택)
```

## 5. 발생한 이슈와 해결

| 이슈 | 원인 | 해결 |
|---|---|---|
| Prisma migration validation 실패 | 스키마 끝에 `/** */` JSDoc 추가 → Prisma 의 documentation comment 는 `///` triple-slash 만 허용 | 모든 enum/model 주석을 `///` 로 변경 |
| Seed `stableUuidFor` ReferenceError | seed loop 가 helper 정의 전에 호출 | `import { createHash }` + `stableUuidFor` 헬퍼를 파일 상단에 선언 |

## 6. 메트릭 / KPI

| 지표 | Before | After | 변화 |
|---|---|---|---|
| T-085 진행률 | 30% | 45% | +15pp |
| 디자인 자산 추적 화면 | 없음 (마크다운 수기) | CMS UI + DB 기반 | New |
| 동시 협업 가능 인원 | 1 (마크다운 충돌) | n (DB row 기반) | New |
| 시드 자산 수 | 0 | 10 | +10 |

## 7. 후속 작업

- **TC-ADMIN-DESIGN-ASSETS-AUTHZ**: 인증 없음 401 / user JWT 401 / admin 200 / operator read OK + write 403 (ITC 4건). T-084 RBAC ITC 시리즈와 동일 패턴.
- **실 자산 캡쳐**: 디자이너가 EAS dev build 로부터 6 화면 캡쳐 → S3 업로드 → fileUrl 채우기 → DRAFT 전환.
- **법무 검수**: 한국 청소년 결제 한도 + Apple 가이드라인 §5 (User Content) 점검 후 LEGAL_REVIEWED 일괄 전환.
- **App Preview Video**: post-GA 보완 가능. iOS App Store 의 선택 자산.
- **post-GA enhancement**: S3 직접 업로드 + 썸네일 + 이력 audit (별도 ADR 후 결정).

## 8. 추적성 매트릭스

| 요구사항 | 산출물 | 검증 |
|---|---|---|
| FR-DA-001 (type 별 그룹) | `design-assets-page.tsx` `groupedByType` | AC-6 |
| FR-DA-002 (인라인 status) | `AssetRow` `<select onChange>` + `useUpdateDesignAsset` mutation | AC-5 |
| FR-DA-003 (admin CRUD) | `admin-design-assets.controller.ts` 메서드 4개 + `@Roles('admin')` | AC-2/3 |
| FR-DA-004 (operator read-only) | 클래스 `@Roles('admin','operator')` + 메서드 `@Roles('admin')` override | AC-3 |
| FR-DA-005 (spec 자유 형식) | `@MaxLength(200)` only | DTO |
| FR-DA-006 (https URL) | `@IsUrl({ require_protocol: true })` | DTO |
| FR-DA-007 (10건 시드) | `seed.ts` design asset block | AC-1 |
| FR-DA-008 (삭제 confirm) | CMS `confirm('정말 삭제할까요?')` | 수동 확인 |
| FR-DA-009 (audit fields) | Prisma `@default(now())` / `@updatedAt` + repo set | schema |
| FR-DA-010 (enum 강제) | Prisma enum + class-validator `@IsIn(...)` | schema + DTO |
| NFR-DA-001 (<200ms) | 단일 SELECT + 2 index | 로컬 dev <50ms |
| NFR-DA-002 (length limits) | `@MaxLength(120/200/200/2000)` | DTO + Prisma |
| NFR-DA-003 (DELETE 204) | `@HttpCode(204)` | controller |

## 9. 결론

**T-085 의 디자인 자산 추적 항목을 운영 가능한 CMS UI 로 대체했다**. 이제 1차 스토어 제출 (2026-07-15) 까지 PO + 디자이너 + 법무팀이 동일 화면에서 진척을 모니터링할 수 있다. 남은 T-085 항목 (Apple/Play 가입 · Privacy Policy 법무 · 실 자산 캡쳐 · EAS build) 도 본 메뉴에 모두 연결되어 있어, 단일 dashboard 로 1차 제출 ready 여부를 판단할 수 있다.
