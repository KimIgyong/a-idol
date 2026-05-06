# PLN-260506-mobile-preview-deploy — 앱 미리보기(`/preview`) 미동작 수정 계획서

- 작성: 2026-05-06
- 범위: 스테이징 배포 스크립트 (`deploy/staging/deploy.sh`) 보강
- 관련 보고서: 후속 `RPT-260506-mobile-preview-deploy.md`
- 관련 커밋: `8b0865a` (CMS Vite env 주입), `d5f9fec` (CMS webroot rsync)

## 1. 현상

- URL: `https://a-idol-stg.amoeba.site/preview`
- 기대: iframe 안에 모바일(Expo Web) 앱이 노출
- 실제: iframe 안에도 **CMS 관리자 콘솔**이 다시 렌더링됨 (재귀)

## 2. 원인 분석

### 2.1 사실 확인 (스테이징 서버)

```
$ curl -s https://a-idol-stg.amoeba.site/m/ | head
<!doctype html>
<title>A-idol CMS · 관리자 콘솔</title>
<script src="/assets/index-CJQ4I9Gb.js"></script>   ← CMS 번들

$ ssh aidol@a-idol-stg.amoeba.site 'ls /var/www/a-idol-cms/'
assets
index.html

$ ls /var/www/a-idol-cms/m/
ls: cannot access '/var/www/a-idol-cms/m/': No such file or directory
```

### 2.2 원인 (3-stage chain)

1. **Mobile Expo Web 빌드 자체가 누락**.
   [deploy/staging/deploy.sh](../../deploy/staging/deploy.sh) 의 build 단계가 CMS / shared 만 빌드하고, `pnpm --filter @a-idol/mobile export:web` 을 호출하지 않음.
2. **Mobile dist 가 webroot 로 rsync 되지 않음**.
   같은 스크립트가 `packages/cms/dist/ → /var/www/a-idol-cms/` 만 동기화하고, `packages/mobile/dist/ → /var/www/a-idol-cms/m/` 단계가 없음.
3. **호스트 nginx SPA fallback** (`try_files $uri $uri/ /index.html`) 이 존재하지 않는 `/m/` 요청을 root `index.html` (= CMS) 로 폴백 → **iframe 안에 CMS 가 다시 렌더되는 재귀**.

### 2.3 비교 — `deploy-shared.sh` 는 이미 정상

[deploy/staging/deploy-shared.sh](../../deploy/staging/deploy-shared.sh) (multi-host 공용 스크립트) 에는 mobile expo web export + `/m/` rsync 가 이미 구현돼 있음 (line 70~79, 106~113).
**즉 “지식은 이미 있는데 `deploy.sh` 가 동기화 안 됐다”** 가 본질.

### 2.4 부수 원인 (이전 세션 누적)

- `deploy.sh` 가 `VITE_API_BASE_URL` 도 주입하지 않아 CMS 가 localhost API 를 호출 → 별도 커밋 `8b0865a` 로 해결됨
- `deploy.sh` 가 CMS dist 를 `/var/www/a-idol-cms/` 에 직접 sync 하지 않아 신규 CMS 비활성화 → 커밋 `d5f9fec` 로 해결됨
- **이번 작업은 동일 클래스의 마지막 누락 (mobile)** 을 정리하는 것

## 3. 해결 방안

### 옵션 비교

| # | 방안 | 장점 | 단점 | 채택 |
|---|---|---|---|---|
| A | `deploy.sh` 의 build/rsync 단계에 mobile 추가 (deploy-shared.sh 와 동일 패턴) | 최소 변경, 두 스크립트 일관성 | 두 스크립트 중복 (현 상태 유지) | ✅ |
| B | `deploy.sh` 를 폐기하고 `deploy-shared.sh` 로 통합 | 중복 제거 | 컴포즈 파일이 다름 (`docker-compose.staging.yml` vs `docker-compose.shared-host.yml`), 회귀 영향 큼 | ❌ |
| C | mobile 빌드를 docker 안으로 이동 | 로컬 의존성 제거 | Expo CLI + metro 가 docker 안에서 무겁게 돌아 빌드 시간 폭증, RN deps 캐시 무효화 자주 발생 | ❌ |

→ **옵션 A 채택**. 옵션 B 는 별도 후속 정리 과제 (현 시점 범위 외).

