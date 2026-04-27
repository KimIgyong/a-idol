# [RPT-260426-C] 모바일 와이어프레임 v2 반영 — 작업 계획서

## Report Metadata

| 항목 | 값 |
|---|---|
| **리포트 ID** | RPT-260426-C |
| **제목** | A-idol Mobile Wireframes v2 → packages/mobile 반영 작업 계획 |
| **작성일** | 2026-04-26 |
| **작성자** | Gray Kim <gray.kim@amoeba.group> |
| **분류** | 구현 계획 (Implementation Plan) |
| **소스 wireframe** | [`docs/reference/A-idol Mobile Wireframes v2 _standalone_.html`](../reference/A-idol%20Mobile%20Wireframes%20v2%20_standalone_.html) (~950 KB, 25 screens, 5 themes) |
| **현재 모바일** | [`packages/mobile`](../../packages/mobile) — Expo SDK 51, expo-router 3.5, 10 screens |
| **관련 문서** | [RPT-260425 mid-progress](./RPT_260425_phase-c-mid-progress.md), [RPT-260426-B admin audit](./RPT_260426_admin-menu-audit.md), [a-idol-ui-spec.md](../reference/a-idol-ui-spec.md) |

---

## 1. Executive Summary

와이어프레임 v2는 **25 화면 + 5 테마(blue/white/dark/pink/purple)** 풀
디자인 토큰 시스템을 정의. 현재 packages/mobile은 **10 화면 + 단일 hardcoded
테마** 상태 — 매핑 시 **15 화면 신설/확장 + 디자인 토큰 풀 재구성** 필요.

5 phase로 분할 권고 (총 추정 ~12-16 작업일):

| Phase | 핵심 산출물 | 추정 | Phase D 진입 의존도 |
|---|---|---|---|
| **P0** 디자인 토큰 + 5 테마 인프라 | `theme/tokens.ts` + ThemeProvider + 설정 화면 | 2일 | ✅ 모든 Phase 선결 |
| **P1** Auth 흐름 보강 | Splash · 추가 정보 · 로그인 UI 리디자인 | 1.5일 | M5 GA 의존 |
| **P2** 홈 피드 + 아이돌 상세 | view-mode 토글 · 좌우 스와이프 · 응원댓글 | 3일 | T-046 IAP 독립 |
| **P3** 오디션/포토카드 분기 | 대시보드/진행중/지난 분리 · 가챠/컬렉션 분리 | 3일 | T-064 (vote 흐름) 의존 |
| **P4** 마이페이지 sub-routes | 구매/구독/투표/찜/설정 5 sub | 2.5일 | M5 stabilization |

**권고 첫 슬라이스**: **P0 디자인 토큰 + 5 테마 시스템 + 설정 화면 (SCR-025)** — 이후
모든 Phase가 해당 token 위에 빌드되므로 가장 먼저 락. 단독 PR 가능 (~2일).

---

## 2. Wireframe 25 화면 인벤토리

| ID | 화면명 | Tab | 핵심 features (와이어프레임 라벨) |
|---|---|---|---|
| SCR-001 | 스플래시 | 01 | 앱 실행 2초, gradient bg |
| SCR-002 | 로그인 | 02 | Email + Google/Apple/Facebook |
| SCR-003 | 회원가입 | 03 | Email |
| SCR-004 | 추가 정보 | 04 | 최초 로그인시 수집 (생년월일/닉네임 등) |
| SCR-005 | 홈 피드 | 05 | **2열 / 1열 / 목록 보기 전환** (3 view modes) |
| SCR-006 | 아이돌 상세 | 06 | **좌우 스와이프 / 카드/목록 / 응원댓글** |
| SCR-009 | 채팅 | 07 | 이모지 패널 + 스티커 |
| SCR-010 | 오디션 대시보드 | 08 | 메인 허브 |
| SCR-011 | 진행중 오디션 | 09 | round 상세 + 투표 |
| SCR-012 | 지난 오디션 상세 | 10 | 1~10회차 공통 템플릿 |
| SCR-017 | 포토카드 뽑기 | 11 | 단일 아티스트, gacha 애니메이션 |
| SCR-018 | 포토카드 전체 목록 | 12 | 컬렉션 뷰 |
| SCR-020 | 마이페이지 | 13 | 허브 (sub-route 5개로 fan-out) |
| SCR-021 | 구매 포토카드 목록 | 14 | 마이 sub |
| SCR-022 | 구독 정보 | 15 | 마이 sub |
| SCR-023 | 투표 이력 | 16 | 마이 sub |
| SCR-024 | 찜한 아티스트 | 17 | 마이 sub (= /me/follows + /me/hearts) |
| SCR-025 | 설정 | 18 | **5가지 테마 전환** + 알림/푸시 |

