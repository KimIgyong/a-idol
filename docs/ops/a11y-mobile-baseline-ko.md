# 모바일 접근성(a11y) 1차 — RPT-260426-D Phase D T-083

**작성일**: 2026-04-26 · **상태**: first-pass landed · **목표**: WCAG 2.1 AA

## 1. 적용 범위

7개 핵심 화면의 interactive Pressable 에 React Native a11y props 추가:

| 화면 | 파일 | 추가 prop |
|---|---|---|
| 로그인 | [app/(auth)/login.tsx](../../packages/mobile/app/(auth)/login.tsx) | submit + 3 OAuth 버튼 (role + label + busy state + hint) |
| 회원가입 | [app/(auth)/signup.tsx](../../packages/mobile/app/(auth)/signup.tsx) | back + submit (role + label + busy state) |
| 추가 정보(SCR-004) | [app/(auth)/extra.tsx](../../packages/mobile/app/(auth)/extra.tsx) | skip + complete (role + label + hint + busy) |
| 홈(SCR-005) | [app/(app)/index.tsx](../../packages/mobile/app/(app)/index.tsx) | refresh + 3 sort chips + 3 view-mode chips (role + label + selected state) |
| 마이페이지(SCR-020) | [app/(app)/profile.tsx](../../packages/mobile/app/(app)/profile.tsx) | refresh + 5 nav row + logout (role=link/button + label + hint) |
| 아이돌 상세(SCR-006) | [app/(app)/idol/[id].tsx](../../packages/mobile/app/(app)/idol/[id].tsx) | back + prev/next chevron + heart/follow toggle + cheer post (selected/busy state, page 카운트 label) |
| 가챠(SCR-017) | [app/(app)/gacha/[setId].tsx](../../packages/mobile/app/(app)/gacha/[setId].tsx) | draw button + odds toggle (busy state + expanded state + price label) |

## 2. 적용 패턴

### 2.1 Pressable 기본

```tsx
<Pressable
  onPress={...}
  accessibilityRole="button"           // VoiceOver "버튼" 안내
  accessibilityLabel="가입하고 계속"     // 텍스트 미보유 또는 모호한 경우
  accessibilityHint="..."              // 액션 결과 보충 (선택)
  accessibilityState={{ disabled, busy, selected, expanded }}
  ...
/>
```

- **role**: `button` (default UI), `link` (마이페이지 nav row 처럼 라우팅), `image`, `header` 등.
- **label**: 시각 텍스트가 없거나(↻, ◀, ▶, ›, ▦), 텍스트만으로 모호한 경우.
- **hint**: 액션 결과를 한 문장으로(`"설정 없이 바로 홈으로 이동합니다"`).
- **state**:
  - `disabled` — 비활성. VoiceOver "사용 안 함"
  - `busy` — 비동기 진행 중. 결제/네트워크 동안 자동 안내
  - `selected` — toggle/탭 선택 상태 (sort chip · 하트 · 팔로우)
  - `expanded` — disclosure (확률 공개 toggle)

### 2.2 동적 라벨 (toggle)

선택 상태에 따라 label이 달라지면 **현재 동작**으로 명명:

```tsx
accessibilityLabel={fandom.hearted ? '하트 취소' : '하트 보내기'}
```

이후 사용자가 누르면 안내 라벨이 바뀜 → 시각/청각 모두 일관.

### 2.3 nullable boolean

`accessibilityState.selected/disabled/busy/expanded` 는 `boolean | undefined`. nullable 도메인 값을 그대로 넘기면 TS 에러 → `!!fandom.hearted` 로 coerce.

## 3. 미적용 (Phase D 후속)

| 항목 | 사유 | 우선순위 |
|---|---|---|
| 채팅 화면 (SCR-007~009) | ~~message bubble live region~~ ✅ 2026-04-27 적용 (`accessibilityLiveRegion="polite"` + 각 bubble accessibilityLabel + 토큰 마이그레이션). 키보드 포커스 트랩 정밀 검토는 별도 — modal flow 검증 시 같이 | P2 |
| 오디션 detail / vote 화면 | ~~round 카드, 후보 idol 이미지의 `accessibilityLabel` 일괄 부여~~ ✅ 2026-04-27 일부 적용 (round card role/label/state, 대시보드 카드 라벨, past list 라벨). vote 화면 자체는 별도 슬라이스 | P2 |
| 수집/판매 (collection / shop) | ~~rarity 필터 chips, view-mode toggle, 빈 상태 CTA~~ ✅ 2026-04-27 collection.tsx 적용. shop.tsx는 deprecated `colors` 사용 중이라 토큰 마이그레이션과 함께 별도 슬라이스. | P2 |
| 컬러 컨트라스트 | wireframe 5 테마(특히 dark)에 대해 WCAG AA 4.5:1 텍스트 대비 자동 검증 — 별도 토큰 audit | P1 |
| Dynamic Type 대응 | iOS Settings의 텍스트 크기 → React Native `useFontScale` 도입 | P2 |
| 키보드 trap (RN-Web) | `tabIndex` + focus order 검토. expo-router 기본은 OK이지만 modal flow 검증 | P2 |
| Screen reader 회귀 테스트 | jest-react-a11y 또는 detox 시나리오 (현재 unit test에는 a11y assertion 없음) | P1 |

