# 디자인 자산 관리 (CMS) — 작업 계획서

| 항목 | 값 |
|---|---|
| 문서 ID | PLAN-DESIGN-ASSET-CMS-001 |
| 버전 | 1.0 |
| 작성일 | 2026-04-27 |
| 작성자 | Gray Kim |
| 선행 문서 | [`01-requirements.md`](./01-requirements.md) |
| 후행 문서 | [`03-completion-report.md`](./03-completion-report.md) |
| 관련 WBS | T-085 (App Store / Play 제출 준비) — 30% → 45% |

## 1. 목표

요구사항 정의서의 **FR-DA-001~010 + NFR-DA-001~004** 를 단일 sprint (1일) 안에 구현하고, end-to-end 검증까지 마친다.

## 2. 작업 분해 (4-layer Clean Architecture 순)

| # | Task | Layer | 산출물 | 예상 시간 |
|---|---|---|---|---|
| 1 | Prisma schema + 마이그레이션 | DB | `schema.prisma` enum 3개 + DesignAsset model + `20260427110000_design_assets/migration.sql` | 30m |
| 2 | Shared DTO 정의 | Shared | `packages/shared/src/contracts/index.ts` 의 `DesignAssetType` / `DesignAssetPlatform` / `DesignAssetStatus` / `DesignAssetDto` / `CreateDesignAssetDto` / `UpdateDesignAssetDto` | 15m |
| 3 | Application 포트 + 유스케이스 | Application | `application/interfaces.ts` + `application/design-asset.usecases.ts` (List / Create / Update / Delete) | 30m |
| 4 | Prisma 어댑터 | Infrastructure | `infrastructure/prisma-design-asset.repository.ts` | 20m |
| 5 | Presentation 컨트롤러 + DTO + Mapper | Presentation | `presentation/admin-design-assets.controller.ts` + `dto/design-asset.dto.ts` (class-validator) | 30m |
| 6 | NestJS 모듈 + AppModule wiring | Presentation | `design-assets.module.ts` + `app.module.ts` import | 10m |
| 7 | Shared CMS API client | CMS | `lib/admin-api.ts` 4 메서드 (list / create / update / delete) | 10m |
| 8 | CMS 페이지 | CMS | `features/design-assets/design-assets-page.tsx` (목록 + 그룹 + 등록 폼 + 인라인 status 변경 + 삭제) | 60m |
| 9 | 사이드바 NAV + 라우터 | CMS | `app/router.tsx` + `components/layout/app-shell.tsx` (Palette icon) | 10m |
| 10 | Seed 10건 placeholder | DB | `prisma/seed.ts` (idempotent — `stableUuidFor`) | 30m |
| 11 | E2E 검증 | QA | curl POST/GET/PATCH/DELETE + CMS 화면 수동 확인 | 20m |
| 12 | 문서 갱신 | Docs | runbook / WBS T-085 30%→45% / 본 작업의 3종 문서 (요구/계획/완료) | 30m |
|   | **합계** |   |   | **5시간** |

## 3. 의존성 그래프

```
[1 schema] → [2 shared DTO] → [3 application] → [4 infra]
                                       ↓
                         [5 presentation] ← [6 module wire]
                                       ↓
                              [7 CMS api] → [8 CMS page] → [9 NAV]
                                       ↓
                             [10 seed] → [11 E2E] → [12 docs]
```

## 4. 리스크 + 대응

| ID | 리스크 | 영향 | 가능성 | 대응 |
|---|---|---|---|---|
| R-001 | Prisma schema validation 실패 (`/** */` JSDoc 사용 시) | 마이그레이션 실패 | 中 | Prisma 의 documentation comment 는 `///` triple-slash 만 허용. 발생 시 즉시 변환. |
| R-002 | 시드 idempotency 미보장 → 재실행 시 중복 행 | 데이터 오염 | 中 | `stableUuidFor(SHA-256 → RFC 4122 v4)` 로 결정적 UUID + `upsert` 사용. |
| R-003 | RBAC 누락 → operator 가 PATCH/DELETE 가능 | 권한 침해 | 低 | 클래스 `@Roles('admin','operator')` + 쓰기 메서드별 `@Roles('admin')` override + ITC 추후 추가 (TC-ADMIN-DESIGN-ASSETS-AUTHZ). |
| R-004 | DTO 케이싱 컨벤션 (snake_case 신규 표준) 와 기존 admin API (camelCase) 충돌 | 일관성 손상 | 中 | CLAUDE.md "Migration gap" 정책 명시 — Phase D 일괄 마이그레이션. 본 작업은 기존 admin API 컨벤션 유지. |
| R-005 | seed.ts 가 stableUuidFor 정의 전에 호출 → ReferenceError | 시드 실패 | 高 | 헬퍼 함수를 파일 상단에 선언. |

## 5. 인수 기준 (Acceptance Criteria)

- [ ] AC-1: `pnpm seed` 가 10건 placeholder 를 시드한다 (재실행 시 중복 없음).
- [ ] AC-2: admin 토큰으로 `GET /api/v1/admin/design-assets` → 200 + 10 행.
- [ ] AC-3: operator 토큰으로 `GET /api/v1/admin/design-assets` → 200 / `POST` / `PATCH` / `DELETE` → 403.
- [ ] AC-4: 인증 없는 `GET /api/v1/admin/design-assets` → 401.
- [ ] AC-5: `PATCH /api/v1/admin/design-assets/:id` `{status:"DRAFT"}` 가 인라인 status select 를 통해 동작.
- [ ] AC-6: CMS `/design-assets` 화면이 type 별로 자산을 그룹핑해 표시.
- [ ] AC-7: WBS T-085 의 진행률이 30% → 45% 로 갱신.
- [ ] AC-8: runbook-ko.md 에 본 작업이 2026-04-27 dated entry 로 기록.

## 6. 일정

| Phase | 시작 | 종료 | 산출물 |
|---|---|---|---|
| 설계 + 스키마 | 2026-04-27 11:00 | 11:30 | schema, migration |
| 백엔드 구현 | 2026-04-27 11:30 | 13:30 | shared DTO, module 4-layer, NestJS wiring |
| CMS 구현 | 2026-04-27 13:30 | 14:30 | API client, page, NAV |
| 시드 + E2E | 2026-04-27 14:30 | 15:30 | seed.ts, curl smoke, CMS 수동 확인 |
| 문서화 | 2026-04-27 15:30 | 16:00 | runbook + WBS + 3종 문서 |

총 소요 시간 ~5h, 단일 contributor.

## 7. 후속 작업 (이번 sprint 범위 외)

- TC-ADMIN-DESIGN-ASSETS-AUTHZ ITC 4건 추가 (T-084 진행 중인 RBAC ITC 시리즈와 동일 패턴).
- 실 자산 캡쳐 → 디자이너가 fileUrl 채우기.
- 법무 검수 통과 후 LEGAL_REVIEWED 상태로 일괄 전환 (개별 PATCH 또는 추후 bulk 엔드포인트).
- post-GA: S3 직접 업로드 + 썸네일 + 이력 audit 추가 (별도 ADR 필요).