> 와이어프레임은 SCR-007/008/013~016/019 등 일부 ID를 건너뜀 — v1에서 사라진
> 화면이거나 와이어프레임 v2 기준 재번호. 본 계획서는 **존재하는 18 tab**
> 만 다룸.

---

## 3. 현재 모바일 vs Wireframe 매핑

| Wireframe | 현재 RN 파일 | 격차 |
|---|---|---|
| SCR-001 스플래시 | (Expo splash 기본만) | **신설** — 2초 디스플레이 + 인증 상태 분기 |
| SCR-002 로그인 | [`app/(auth)/login.tsx`](../../packages/mobile/app/(auth)/login.tsx) | UI 리디자인 + Google/Apple/Facebook OAuth 버튼 placeholder (백엔드 미구현 → UI만) |
| SCR-003 회원가입 | [`app/(auth)/signup.tsx`](../../packages/mobile/app/(auth)/signup.tsx) | UI 리디자인 (필드는 동일) |
| SCR-004 추가 정보 | (없음) | **신설** — 최초 로그인 후 추가 수집 (현재는 가입 시 모두 수집) |
| SCR-005 홈 피드 | [`app/(app)/index.tsx`](../../packages/mobile/app/(app)/index.tsx) | view-mode 3종(2열/1열/목록) 토글 추가 |
| SCR-006 아이돌 상세 | [`app/(app)/idol/[id].tsx`](../../packages/mobile/app/(app)/idol/[id].tsx) | **재구성** — 좌우 스와이프(adjacent idol prev/next) + 응원댓글 |
| SCR-009 채팅 | [`app/(app)/chat/[idolId].tsx`](../../packages/mobile/app/(app)/chat/[idolId].tsx) | 이모지 패널 + 스티커 추가 |
| SCR-010 오디션 대시보드 | (없음 — 현재 `auditions/index.tsx`가 list만) | **신설** — `/auditions` route를 대시보드로 재구성 |
| SCR-011 진행중 오디션 | [`app/(app)/auditions/[id].tsx`](../../packages/mobile/app/(app)/auditions/[id].tsx) | UI 리디자인 |
| SCR-012 지난 오디션 | (없음) | **신설** — `/auditions/past` 또는 status 필터 |
| SCR-017 포토카드 뽑기 | (`shop.tsx`에 부분) | **분리 신설** — 별도 `/gacha/[setId]` route |
| SCR-018 포토카드 전체 | [`app/(app)/collection.tsx`](../../packages/mobile/app/(app)/collection.tsx) | UI 리디자인 |
| SCR-020 마이페이지 | [`app/(app)/profile.tsx`](../../packages/mobile/app/(app)/profile.tsx) | 허브 형태로 재구성 (5 sub 진입점) |
| SCR-021 구매 포토카드 | (없음) | **신설** — `/me/photocards` |
| SCR-022 구독 정보 | (없음) | **신설** — `/me/memberships` (이미 backend `useMyMemberships` 가능) |
| SCR-023 투표 이력 | (없음) | **신설** — `/me/votes` (backend 미구현, audit log 필요) |
| SCR-024 찜한 아티스트 | (없음) | **신설** — `/me/follows` + `/me/hearts` (`useMyHearts/useMyFollows` 이미 구현) |
| SCR-025 설정 | (없음) | **신설** — `/me/settings` + 5 테마 전환 |

---

## 4. 디자인 토큰 마이그레이션 전략

### 4.1 와이어프레임이 정의한 토큰 (CSS custom properties → RN Theme)

| Group | CSS var | RN type | 5 테마 차이 |
|---|---|---|---|
| Background | `--bg`, `--surface`, `--elevated`, `--page-bg` | `colors.bg/surface/elevated/pageBg` | 모든 테마 다름 |
| Accent | `--accent`, `--accent-lt`, `--accent-dk`, `--accent-sk`, `--accent2` | `colors.accent/accentLt/accentDk/accentSk/accent2` | 테마별 정체성 |
| Text | `--text1`, `--text2`, `--text3` | `colors.text1/text2/text3` | hierarchy 동일, hue 차이 |
| Border | `--border`, `--border-md` | `colors.border/borderMd` | rgba opacity |
| Status | `--success`, `--danger` | `colors.success/danger` | 모든 테마 동일 (의미 색) |

### 4.2 5 테마 값 (와이어프레임 추출)