## 4. 검증

### 4.1 기계 검증 (현재)

- `pnpm --filter @a-idol/mobile typecheck` — `accessibilityState` 타입 안전성 (boolean coerce 강제)
- `pnpm --filter @a-idol/mobile test` — 11 suites / 57 tests 🟢 (회귀 없음)

### 4.2 수동 검증 (GA 전)

- **iOS VoiceOver**: 설정 → 손쉬운 사용 → VoiceOver ON. 7개 화면 전 행 step-through:
  - 모든 Pressable이 "버튼" 또는 "링크"로 안내되는지
  - 선택 상태 (sort chip, view-mode, 하트/팔로우)가 announce 되는지 ("선택됨", "선택 안 됨")
  - 결제 진행 중 "사용 중" 안내가 나오는지 (gacha draw button)
- **Android TalkBack**: 동등한 step-through.
- **iOS Dynamic Type**: 텍스트 크기 → "큼" 단계 → 레이아웃 깨짐 없음 확인.

### 4.3 자동 회귀 (Phase D 후속)

- jest 기반 react-native-testing-library 의 `toHaveAccessibilityLabel` matcher
- detox e2e 시나리오에 a11y traversal 단계 1개 추가

## 5. 컬러 컨트라스트 audit (T-083 후속)

`packages/mobile/scripts/contrast-audit.ts` — 5테마 × text(text1/text2/text3) ×
bg(bg/surface/elevated/pageBg/accentLt) = 75 조합 자동 측정. WCAG 2.1 AA 기준
4.5:1 (모든 wireframe 폰트 < 24px).

### 5.1 결과 요약

**텍스트 토큰 × 배경 (2026-04-26)**:

| 테마 | text1 | text2 | text3 |
|---|---|---|---|
| blue | ✅ 5/5 (15.78~18.72:1) | ✅ 5/5 (5.30~6.30:1) | ❌ 0/5 (1.88~2.23:1) |
| white | ✅ 5/5 | ✅ 5/5 | ❌ 0/5 (1.98~2.32:1) |
| dark | ✅ 5/5 | ✅ 5/5 | ❌ 0/5 (2.38~3.34:1) |
| pink | ✅ 5/5 | ✅ 5/5 | ❌ 0/5 (1.72~2.18:1) |
| purple | ✅ 5/5 | ✅ 5/5 | ❌ 0/5 (1.54~2.24:1) |

