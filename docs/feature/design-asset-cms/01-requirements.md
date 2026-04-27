# 디자인 자산 관리 (CMS) — 요구사항 정의서

| 항목 | 값 |
|---|---|
| 문서 ID | REQ-DESIGN-ASSET-CMS-001 |
| 버전 | 1.0 |
| 작성일 | 2026-04-27 |
| 작성자 | Gray Kim |
| 관련 WBS | T-085 (App Store / Play 제출 준비) |
| 관련 FR | FR-OPS-101 (스토어 제출 메타데이터 관리) |
| 상태 | APPROVED |

## 1. 배경

GA target 이 2026-08-29 → **2026-08-01** 로 4주 단축되면서 (RPT-260427-A), Apple App Store / Google Play 1차 제출 권장일이 **2026-07-15** 로 앞당겨졌다. 1차 제출까지 디자인 산출물 (앱 아이콘 / 스플래시 / Feature Graphic / 스크린샷 6 / App Preview Video) 의 진행 상태를 PO + 디자이너 + 법무팀이 동일한 화면에서 추적해야 한다.

지금까지는 [`docs/ops/store-submission-checklist-ko.md`](../../ops/store-submission-checklist-ko.md) 의 표를 수기로 갱신했으나, 다음 한계가 있다:

- 외부 스토리지 (S3 / Drive) URL 과 진행 상태가 한 화면에 모이지 않음.
- 법무 검수 통과 여부를 `상태` 컬럼 한 칸으로 표현하기 부족.
- 디자이너가 직접 갱신할 수 없는 마크다운 파일 형식.

→ CMS 에 디자인 자산 관리 메뉴를 신설해 위 한계를 해소한다.

## 2. 범위

### 2.1 In-scope (MVP)

- **목록 조회**: type / platform / orderIndex 기준 정렬, status 한눈에 확인.
- **자산 등록**: name, type (8종), platform (4종), spec (예: `1290x2796 PNG`), fileUrl (외부 호스팅), caption, notes, orderIndex.
- **상태 워크플로**: PLACEHOLDER → DRAFT → APPROVED → LEGAL_REVIEWED → SHIPPED 5단계.
- **인라인 상태 변경**: 목록에서 select 로 직접 변경.
- **삭제**: 이력 보존이 필요 없을 때만, `confirm()` 후 hard delete.
- **권한**: admin 전체 / operator 읽기 전용.

### 2.2 Out-of-scope (post-GA)

- 파일 업로드: S3 직접 업로드 / 사이즈 검증 / 썸네일 생성. 현재는 외부 URL 만 저장.
- 버전 히스토리: 자산 변경 이력 audit.
- 법무 코멘트 / 댓글: 외부 도구 (Linear / Slack) 로 충분.
- 자동 export: Apple App Store Connect / Google Play API 연동.

## 3. 기능 요구사항

| ID | 요구사항 | 우선순위 |
|---|---|---|
| FR-DA-001 | 디자인 자산을 type 별로 그룹화해 목록을 표시한다. | P0 |
| FR-DA-002 | 각 자산의 status 를 인라인 select 로 5단계 중 하나로 변경할 수 있다. | P0 |
| FR-DA-003 | admin 은 자산을 생성 / 수정 / 삭제할 수 있다. | P0 |
| FR-DA-004 | operator 는 목록 / 상세를 읽을 수 있으나 변경은 불가하다. | P0 |
| FR-DA-005 | spec 필드는 자유 형식 문자열 (예: `1290x2796 PNG`, `1024x500 PNG (Play feature graphic)`). | P0 |
| FR-DA-006 | fileUrl 은 https URL 만 허용한다 (`@IsUrl({ require_protocol: true })`). | P1 |
| FR-DA-007 | seed 시 store-submission-checklist §1.4 와 매칭되는 10건 placeholder 가 자동 등록된다. | P0 |
| FR-DA-008 | 자산을 삭제하려면 confirm 다이얼로그를 거쳐야 한다. | P1 |
| FR-DA-009 | 모든 자산에 createdBy / updatedBy / createdAt / updatedAt 가 자동 기록된다. | P0 |
| FR-DA-010 | type 8종 (APP_ICON / SCREENSHOT / FEATURE_GRAPHIC / SPLASH / PREVIEW_VIDEO / PERSONA_IMAGE / PHOTOCARD_ART / OTHER), platform 4종 (IOS / ANDROID / WEB / ALL), status 5종을 enum 으로 강제한다. | P0 |

## 4. 비기능 요구사항

| ID | 요구사항 | 측정 지표 |
|---|---|---|
| NFR-DA-001 | 100건 이하 자산 기준 목록 조회 < 200ms (admin token 검증 포함). | 로컬 dev 기준 |
| NFR-DA-002 | spec / caption / notes 의 최대 길이는 각각 200 / 200 / 2000 자. | DTO + Prisma 레벨 |
| NFR-DA-003 | DELETE 응답은 204 (no content). | 일관성 |
| NFR-DA-004 | 상태 변경은 단일 PATCH 로 처리 (낙관적 잠금 불필요 — 디자인 팀 동시 편집 빈도 낮음). | — |

