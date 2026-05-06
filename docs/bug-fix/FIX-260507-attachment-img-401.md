# FIX-260507 — 첨부 이미지 inline 렌더 401 (노트/이슈)

- 작성일: 2026-05-07
- 작성자: Gray Kim
- 영향 범위: staging — `https://a-idol-stg.amoeba.site/project/notes`, `/project/issues`
- 관련 FR: FR-103-D / FR-104 / FR-INFRA-MEDIA (REQ-260507)
- 관련 RPT: [RPT-260507 §5 #2](../implementation/RPT-260507-project-page-redesign-and-notes.md) — "첨부 access control … staging 단계는 단순 publish, prod 전 보강" 으로 사전 식별됐으나 가드 제거를 누락

---

## 1. 증상

콘솔 로그:
```
GET https://a-idol-stg.amoeba.site/api/v1/admin/attachments/f4c70fc5-2673-4c47-b000-d1f17c9e0776
  → 401 (Unauthorized)
```

재현:
1. CMS `/project/notes` 또는 `/project/issues` 진입 (admin 로그인 상태)
2. 본문에 이미지가 포함된 노트/이슈 상세 클릭
3. 이미지 자리가 깨짐 (네트워크 탭에 401)

## 2. 원인 분석

- `RichHtmlView` 가 stored sanitized HTML 을 그대로 렌더 → DOM 에 `<img src="/api/v1/admin/attachments/UUID">` 가 들어감
- 브라우저는 `<img>`/`<script>`/`<link>` 등 정적 리소스 GET 에 **`Authorization` 헤더를 자동 부착하지 않음**
- 우리 `AdminJwtAuthGuard` 는 `Authorization: Bearer <token>` 필수 → 헤더 부재 시 401
- 결과: 본문 inline 이미지 깨짐

이는 이슈 description / 노트 body 양쪽 동일 (둘 다 같은 RichEditor + RichHtmlView 사용).

## 3. 수정 내용

### 결정
**Capability-URL 모델** 채택 — UUID(122-bit random) 자체를 capability 로 간주. POST/DELETE 는 admin/operator 인증 유지, GET 만 인증 비활성.

### 검토한 대안
| 방안 | 장점 | 단점 | 채택 여부 |
|---|---|---|---|
| **Capability-URL (UUID)** | stored HTML 변경 불필요 / 영구 유효 / 구현 단순 | URL 유출 시 누구나 read | ✅ **채택** (staging) |
| Token-in-URL (`?t=accessToken`) | TTL 만료로 자동 회수 | 15분 TTL 후 stored HTML 의 이미지 깨짐 / nginx access log 토큰 누출 | ❌ |
| Cookie-based session | 표준, 보안 우수 | 로그인 흐름 + CSRF/CORS 추가 작업 큼 | ❌ |
| 클라이언트 blob fetch | 인증 유지 | 모든 `<img>` 인터셉트 + perf 손실 + 복잡 | ❌ |

> Google Drive / Slack 의 file 공유 링크와 동일 모델. prod 적용 전 signed URL + TTL 로 강화 — RPT-260507 §5 후속 작업.

### 코드 변경
[packages/backend/src/modules/media/presentation/admin-attachments.controller.ts](../../packages/backend/src/modules/media/presentation/admin-attachments.controller.ts)

**Before** — class-level 가드로 GET/POST/DELETE 모두 Bearer 강제:
```ts
@Controller('admin/attachments')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles('admin', 'operator')
export class AdminAttachmentsController { ... }
```

**After** — class-level 제거 + 쓰기 메서드에만 가드 적용:
```ts
@Controller('admin/attachments')
@ApiBearerAuth()
export class AdminAttachmentsController {
  @Post()
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Roles('admin', 'operator')
  upload(...) { ... }

  @Get(':id')        // ← 인증 없음 (UUID capability)
  download(...) { ... }

  @Delete(':id')
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Roles('admin', 'operator')
  remove(...) { ... }
}
```

## 4. 변경 파일 목록

| 파일 | 변경 |
|---|---|
| [`packages/backend/src/modules/media/presentation/admin-attachments.controller.ts`](../../packages/backend/src/modules/media/presentation/admin-attachments.controller.ts) | class-level `@UseGuards` 제거, POST/DELETE 에 method-level 가드, GET 에는 의도된 공개 + Swagger summary 에 capability 모델 명시 |
| [`docs/bug-fix/FIX-260507-attachment-img-401.md`](./FIX-260507-attachment-img-401.md) | 본 문서 신규 |

> CMS 측 변경 없음. RichEditor 상의 이미지 렌더는 이미 정상 — 백엔드의 GET 가드만 풀면 동작.

## 5. 검증

- typecheck (4 packages) ✅
- 단위 테스트: media 모듈 4/4 pass (가드 제거가 use case 로직 영향 없음 검증)
- staging 배포 후 확인 항목:
  - `curl https://a-idol-stg.amoeba.site/api/v1/admin/attachments/<UUID>` → 200 + 이미지 바이너리
  - 노트/이슈 상세에서 inline 이미지 정상 표시
  - POST/DELETE 는 여전히 401/403 (인증 강제 유지)

## 6. 재발 방지 패턴

1. **`<img>`/`<link>` 등 정적 리소스를 위한 endpoint 는 capability-based 또는 cookie-based 인증 필요**
   — Bearer-only 적용 시 브라우저 fetch 가 실패. 신규 미디어 endpoint 도입 시 본 패턴 사전 검토 (체크리스트 추가).
2. **`@UseGuards` class-level 적용 시 GET 도 함께 잠긴다는 점 명시**
   — class-level 가드는 read/write 모두 적용됨을 PLN/RPT 단계에서 가드별로 분리 검토.
3. **bootstrap 단계의 DI 검증 + 외부 GET 검증을 e2e smoke 로 자동화**
   — 본 fix 와 직전 `MediaModule` AdminOpsModule 누락 둘 다 unit test 로 못 잡음 (bootstrap 시점에서만 발생). T-082 후속의 e2e smoke 도입 시 본 패턴 회귀 방지.
4. **prod 적용 전 capability → signed URL + TTL 강제**
   — 본 fix 는 staging 한정 임시 처방. RPT-260507 §5 후속 그대로 유효.

## 7. 배포

```bash
bash deploy/staging/deploy.sh --no-cms-build
```
(CMS 변경 없음 — backend-only 픽스)