| 테마 | accent | bg | text1 | 비고 |
|---|---|---|---|---|
| **blue** (default) | #2563EB | #FFFFFF | #0B1220 | 기본 |
| **white** | #111111 | #FFFFFF | #0B0B0B | 모노톤 |
| **dark** | #60A5FA | #0F141F | #F3F6FC | 다크모드 |
| **pink** | #EC4899 | #FFFFFF | #1F0B17 | 핑크 |
| **purple** | #8B5CF6 | #FFFFFF | #180B28 | 퍼플 |

### 4.3 구현 형태 (RN)

```ts
// packages/mobile/src/theme/tokens.ts (P0 신설)
export type ThemeName = 'blue' | 'white' | 'dark' | 'pink' | 'purple';

export const themes: Record<ThemeName, ThemeColors> = {
  blue:   { /* ... */ },
  white:  { /* ... */ },
  dark:   { /* ... */ },
  pink:   { /* ... */ },
  purple: { /* ... */ },
};

// theme/ThemeProvider.tsx (P0)
//   - AsyncStorage로 선호 테마 영속화
//   - `useTheme()` hook → 현재 colors + setTheme
//   - 시스템 다크모드 감지 (선택, P0 후반)
```

기존 `theme/index.ts`는 **삭제하지 않고 deprecation 주석만** 추가 → 사용처
[`InlineErrorLine.tsx`](../../packages/mobile/src/components/InlineErrorLine.tsx)
부터 새 토큰으로 마이그레이션, 모든 사용처 마이그레이션 후 삭제.

---

## 5. Phase별 작업 단위 + 의존성

### 5.1 P0 — 디자인 토큰 + 5 테마 인프라 (2일, blocking)

**산출물**:
- `theme/tokens.ts` — 5 테마 × 토큰 묶음 (40~50 token)
- `theme/ThemeProvider.tsx` — Context + AsyncStorage 영속화 + `useTheme()` hook
- `theme/typography.ts` — Apple SD Gothic Neo / Noto Sans KR 폰트 등록
- 기존 `theme/index.ts`에 deprecation 주석
- [`InlineErrorLine.tsx`](../../packages/mobile/src/components/InlineErrorLine.tsx) 마이그레이션 (1 사용처)
- **SCR-025 설정 화면** (P0의 시각적 검증 — 5 테마 즉시 전환 가능해야 P0 완료)

**테스트**:
- `themes.spec.ts` — 모든 토큰이 5 테마 모두에 정의돼 있는지
- `ThemeProvider.spec.tsx` — setTheme 호출 후 useTheme이 새 값 반환

**의존성**: 없음. 단독 PR.

### 5.2 P1 — Auth 흐름 보강 (1.5일)

**산출물**:
- SCR-001 Splash (`app/_layout.tsx` 진입 시 2초 + 세션 상태 분기)
- SCR-002 로그인 UI 리디자인 (P0 토큰 사용) + OAuth 버튼 3개 (Google/Apple/Facebook) — **placeholder만**, 백엔드 미구현이므로 onPress 시 "준비 중" 토스트
- SCR-003 회원가입 UI 리디자인
- SCR-004 추가 정보 화면 신설 — 가입 직후 `app/(auth)/extra.tsx` 라우트로 이동, 닉네임/생년월일/마케팅 동의 수집

**의존성**:
- P0 토큰 시스템
- 백엔드: 현재 `signup` API가 닉네임/생년월일을 한 번에 받음 → SCR-004 분리 시 `signup` 단계별 호출이 필요할 수도. **결정 필요**: signup-then-update vs signup-with-all-fields. (권고: signup 단일 호출 유지, SCR-004는 마케팅 동의 + 프로필 사진만 수집해서 `PATCH /me`)

### 5.3 P2 — 홈 피드 + 아이돌 상세 (3일)

**산출물**:
- SCR-005 홈 피드: view-mode 3종 (`grid2 | grid1 | list`) + AsyncStorage로 선호 저장
- SCR-006 아이돌 상세 재구성:
  - 좌우 스와이프 (`react-native-gesture-handler` PanGestureHandler) — adjacent idol으로 이동
  - 카드/목록 뷰 토글
  - 응원댓글 섹션 — **백엔드 신설 필요** (`/idols/:id/cheers` GET/POST)

**의존성**:
- P0 토큰
- **백엔드 응원댓글 API 신설** (`Cheer` model + controller + repo + 통합 테스트) → 별도 슬라이스, P2와 병렬 가능

### 5.4 P3 — 오디션 + 포토카드 분기 (3일)