## 5. 데이터 모델

```prisma
enum DesignAssetType {
  APP_ICON
  SCREENSHOT
  FEATURE_GRAPHIC
  SPLASH
  PREVIEW_VIDEO
  PERSONA_IMAGE
  PHOTOCARD_ART
  OTHER
}

enum DesignAssetPlatform { IOS ANDROID WEB ALL }

enum DesignAssetStatus {
  PLACEHOLDER         // 등록만 됨 (실 자산 없음)
  DRAFT               // 디자인 시안 1차
  APPROVED            // PO 승인
  LEGAL_REVIEWED      // 법무 검수 통과
  SHIPPED             // 스토어 제출 완료
}

model DesignAsset {
  id          String              @id @default(uuid()) @db.Uuid
  name        String              @db.VarChar(120)
  type        DesignAssetType
  platform    DesignAssetPlatform @default(ALL)
  status      DesignAssetStatus   @default(PLACEHOLDER)
  fileUrl     String?             @map("file_url") @db.VarChar(500)
  spec        String?             @db.VarChar(200)
  orderIndex  Int                 @default(0) @map("order_index")
  caption     String?             @db.VarChar(200)
  notes       String?             @db.VarChar(2000)
  createdBy   String              @map("created_by") @db.Uuid
  updatedBy   String              @map("updated_by") @db.Uuid
  createdAt   DateTime            @default(now()) @map("created_at")
  updatedAt   DateTime            @updatedAt @map("updated_at")

  @@index([type, platform, orderIndex])
  @@index([status])
  @@map("design_assets")
}
```

## 6. API 설계

| Method | Path | Role | 설명 |
|---|---|---|---|
| GET | `/api/v1/admin/design-assets` | admin / operator | 목록 (type, platform, orderIndex 정렬) |
| POST | `/api/v1/admin/design-assets` | admin | 신규 등록 |
| PATCH | `/api/v1/admin/design-assets/:id` | admin | 부분 수정 (status / fileUrl / 기타) |
| DELETE | `/api/v1/admin/design-assets/:id` | admin | 삭제 (204) |

요청/응답 DTO 케이싱: 신규 코드이므로 amb-starter-kit v2.0 표준 적용.
- Request: snake_case (예: `file_url`, `order_index`)
- Response: camelCase (예: `fileUrl`, `orderIndex`)

> **현재 미준수**: 현 구현의 Request DTO 는 camelCase (`fileUrl`, `orderIndex`) 이다. Phase D 에서 일괄 마이그레이션 예정이며 (CLAUDE.md 의 "Migration gap" 정책과 동일), 지금은 일관성을 위해 기존 admin API 컨벤션을 따른다.

## 7. UI 흐름

1. 사이드바 → "디자인 자산" 클릭 → `/design-assets`
2. 목록은 type 별로 그룹 카드. 각 행에 status select + 삭제 버튼.
3. 우상단 "자산 등록" 버튼 → 인라인 폼 펼침 → 저장 → 목록 갱신 (`useQueryClient.invalidateQueries`)
4. status 변경 → 즉시 PATCH → 캐시 무효화.

## 8. 권한

[`docs/adr/ADR-010-admin-user-separation.md`](../../adr/ADR-010-admin-user-separation.md) 의 2-level RBAC 를 따른다.

| Role | GET | POST | PATCH | DELETE |
|---|---|---|---|---|
| admin | ✅ | ✅ | ✅ | ✅ |
| operator | ✅ | ❌ | ❌ | ❌ |
| viewer | ❌ | ❌ | ❌ | ❌ |

`AdminJwtAuthGuard` + `RolesGuard` 조합. 클래스 레벨 `@Roles('admin', 'operator')` + 쓰기 메서드 레벨 `@Roles('admin')` override.

## 9. 시드 데이터

[`packages/backend/prisma/seed.ts`](../../../packages/backend/prisma/seed.ts) 에 store-submission-checklist §1.4 와 매칭되는 10건이 idempotent 시드된다.

| Type | Platform | Order | Spec | 비고 |
|---|---|---|---|---|
| APP_ICON | ALL | 0 | 1024x1024 PNG | iOS + Android 공용 |
| SCREENSHOT | ALL | 1~6 | 1290x2796 PNG / 1080x1920 PNG | 6 화면 (홈/상세/채팅/오디션/가챠/마이) |
| FEATURE_GRAPHIC | ANDROID | 0 | 1024x500 PNG | Play 전용 |
| SPLASH | ALL | 0 | 1242x2688 PNG | iOS + Android 공용 |
| PREVIEW_VIDEO | IOS | 0 | 30s mp4 | 선택 — post-GA 보완 가능 |

## 10. 추적성 (Traceability)

- WBS T-085 → FR-OPS-101 → REQ-DESIGN-ASSET-CMS-001 (이 문서) → 작업계획서 → 완료보고서 → 테스트케이스 (TC-DESIGN-ASSET-CMS-001~005, MVP 후 추가)