**버튼: 흰 텍스트 (#FFFFFF) × accent류 배경 (2026-04-27)**:

테마별 6개 액센트(`accent`, `accent2`, `accentDk`, `accentSk`, `success`, `danger`) 위 흰 글자.

| 배경 | blue | white | dark | pink | purple | 권장 |
|---|---|---|---|---|---|---|
| accent | ✅ | ✅ | ❌ 2.79 | ❌ 3.53 | ❌ 4.23 | dark/pink/purple 테마는 accentDk 사용 |
| accent2 | ❌ 2.83 | ✅ | ❌ 1.97 | ❌ 2.65 | ❌ 2.72 | 흰 글자 권장 안 함 — gradient 끝점 전용 |
| accentDk | ✅ 8.59~9.5 | ✅ | ✅ | ✅ 6.04 | ✅ 7.10 | 모든 테마 안전 — 버튼 표준 권장 |
| accentSk | ❌ | ✅ | ❌ | ❌ | ❌ | skeleton 전용 (텍스트 없음) |
| success #10B981 | ❌ 2.54 | ❌ | ❌ | ❌ | ❌ | 텍스트 ≥18.66px bold (AA Large 3:1) 또는 흰 글자 대신 검은 글자 |
| danger #EF4444 | ❌ 3.76 | ❌ | ❌ | ❌ | ❌ | 동일 — Large text 또는 텍스트 색 swap |

**종합: 58/105 pass · 47 fail** (25 text3 + 22 button bg).

### 5.2 text3 정책 (Usage policy)

text3 의 디자인 의도 (`/** 더 흐린 텍스트 (placeholder, faint) */`)는 WCAG의
**"placeholder/incidental text" carve-out** 영역. 실용 정책:

| 용도 | text3 OK? | 대안 |
|---|---|---|
| TextInput placeholder | ✅ AA exempt | — |
| 장식적 chevron `›`, `↻` | ✅ non-essential decoration | — |
| 빈 list 안내 ("아직 응원이 없습니다") | ⚠️ AA 권장 | text2 사용 권장 |
| 상대시간 `"5분 전"`, end marker `"— 끝 —"` | ❌ 의미 있는 정보 | **text2 로 swap** |
| 통계 숫자, count badge | ❌ 의미 있는 정보 | **text2 로 swap** |

**액션 (P1, GA 전)**: 7 화면 audit하여 text3 → text2 swap 후보 식별 후 일괄
교체. 또는 token 추가 — `textWeak` (text2와 text3 사이 ~4.5:1) 신설하여
의미 있는 흐린 텍스트 케이스 흡수.

### 5.3 재측정 + CI gate

```bash
# Informational + baseline regression gate (25 documented text3 fail 까지 OK)
pnpm --filter @a-idol/mobile contrast:audit
# exit 0 = baseline 이하 fail · exit 1 = 회귀 (>25 fails)

# Strict mode (text3 정책 정리 후 활성화) — 모든 fail에 exit 1
pnpm --filter @a-idol/mobile contrast:audit -- --strict
```

**baseline (2026-04-26)**: 50/75 pass · 25 fail (모두 text3). 토큰 변경 시
재실행. 새 토큰/페어가 fail 추가하면 PR description에 정당화 기록 또는
text2 swap.

---

## 6. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-26 | first-pass — 7 핵심 화면, ~25 Pressable 에 a11y props 적용. 미적용 항목 Phase D 후속 백로그로 분류. |
| 2026-04-26 | 컬러 컨트라스트 audit 스크립트 + 결과 추가. text1/text2 전 테마 AA 통과 (50/75). text3 의 25개 fail은 design intent — placeholder/decoration용도로 한정하고, 의미 있는 정보 표시는 text2로 swap (P1 후속 액션). |
| 2026-04-27 | 채팅 화면 (SCR-007~009) 토큰 마이그레이션 + a11y. `accessibilityLiveRegion="polite"`로 새 메시지 자동 announce. 각 bubble에 sender role + content + time 통합 라벨. error 텍스트에 `accessibilityRole="alert"`. WS 연결 dot에 라벨, 잔액 badge에 라벨. |
| 2026-04-27 | contrast audit 확장 — 흰 텍스트(#FFFFFF) × 6개 액센트 배경 추가 (테마별 6 = +30 조합). 22개 추가 fail. 정책: light tone accent(`accent`/`accent2`/`accentSk`) 위 흰 글자는 dark theme/pink/purple에서 미달 → 버튼 background는 `accentDk` 권장. `success`/`danger` 위 흰 글자는 모든 테마 미달 → AA Large text(≥18.66px bold) 또는 검은 글자 swap. baseline 25→50 으로 상향. |
| 2026-04-27 | a11y 2nd pass — auditions/index.tsx (refresh + past entry + audition card), auditions/[id].tsx (back + round card with disabled state), auditions/past.tsx (back + past row), collection.tsx (back + refresh + 5 rarity chip + 2 view-mode + empty CTA), gacha/[setId].tsx (3 back button + reveal CTA 2개). |
| 2026-04-27 | shop.tsx + rounds/[id]/vote.tsx + (app)/_layout.tsx 토큰 마이그레이션 + a11y. shop: 3 tab(selected) + buy(busy/disabled) + 확률 toggle(expanded) + toast live region. vote: leaderboard rank/score 통합 라벨, HEART/TICKET 버튼 disabled state, badge 라벨. tab layout: useTheme 적용. **deprecated `src/theme/index.ts` 제거 — 5테마 토큰 시스템 단일화 완료**. |
| 2026-04-27 | text3 → text2 swap 2nd pass — info-bearing 텍스트 11개 swap (홈 끝 마커/빈 상태, 가챠 hero badge/muted, me/memberships/follows empty, audition card 카운트 표, audition past row, audition detail empty/maxAdvancers, idol gallery type label). text3 토큰 자체는 그대로 (placeholder/chevron 용도) — audit baseline 50 유지. |