**산출물**:
- SCR-010 오디션 대시보드 — `app/(app)/auditions/index.tsx`를 대시보드로 재구성 (진행중 + 지난 + 곧 시작 카드)
- SCR-011 진행중 오디션 — 기존 detail UI 토큰 마이그레이션
- SCR-012 지난 오디션 — `app/(app)/auditions/past.tsx` 또는 list filter (`?status=ENDED`)
- SCR-017 포토카드 뽑기 — `app/(app)/gacha/[setId].tsx` 신설 + gacha 애니메이션 (Lottie 권장 또는 Reanimated)
- SCR-018 포토카드 전체 목록 — `collection.tsx` 토큰 마이그레이션 + 그리드/리스트 토글

**의존성**:
- P0 토큰
- T-064 (audition lifecycle backend) — 이미 구현됨
- 가챠 애니메이션 — Lottie file 디자인 자산 필요 (없으면 Reanimated 단순 fallback)

### 5.5 P4 — 마이페이지 sub-routes (2.5일)

**산출물**:
- SCR-020 마이페이지 허브 — `profile.tsx` 재구성, 5 sub 카드 entry
- SCR-021 구매 포토카드 — `app/(app)/me/photocards.tsx` (기존 `useMyPhotocards` 사용)
- SCR-022 구독 정보 — `app/(app)/me/memberships.tsx` (`useMyMemberships` 사용 — `api.listMyMemberships` 이미 client에 있음)
- SCR-023 투표 이력 — `app/(app)/me/votes.tsx` — **백엔드 신설 필요** (`GET /me/votes` 페이지네이션)
- SCR-024 찜한 아티스트 — `app/(app)/me/follows.tsx` + `app/(app)/me/hearts.tsx` 또는 단일 탭 화면 (`useMyHearts`/`useMyFollows` 이미 있음)

**의존성**:
- P0 토큰
- 백엔드 `GET /me/votes` 신설

---

## 6. 위험 + 완화

| 위험 | 영향 | 완화 |
|---|---|---|
| **테마 마이그레이션 누락** — 일부 컴포넌트가 새 토큰 안 쓰면 5 테마에서 부분 깨짐 | 시각적 회귀 | P0 완료 시점에 grep `colors\.bg\|colors\.surface` 등으로 잔존 hardcoded 색 0건 확인 + 5 테마 모두 화면 캡쳐 비교 |
| **응원댓글 백엔드 미정** | P2 SCR-006 완성 불가 | 응원댓글 ADR 별도 작성 (regulation 검토: 댓글 = UGC = 모더레이션 정책 필요) |
| **OAuth 버튼 placeholder** | UX 혼란 | P1 onPress 시 명시 토스트 "Phase 2 추가 예정" + 백엔드 OAuth 구현은 별도 ADR (T-009b) |
| **가챠 애니메이션 자산 미정** | P3 SCR-017 시각 quality 저하 | Lottie 미확보 시 Reanimated 단순 카드 회전 fallback로 ship, 이후 디자인 자산 합류 시 swap |
| **5 테마 = 5× QA 시간** | 회귀 테스트 부담 | 핵심 화면(로그인/홈/마이페이지) 5 테마 시각 캡쳐를 storybook 또는 Playwright로 자동화 (Phase D 후반) |
| **백엔드 추가 API (cheer / votes / 추가 정보 PATCH)** | 모바일 only 슬라이스가 백엔드 진입을 강제 | 각 phase 첫 작업으로 백엔드 API 먼저 ship → mobile 따라감 |

---

## 7. 권고 첫 슬라이스 (이번 sprint 시작점)

### P0 디자인 토큰 + 5 테마 + 설정 화면 (SCR-025)

**왜 첫 슬라이스로**:
- 모든 다른 phase의 prerequisite — 토큰 없이 P1~P4 진행하면 색상 hardcoded 누적 → 나중에 마이그레이션 비용 폭증
- 단독으로 시각적 검증 가능 (설정 화면에서 5 테마 즉시 전환 → 모든 화면 색이 따라가는지 확인)
- 백엔드 의존 0
- 추정 2일 (1일 인프라 + 0.5일 마이그레이션 + 0.5일 SCR-025)

**작업 단위**:
1. `theme/tokens.ts` — 5 테마 × 토큰 추출 (와이어프레임 CSS에서 직접 복제)
2. `theme/ThemeProvider.tsx` — Context + AsyncStorage 영속화
3. `theme/useTheme.ts` — hook
4. `theme/typography.ts` — 폰트 등록 (Apple SD Gothic Neo system fallback OK)
5. 기존 `theme/index.ts` deprecate + InlineErrorLine 마이그레이션
6. SCR-025 `app/(app)/me/settings.tsx` — 5 테마 chip + 즉시 전환
7. tests: `tokens.spec.ts` 토큰 완전성 + `ThemeProvider.spec.tsx`