## 4. 작업 항목 (Task)

| ID | Task | 파일 | 의존성 |
|---|---|---|---|
| T-1 | `deploy.sh` build 단계에 `pnpm --filter @a-idol/mobile export:web` 추가 (env: `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_APP_ENV`) | `deploy/staging/deploy.sh` | — |
| T-2 | `deploy.sh` rsync 단계에 `packages/mobile/dist/ → ${CMS_WEBROOT}/m/` 추가 (`CMS_WEBROOT` 기본 `/var/www/a-idol-cms`) | `deploy/staging/deploy.sh` | T-1 |
| T-3 | `--no-cms-build` 옵션과 동일 분기 안에서 mobile 빌드도 함께 skip 되도록 가드 | `deploy/staging/deploy.sh` | T-1 |
| T-4 | 스테이징 재배포 후 `/m/`, `/m/_expo/static/...` 자산 정상 응답, `/preview` 시각 확인 | (배포) | T-1~3 |
| T-5 | 작업 완료 보고서 `RPT-260506-mobile-preview-deploy.md` 작성 | `docs/implementation/` | T-4 |

## 5. 변경 파일 (예상)

- `deploy/staging/deploy.sh` — +18 / -2 line 정도 (mobile build + rsync 블록)

## 6. 화면 구성안 — 변경 없음

UI / API / DB 변경 없음. 인프라만 보정.

```
[현재]
  CMS /preview  ─iframe src="/m/…"─►  /m/ 경로 GET
                                         │
                                         ▼
                            host nginx SPA fallback
                                         │
                                         ▼
                          /var/www/a-idol-cms/index.html ← (CMS) ❌

[수정 후]
  CMS /preview  ─iframe src="/m/…"─►  /m/ 경로 GET
                                         │
                                         ▼
                          /var/www/a-idol-cms/m/index.html ← (Expo Web) ✅
```

## 7. 리스크 / 영향

| 리스크 | 평가 | 완화 |
|---|---|---|
| Mobile expo export 가 로컬 환경에서 실패 (RN 네이티브 deps) | 중 | `deploy-shared.sh` 가 동일 명령으로 이미 동작 중. 사전 `pnpm --filter @a-idol/mobile export:web` 1회 검증. |
| 빌드 시간 +30~60s | 저 | 수용 가능 (배포 빈도 낮음). `--no-cms-build` 시 함께 skip. |
| `/m/` 자산 캐시 (CDN/브라우저) | 저 | hashed 파일명. `index.html` 만 강력 새로고침 안내. |
| 호스트 nginx 변경 필요 여부 | 저 | 불필요 (`try_files $uri $uri/ /index.html` 가 디렉토리 존재 시 우선 매치). |

## 8. 테스트 케이스 (간략 — Manual / E2E)

| ID | 시나리오 | 기대 |
|---|---|---|
| TC-1 | 배포 후 `curl -I https://a-idol-stg.amoeba.site/m/` | `200`, `content-type: text/html`, body 안에 `expo` / `_expo/static` 참조 존재 |
| TC-2 | 배포 후 `curl -I https://a-idol-stg.amoeba.site/m/_expo/static/js/web/<hash>.js` (index.html 에서 추출한 첫 번째 청크) | `200`, `content-type: application/javascript` |
| TC-3 | 브라우저에서 `https://a-idol-stg.amoeba.site/preview` 접속 → 새로고침 | iframe 내에 모바일 앱 home 화면 노출 (CMS 가 아님) |
| TC-4 | `/preview` 좌측 PRESETS → "오디션 목록" 선택 | iframe URL 이 `/m/auditions` 로 변경되고 해당 화면 노출 |
| TC-5 | `--no-cms-build` 플래그 배포 | mobile 빌드도 skip, 기존 `/m/` 정적 자산 그대로 유지 (회귀 없음) |

## 9. 진행 중단점

- 본 계획 검토 후 **사용자 승인 받은 뒤** T-1~T-5 진행.

## 10. 후속 (out-of-scope)

- `deploy.sh` ↔ `deploy-shared.sh` 통합 (옵션 B) — 별도 ADR + WBS 아이템으로 추후 진행.
- CMS preview 페이지에 “mobile 빌드 버전 / git SHA” 헤더 노출 — 추적성 향상 (선택).
