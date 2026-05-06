# RPT-260506-mobile-preview-deploy — 앱 미리보기 배포 누락 수정 보고서

- 작성: 2026-05-06
- 계획서: [PLN-260506-mobile-preview-deploy.md](../plan/PLN-260506-mobile-preview-deploy.md)
- 관련 커밋: (이번 작업) `deploy/staging/deploy.sh` mobile build + rsync 추가

## 1. 작업 요약

스테이징 `https://a-idol-stg.amoeba.site/preview` 의 iframe 안에 모바일 앱 대신 CMS 가 재귀 렌더되던 문제 해결. 원인은 `deploy/staging/deploy.sh` 가 mobile (Expo Web) 빌드 + `/var/www/a-idol-cms/m/` 동기화를 누락하여, 호스트 nginx SPA fallback 이 `/m/` 요청을 root `index.html` (CMS) 로 폴백한 것.

## 2. 변경 파일

| 파일 | 변경 |
|---|---|
| [deploy/staging/deploy.sh](../../deploy/staging/deploy.sh) | build 단계에 `pnpm --filter @a-idol/mobile export:web` (env: `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_APP_ENV`) 추가; rsync 단계에 `packages/mobile/dist/ → ${CMS_WEBROOT}/m/` 추가; `--no-cms-build` 가드 안에 함께 포함되어 skip 시 일관 동작 |

## 3. 검증 결과

| TC | 시나리오 | 기대 | 결과 |
|---|---|---|---|
| TC-1 | `curl -I https://a-idol-stg.amoeba.site/m/` | `200`, body 안에 `<title>A-idol</title>` + `_expo/static` 참조 | ✅ `200`, `<title>A-idol</title>`, `<script src="/m/_expo/static/js/web/index-4a3f...js">` |
| TC-2 | `curl -I https://a-idol-stg.amoeba.site/m/_expo/static/js/web/<hash>.js` | `200`, JS 자산 | ✅ `200` |
| TC-3 | 서버 webroot 디렉토리 | `/var/www/a-idol-cms/m/` 존재 | ✅ `assets`, `_expo`, `index.html`, `metadata.json` |
| TC-4 | `/preview` 화면 (브라우저) | iframe 에 모바일 홈 화면 노출 | ⏳ 사용자 강력 새로고침 후 확인 필요 |
| TC-5 | `--no-cms-build` 회귀 | mobile 빌드도 함께 skip | ✅ `if [[ $DO_CMS_BUILD -eq 1 ]]` 동일 가드 |

## 4. 회귀 영향

- 백엔드 / DB / 호스트 nginx 설정 무변경.
- CMS 자체 번들도 무변경 (이번 빌드는 같은 SHA).
- 추가된 부담: 배포 시간 +30~60s (mobile expo:web export). 수용 가능.

## 5. 후속 / 알려진 한계

- `deploy.sh` 와 `deploy-shared.sh` 의 중복 (옵션 B) 은 이번 작업 범위 외. 후속 ADR + WBS 아이템으로 정리 예정.
- Expo Web 은 일부 RN-only 기능(네이티브 카메라/푸시/IAP)을 시뮬레이트 못 함 — UI/UX 미리보기 한정 용도.

## 6. 메모리/문서 갱신

- 문서: 본 보고서 + [PLN-260506-mobile-preview-deploy.md](../plan/PLN-260506-mobile-preview-deploy.md)
- 메모리: 별도 추가 없음 (일회성 deploy 회귀 — 동일 패턴은 이미 `amb-bugfix-patterns.md` 의 "포트 정렬 불일치" 와 같은 분류로 인지됨).