### 5 테마 적용 시 검증 절차

CMS preview 페이지([포함](../../packages/cms/src/features/preview/preview-page.tsx))를 통해
admin이 5 테마 모두 즉시 시각 확인 가능 — 별도 인프라 0.

---

## 8. 결정 요청 → 답변 정리 (2026-04-26)

| # | 결정 의제 | 답변 | 영향 |
|---|---|---|---|
| 1 | **default 테마** | ✅ **blue + 라이트 모드** (시스템 다크모드 자동 스위치 OFF, 사용자가 settings에서 수동 dark 선택만 가능) | P0 ThemeProvider 기본값 `'blue'` + `Appearance` 자동 추적 비활성 |
| 2 | **OAuth UI placeholder vs 백엔드 구현** | ✅ **이번에 구현 안 함, 버튼만 placeholder로 노출** | P1 SCR-002에 Google/Apple/Facebook 버튼 3개 노출, onPress 시 토스트 "준비 중". 백엔드 OAuth는 별도 ADR (T-009b 신규)로 Phase D 후반 또는 Phase E |
| 3 | **SCR-004 추가 정보 분리 vs 통합** | ✅ **권고 채택**: signup 통합 유지, SCR-004는 *마케팅 동의 + 프로필 사진*만 분리. backend `PATCH /me` 신설 (P1) | P1 1.5일 그대로 |
| 4 | **응원댓글 backend 신설 시점** | ✅ **권고 채택**: P2 mobile과 동시 (백엔드 1일 + 모바일 0.5일). 모더레이션 정책 ADR 별도 작성 (UGC 신규) | P2 4일로 보정 (3일 → 4일, 응원댓글 1일 추가) |
| 5 | **가챠 Lottie 자산** | ✅ **권고 채택**: Reanimated fallback ship → 자산 합류 시 swap (~30분) | P3 quality는 fallback 수준, GA 직전 자산 미보유 시 그대로 ship |
| 6 | **Phase D scope 영향** | ✅ **동시 진행** (50k 부하 측정 / IAP 본 구현 / Telemetry / OWASP·WCAG와 병렬). 본 5 phase가 17주의 ~15% 점유 인지 + 별도 sprint 분리 안 함 | Phase D 첫 4주 안에 P0~P2 ship 권고. P3~P4는 5~8주차 |

### 8.1 P0 즉시 착수 가능 여부

- 결정 #1(default 테마)는 잠정 blue로 진행 — wireframe convention과 일치, 추후 한 줄 회신으로 변경 비용 0
- 결정 #2(OAuth)는 P1 의제, P0 영향 없음
- 결정 #3·#4·#5는 P1·P2·P3 의제, P0 영향 없음

→ **P0 (디자인 토큰 + 5 테마 + 설정 화면) 즉시 착수 가능.**

---

## 9. 변경 이력

| 일자 | 내용 |
|---|---|
| 2026-04-26 | 초안. wireframe v2 분석 + 25 화면 매핑 + 5 phase 분할 + P0 첫 슬라이스 권고. 결정 6건 노출. |
| 2026-04-26 | 결정 답변 수신 — #2 OAuth 버튼 placeholder만 노출 (백엔드 미구현) 확정, #6 동시 진행 확정, #1 잠정 blue (cutoff), #3·#4·#5 미답 → 권고 default 명시. P0 즉시 착수 가능 판정. |
| 2026-04-26 | 결정 6건 전체 lock — #1 blue + 라이트모드, #3·#4·#5 권고 채택. P0 착수. |
| 2026-04-26 | **P0 완료** — `theme/tokens.ts` (5 테마 × 16 토큰) · `ThemeProvider` (AsyncStorage 영속) · `typography.ts` · 기존 `theme/index.ts` deprecate · `InlineErrorLine` 마이그레이션 · SCR-025 settings 화면. 14 신규 tests (mobile 11 suites / 57 tests). Expo web `/me/settings` 200. |
| 2026-04-26 | **P1 완료** — backend `PATCH /api/v1/me` + `UpdateMeUseCase` + `marketingOptIn`/`pushOptIn` UserDto 확장 (5 ITC tests, ITC-ME-PATCH). mobile splash 로직 강화 (1초 minimum + accent gradient bg) · login UI 리디자인 + OAuth 3 placeholder (Google/Apple/Facebook 버튼만, onPress 시 토스트) · signup UI 리디자인 + 가입 후 SCR-004 redirect · SCR-004 추가 정보 화면 (avatarUrl + marketing/push 동의 토글). backend 109 unit / **77 integration** · mobile 57 tests · Expo web `/login` `/signup` `/extra` `/me/settings` 모두 200. |
