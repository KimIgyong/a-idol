# RPT-260502 — CMS/Mobile i18n + Mobile 단색 외곽선 아이콘

| 항목 | 내용 |
|---|---|
| 보고일 | 2026-05-02 |
| 대상 REQ | REQ-CMS-I18N-001, REQ-MOBILE-I18N-ICON-001 |
| PLAN | PLAN-CMS-MOBILE-I18N-001 |
| TC | [TC-I18N-ICON-001](../test/TC-I18N-ICON-001.md) |
| 상태 | ✅ 자동 검증 통과 (Manual TC 는 사용자 검증 필요) |

## 1. 변경 요약

### CMS (`packages/cms`)
- 의존성 추가: `i18next@^23`, `react-i18next@^14`, `i18next-browser-languagedetector@^7`
- 신규 파일:
  - [src/i18n/i18n.ts](../../packages/cms/src/i18n/i18n.ts)
  - [src/i18n/{ko,en,vi,zh-CN}/{common,nav}.json](../../packages/cms/src/i18n) (8개)
  - [src/components/language-switcher.tsx](../../packages/cms/src/components/language-switcher.tsx)
- 수정:
  - [src/main.tsx](../../packages/cms/src/main.tsx) — i18n side-effect import + ErrorBoundary fallback 영문화
  - [src/components/layout/app-shell.tsx](../../packages/cms/src/components/layout/app-shell.tsx) — NAV 항목 `label` → `labelKey` + `t()` 적용, LanguageSwitcher 마운트, 로그아웃/로딩/타이틀 i18n 화

### Mobile (`packages/mobile`)
- 의존성 추가 (expo install): `i18next@^23`, `react-i18next@^14`, `expo-localization@~15.0.3`, `@expo/vector-icons@^14.0.3`
- 신규 파일:
  - [src/i18n/i18n.ts](../../packages/mobile/src/i18n/i18n.ts) — `expo-localization` OS 감지 + AsyncStorage 영속화 + `zh-Hans` 정규화 + 비동기 `initI18n()`
  - [src/i18n/{ko,en,vi,zh-CN}/{common,nav}.json](../../packages/mobile/src/i18n) (8개)
- 수정:
  - [app/_layout.tsx](../../packages/mobile/app/_layout.tsx) — `i18nReady` 게이트 추가, splash 텍스트 t() 화
  - [app/(app)/_layout.tsx](../../packages/mobile/app/(app)/_layout.tsx) — **이모지 → Feather 단색 외곽선** (home/award/shopping-bag/user), 라벨 t()
  - [app/(app)/me/settings.tsx](../../packages/mobile/app/(app)/me/settings.tsx) — 언어 선택 inline 리스트 (4개) 추가

### 메모리/문서
- `/memories/aidol-conventions.md` — i18n 양쪽 적용 규칙 + Mobile 단색 외곽선 아이콘 규칙 명문화
- `/memories/amb-workflow-rules.md` — 6단계 표준 진행 순서 (분석 → REQ → PLAN → TC → 구현 → 테스트+보고서) 추가
- 신규: [docs/test/TC-I18N-ICON-001.md](../test/TC-I18N-ICON-001.md)

## 2. 테스트 실행 결과

| TC ID | 분류 | 결과 | 비고 |
|---|---|---|---|
| TC-005 (CMS locale 키 parity) | Auto | ✅ PASS | 4 locale × common+nav 키 누락 0 |
| TC-006 (CMS typecheck) | Build | ✅ PASS | tsc 에러 0 |
| TC-105 (Mobile locale 키 parity) | Auto | ✅ PASS | 4 locale × common+nav 키 누락 0 |
| TC-106 (Mobile typecheck) | Build | ✅ PASS | tsc 에러 0 |
| CMS lint | Build | ⚠ WARN | 경고 2건 (모두 본 작업과 무관한 react-refresh 경고, pre-existing) |
| TC-001~004 (CMS Manual) | Manual | ⏸ 사용자 검증 대기 | 로컬 CMS 띄워서 사이드바/스위처 확인 |
| TC-101~104 (Mobile Manual) | Manual | ⏸ 사용자 검증 대기 | Expo web (localhost:8081) 또는 디바이스 |

### 자동 검증 명령 (재현용)
```bash
# 키 parity
pnpm --filter @a-idol/cms typecheck
pnpm --filter @a-idol/mobile typecheck
node -e "const k=Object.keys; const ko=require('./packages/cms/src/i18n/ko/nav.json'); …"  # TC-005/105
```

## 3. 회귀 영향 분석

| 영역 | 영향 | 평가 |
|---|---|---|
| CMS 로그인/로그아웃 | 로그아웃 버튼 텍스트만 t() 경유 | 동작 동일, 텍스트만 locale 별 |
| CMS 라우터 | 변경 없음 | 영향 없음 |
| Mobile splash → 라우팅 | `i18nReady` 게이트 추가로 splash 가 i18n init 까지 대기 (기존 1s 최소 노출과 병렬) | 첫 부팅 지연 < 100ms 예상 |
| Mobile 테마 5종 전환 | settings 화면에 언어 섹션이 위쪽에 추가됨, 테마 섹션 그대로 | 기능 영향 없음 |
| Mobile 탭바 시각 | 이모지 → outline 아이콘 (사용자 가시 변화) | 디자인 의도 부합 |
| Mobile 번들 크기 | `@expo/vector-icons` (~80KB Feather subset) + i18n 자산 (~10KB) | OTA < 100KB 증가, NFR 통과 |

## 4. 후속 작업 / 알려진 한계

| 항목 | 비고 |
|---|---|
| **L-1**: 본 sprint 는 탭바 4개 라벨만 i18n 화. 71+ 한국어 하드코딩 문자열 잔존 | 화면 단위 hard-cutover 별도 sprint |
| **L-2**: 탭 외 영역(헤더/버튼/카드)의 이모지/컬러 아이콘 잔존 | 별도 sprint, ESLint 규칙 도입 검토 |
| **L-3**: `zh-TW` / `zh-HK` 는 `ko` fallback | 별도 ADR 후 `zh-TW` 추가 검토 |
| **L-4**: CMS 의 ErrorBoundary fallback 영문 하드코딩 | i18n init 전에 발생 가능한 fallback 이라 의도적 영문 처리 |
| **L-5**: Mobile splash 텍스트는 i18nReady 직전까지 한국어 하드코딩 fallback | i18n init 의 chicken-and-egg 문제 |
| **L-6**: 신규 namespace (`fandom`, `chat`, `commerce`, `audition`) 미생성 | 화면 마이그레이션 시 생성 |

## 5. 메모리/문서 갱신

- ✅ `/memories/aidol-conventions.md`
- ✅ `/memories/amb-workflow-rules.md`
- ✅ `docs/test/TC-I18N-ICON-001.md`
- ✅ `docs/report/RPT_260502_i18n-icon.md` (본 문서)

## 6. 사용자 액션 권장

1. CMS 로컬 띄워 TC-002~004 수동 검증 (사이드바 12개 라벨, LanguageSwitcher, 새로고침 후 영속화)
2. Mobile Expo web 띄워 TC-101~104 수동 검증 (탭바 outline 아이콘, settings 언어 picker, AsyncStorage 영속화)
3. 이상 없으면 commit:
   ```
   feat(cms,mobile): introduce i18n base (ko/en/vi/zh-CN) + replace mobile tab emoji with outline icons
   ```
