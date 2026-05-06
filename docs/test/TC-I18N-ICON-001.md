# TC-I18N-ICON-001 — CMS/Mobile i18n + Mobile 단색 외곽선 아이콘

| 항목 | 내용 |
|---|---|
| 문서 ID | TC-I18N-ICON-001 |
| 작성일 | 2026-05-02 |
| 대상 REQ | REQ-CMS-I18N-001, REQ-MOBILE-I18N-ICON-001 |
| 대상 PLAN | PLAN-CMS-MOBILE-I18N-001 |

## 1. 범위

- CMS / Mobile 의 i18n 기반(라이브러리 init, locale 4개, namespace 2개, 언어 전환 영속화)
- Mobile 탭바 아이콘이 Feather 단색 외곽선으로 교체되었는지

## 2. 매트릭스 (AC ↔ TC)

| REQ AC | TC ID | 분류 | 우선순위 |
|---|---|---|---|
| CMS AC-1 (init 정상) | TC-001 | Unit | P0 |
| CMS AC-2 (NavLink t() 적용) | TC-002 | Manual | P0 |
| CMS AC-3 (LanguageSwitcher 4 옵션) | TC-003 | Manual | P0 |
| CMS AC-4 (전환 즉시 반영 + localStorage) | TC-004 | Manual | P0 |
| CMS AC-5 (4 locale 키 누락 0) | TC-005 | Unit | P0 |
| CMS AC-6 (typecheck 통과) | TC-006 | Build | P0 |
| Mobile AC-1 (OS 언어 자동 감지) | TC-101 | Manual | P0 |
| Mobile AC-2 (Picker 즉시 반영) | TC-102 | Manual | P0 |
| Mobile AC-3 (재시작 후 영속) | TC-103 | Manual | P1 |
| Mobile AC-4 (탭바 외곽선 단색) | TC-104 | Manual | P0 |
| Mobile AC-5 (4 locale 키 누락 0) | TC-105 | Unit | P0 |
| Mobile AC-6 (typecheck 통과) | TC-106 | Build | P0 |

## 3. 케이스 상세

### TC-001 — CMS i18n 인스턴스 초기화
- 전제: `packages/cms` 빌드 완료
- 입력: `import i18n from '@/i18n/i18n'; i18n.isInitialized`
- 기대: `true`, `i18n.languages` 가 4개 코드 포함, default `ko`

### TC-002 — CMS NavLink 라벨 i18n 표시
- 전제: 로그인 후 AppShell 마운트
- 절차: 사이드바의 12개 NavLink 라벨 확인
- 기대: 한국어 기본 → "대시보드 / 아이돌 관리 / …", 한글 하드코딩 0건. lucide outline 아이콘 함께 표시.

### TC-003 — LanguageSwitcher 옵션 노출
- 전제: AppShell 사이드바 하단
- 기대: select 에 4개 옵션 (한국어, English, Tiếng Việt, 简体中文), Globe outline 아이콘.

### TC-004 — 언어 전환 즉시 반영 + 영속화
- 절차: select → English 선택 → 페이지 이동 → 새로고침
- 기대:
  - 즉시: NavLink 라벨이 영어로 변경 ("Dashboard / Idols / …")
  - 새로고침 후: 영어 유지 (`localStorage['a-idol.cms.lang'] === 'en'`)

### TC-005 — CMS locale 키 누락 검사 (자동)
- 명령: `node -e "const k=Object.keys; const ko=require('./packages/cms/src/i18n/ko/nav.json'); for (const l of ['en','vi','zh-CN']){ const o=require('./packages/cms/src/i18n/'+l+'/nav.json'); for(const x of k(ko)) if(!(x in o)) {console.error(l,x); process.exit(1)}}"`
- 기대: exit 0

### TC-006 — CMS typecheck
- 명령: `pnpm --filter @a-idol/cms typecheck`
- 기대: exit 0, 에러 0

### TC-101 — Mobile OS 언어 감지 (Web preview)
- 전제: 브라우저 언어 = 한국어, AsyncStorage 빈 상태
- 절차: `pnpm --filter @a-idol/mobile web` → splash 통과 후 탭바 확인
- 기대: 라벨 "홈/오디션/상점/프로필"

### TC-102 — Mobile 언어 Picker 즉시 반영
- 절차: `me/settings` 진입 → "English" 탭 → 뒤로 → 탭바 확인
- 기대: 탭바 라벨 즉시 "Home/Auditions/Shop/Profile"

### TC-103 — Mobile 영속화
- 절차: TC-102 후 앱 reload
- 기대: 영어 유지 (AsyncStorage `a-idol.mobile.lang === 'en'`)

### TC-104 — Mobile 탭바 외곽선 단색
- 절차: 탭바 시각 검사
- 기대:
  - 4개 아이콘 모두 Feather outline (home / award / shopping-bag / user)
  - 이모지 0건
  - focused 시 stroke = `colors.accent`, unfocused 시 stroke = `colors.text2`
  - 채움 / 그림자 / 멀티톤 0

### TC-105 — Mobile locale 키 누락 검사 (자동)
- 명령: `node -e "const k=Object.keys; const ko=require('./packages/mobile/src/i18n/ko/nav.json'); for (const l of ['en','vi','zh-CN']){ const o=require('./packages/mobile/src/i18n/'+l+'/nav.json'); for(const x of k(ko)) if(!(x in o)) {console.error(l,x); process.exit(1)}}"`
- 기대: exit 0

### TC-106 — Mobile typecheck
- 명령: `pnpm --filter @a-idol/mobile typecheck`
- 기대: exit 0

## 4. 회귀 영향 검사

- R-1: `AppShell` 로그아웃 버튼 동작 정상
- R-2: `me/settings` 의 테마 5종 전환 정상
- R-3: Splash → 라우팅 (인증/비인증 분기) 정상
