---
document_id: A-IDOL-UI-1.0.0
version: 1.0.0
status: Draft
created: 2026-04-15
updated: 2026-04-15
author: Project Owner (Claude)
reviewers: []
change_log:
  - version: 1.0.0
    date: 2026-04-15
    author: Project Owner
    description: Initial draft — full mobile UI specification (React Native)
---

# A-idol — UI Specification / 화면 기획서 (Mobile)

> **Target**: React Native (iOS + Android)
> **Design System**: Custom — dark-primary theme with vibrant accent
> **Primary Resolution Reference**: 390×844pt (iPhone 14) / 360×800dp (Android mid-range)
> **Navigation Pattern**: Bottom Tab Bar (5 tabs) + Stack navigators per tab

---

## 1. Design System (디자인 시스템)

### 1-1. Color Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `color.bg.primary` | `#0A0A0F` | Main background |
| `color.bg.surface` | `#14141F` | Card / bottom sheet background |
| `color.bg.elevated` | `#1E1E2E` | Elevated surfaces, modals |
| `color.accent.primary` | `#B066FF` | Primary CTA, active states |
| `color.accent.secondary` | `#FF6B9D` | Secondary highlights, like color |
| `color.accent.gold` | `#FFD166` | Ranking badges, premium indicators |
| `color.text.primary` | `#F0EEF8` | Primary text |
| `color.text.secondary` | `#8A8A9A` | Subtitles, captions |
| `color.text.disabled` | `#444455` | Disabled states |
| `color.border.default` | `rgba(255,255,255,0.08)` | Card borders |
| `color.border.active` | `rgba(176,102,255,0.4)` | Active / focused borders |
| `color.success` | `#4FFFB0` | Success states |
| `color.error` | `#FF5A5A` | Error states |

### 1-2. Typography

| Token | Font | Size | Weight | Line Height |
|-------|------|------|--------|-------------|
| `text.display` | Pretendard | 28pt | 700 | 36pt |
| `text.title1` | Pretendard | 22pt | 700 | 30pt |
| `text.title2` | Pretendard | 18pt | 600 | 26pt |
| `text.body1` | Pretendard | 16pt | 400 | 24pt |
| `text.body2` | Pretendard | 14pt | 400 | 22pt |
| `text.caption` | Pretendard | 12pt | 400 | 18pt |
| `text.label` | Pretendard | 11pt | 500 | 16pt |

### 1-3. Spacing & Radius

| Token | Value |
|-------|-------|
| `space.xs` | 4pt |
| `space.sm` | 8pt |
| `space.md` | 16pt |
| `space.lg` | 24pt |
| `space.xl` | 32pt |
| `radius.sm` | 8pt |
| `radius.md` | 12pt |
| `radius.lg` | 16pt |
| `radius.xl` | 24pt |
| `radius.full` | 9999pt |

### 1-4. Bottom Tab Bar

- Height: 56pt + safe area inset
- Icons: 24pt outlined; active state filled + accent color
- Label: 10pt, active = `color.accent.primary`
- Background: `color.bg.surface` + blur effect

| Tab | Icon | Label | Screen |
|-----|------|-------|--------|
| 1 | home_filled | 홈 | IdolFeed |
| 2 | trophy_outline | 오디션 | AuditionScreen |
| 3 | photo_outline | 포토카드 | PhotocardScreen |
| 4 | group_outline | 팬클럽 | FanClubListScreen |
| 5 | person_outline | MY | MyPageScreen |

---

## 2. Screen Inventory (화면 목록)

| SCR-ID | Screen Name | Route | Auth Required |
|--------|-------------|-------|---------------|
| SCR-001 | Splash | `/splash` | No |
| SCR-002 | Onboarding | `/onboarding` | No |
| SCR-003 | Login | `/auth/login` | No |
| SCR-004 | Profile Setup | `/auth/profile-setup` | Partial (token issued) |
| SCR-005 | Idol Feed (Home) | `/home` | Yes |
| SCR-006 | Idol Detail | `/idols/:id` | Yes |
| SCR-007 | Idol Gallery | `/idols/:id/gallery` | Yes |
| SCR-008 | Fan Club List (My Clubs) | `/fan-clubs` | Yes |
| SCR-009 | Fan Club Chat | `/fan-clubs/:id/chat` | Yes |
| SCR-010 | Chat Coupon Shop | `/shop/chat-coupons` | Yes |
| SCR-011 | Audition Home | `/audition` | Yes |
| SCR-012 | Round Detail & Vote | `/audition/rounds/:id` | Yes |
| SCR-013 | Vote Ticket Shop | `/shop/vote-tickets` | Yes |
| SCR-014 | Voting History | `/audition/history` | Yes |
| SCR-015 | Photocard Home | `/photocards` | Yes |
| SCR-016 | Idol Photocard Sets | `/photocards/idol/:id` | Yes |
| SCR-017 | Photocard Pull (Gacha) | `/photocards/sets/:id/pull` | Yes |
| SCR-018 | My Collection | `/photocards/collection` | Yes |
| SCR-019 | My Page | `/my` | Yes |
| SCR-020 | Liked / Followed Idols | `/my/favorites` | Yes |
| SCR-021 | Purchase History | `/my/purchases` | Yes |
| SCR-022 | Settings | `/my/settings` | Yes |
| SCR-023 | Notification Center | `/notifications` | Yes |

---

## 3. Screen Specifications (화면 상세 명세)

---

### SCR-001 — Splash

**Purpose**: App initialization; auth state check  
**Duration**: 1.5–2.5s (while checking JWT validity)

| Element | Spec |
|---------|------|
| Background | `color.bg.primary` with subtle radial glow at center (`color.accent.primary` 15% opacity) |
| Logo | A-idol wordmark + star particle animation; centered vertically at 45% |
| Loading indicator | Thin progress bar at very bottom; `color.accent.primary` |

**Navigation Logic**:
- Valid JWT found → navigate to `/home`
- No JWT / expired → navigate to `/onboarding`

---

### SCR-002 — Onboarding

**Purpose**: First-time user experience; 3-screen carousel  
**Components**: ViewPager (swipeable), dot indicators, skip button

| Slide | Visual | Headline | Sub-copy |
|-------|--------|----------|----------|
| 1 | Idol card stack animation | "99명의 아이돌을 만나세요" | "좋아요, 팔로우하고 나만의 최애를 찾아보세요" |
| 2 | Chat bubble animation (idol + fan) | "최애 아이돌과 채팅하세요" | "팬클럽에 가입하면 아이돌과 직접 대화할 수 있어요" |
| 3 | Voting ticker animation | "오디션에 투표하세요" | "포토카드를 모으고 아이돌의 데뷔를 응원해요" |

**Footer**:  
- Slide 1–2: "다음" button (right aligned) + "건너뛰기" text button (top-right)  
- Slide 3: "시작하기" primary button (full width)

---

### SCR-003 — Login

**Purpose**: Authentication entry point

**Layout** (top → bottom):
```
[60pt safe area top]
[A-idol logo — 48pt centered]
[24pt gap]
[Headline: "로그인" — text.title1]
[8pt gap]
[Caption: "아이돌과 더 가까워지세요" — text.body2, color.text.secondary]
[40pt gap]
[Kakao Login Button]    ← Yellow bg (#FEE500), 카카오 icon, "카카오로 시작하기"
[12pt gap]
[Apple Login Button]    ← Black bg (iOS only / shown on iOS), Apple icon, "Apple로 로그인"
[12pt gap]
[Google Login Button]   ← surface bg, Google icon, "Google로 계속하기"
[24pt gap]
[Divider: "또는"]
[16pt gap]
[Email Login Button]    ← outline style, "이메일로 로그인"
[16pt gap]
[SignUp Link: "아직 계정이 없으신가요? 회원가입"]
[40pt gap]
[Terms caption: "로그인 시 이용약관 및 개인정보처리방침에 동의합니다"]
```

**Button Spec**: Height 52pt, radius.lg, full width with 24pt horizontal margin

---

### SCR-004 — Profile Setup

**Purpose**: Nickname + profile image for new users  
**Header**: "프로필 설정" with step indicator "1/1"

| Element | Spec |
|---------|------|
| Profile image picker | 96pt circle; tap → bottom sheet (camera / gallery / default avatar); border: 3pt `color.accent.primary` |
| Nickname field | 44pt height; placeholder "2~20자 닉네임 입력"; char counter (right): "0/20" |
| Validation states | Checking → spinner; Available → green checkmark + "사용 가능한 닉네임"; Duplicate → red X + "이미 사용 중인 닉네임입니다" |
| Confirm button | Full-width primary; disabled until nickname validated |

---

### SCR-005 — Idol Feed (Home)

**Purpose**: Main discovery screen; 99 idol card grid  
**Header**: A-idol logo (left) + notification bell (right)

**Sub-header**: Horizontal scrollable category chips
```
[전체] [JYP] [SM] [HYBE] [YG] ...  (agency filter)
```

**Grid Layout**:
- 2-column grid; card gutter 12pt; horizontal padding 16pt
- Infinite scroll (20 items/page)

**Idol Card Spec** (per card):
```
┌──────────────────┐
│                  │ ← Profile photo (aspect ratio 3:4); full bleed
│                  │
│                  │
│ ❤️ 12.4K        │ ← Like count overlay (bottom-left); semi-transparent bg
├──────────────────┤
│ 아이돌 이름      │ ← text.body1 bold
│ 소속사명         │ ← text.caption, color.text.secondary
│ ❤️  팔로우       │ ← icon buttons; ❤️ filled if liked
└──────────────────┘
```

Card height: auto (photo ratio + info section 72pt)  
Card radius: radius.lg  
Card border: 1pt `color.border.default`  
Long-press card → preview bottom sheet (name, agency, quick-like)

**Empty State**: "등록된 아이돌이 없습니다" illustration + caption

---

### SCR-006 — Idol Detail

**Purpose**: Full idol profile; main engagement CTA  
**Navigation**: Push from SCR-005; back gesture supported

**Header** (transparent over photo):
- Back button (left)
- Share icon (right)
- Notification bell (right) — active if following

**Hero Section**:
```
[Photo carousel — full width, 420pt height, 3:4 ratio]
[Page dots indicator at bottom of hero]
```

**Info Card** (slides up over hero, overlapping 32pt):
```
┌──────────────────────────────────┐
│ 이름 (stage_name)   소속사 배지  │ ← text.title1 + agency chip
│ 생년월일 · 데뷔일                │ ← text.caption
│ 컨셉 태그: [청순] [파워풀] ...   │ ← horizontal scroll chips
├──────────────────────────────────┤
│ 좋아요 ❤️ 12.4K   팔로워 👥 3.2K│ ← stat row
├──────────────────────────────────┤
│ [❤️ 좋아요]  [팔로우]  [채팅하기]│ ← 3 equal-width action buttons
├──────────────────────────────────┤
│ 소개                             │ ← Section label
│ bio_kr text (expandable)        │
├──────────────────────────────────┤
│ 스케쥴                           │ ← Upcoming schedules list
│ [날짜] [타입 뱃지] [제목]        │ ← 3 items default; "더보기" expand
├──────────────────────────────────┤
│ 포토카드 세트              →    │ ← Horizontal scroll cards preview
├──────────────────────────────────┤
│ 팬클럽 가입 / 채팅하기   [CTA]  │ ← Primary large button at bottom
└──────────────────────────────────┘
```

**CTA Button States**:
- Not a member: "팬클럽 가입하기" (accent primary background)
- Member, quota > 0: "채팅하기" (accent secondary)
- Member, quota = 0, has coupons: "채팅하기 (쿠폰)" (amber)
- Member, quota = 0, no coupons: "채팅하기" disabled + "쿠폰 구매" link below

---

### SCR-009 — Fan Club Chat

**Purpose**: 1:1 chat between fan and idol AI  
**Navigation**: Full screen push; no tab bar visible

**Navigation Bar**:
```
[← Back]  [아이돌 이름 + 팬클럽명]  [⋮ more]
           [● Online]  ← always "온라인" (AI)
```

**Chat Bubbles**:

User message (right-aligned):
```
                    [메시지 내용       ]
                    [                  ]  ← bg: color.accent.primary, radius.lg radius.sm(bottom-right)
                                 오전 10:32
```

Idol AI message (left-aligned):
```
[아이돌 프로필 썸네일 32pt]
[메시지 내용       ]  ← bg: color.bg.elevated, radius.lg radius.sm(bottom-left)
오전 10:33
```

Auto-message badge: small "🌟 자동 메시지" label above idol message bubble

**Quota Bar** (pinned below nav):
```
[남은 대화: ●●●●○  4/5회]     [쿠폰 0개]
```
Progress dots: filled = remaining, empty = used; color.accent.primary  
Tap coupon count → navigate to SCR-010

**Input Area** (pinned above keyboard):
```
[TextField: "메시지 입력..."]  [전송 ▶ button]
```
TextField height: 44pt min, max 120pt (auto-expand)  
Send button: disabled (gray) when empty; enabled (accent primary) when text present  
Disabled when quota = 0 AND coupon_balance = 0

**Quota Exhausted State** (overlay when quota = 0, no coupons):
```
[오늘의 대화 횟수를 모두 사용했습니다]
[추가 대화를 원하시면 쿠폰을 구매하세요]
[쿠폰 구매하기]  ← CTA button
[내일 다시 오기]  ← dismiss text button
```

---

### SCR-011 — Audition Home

**Purpose**: Audition program overview; current round CTA

**Hero Banner** (animated gradient, full width):
```
┌─────────────────────────────────┐
│  🏆 A-idol 오디션 시즌 1        │
│  3차 예선 투표 진행 중           │
│  종료까지: 3일 14:22:08  ← countdown
│  [투표하러 가기]                 │
└─────────────────────────────────┘
```

**Round Progress Track**:
```
예선 ①─②─③─④─⑤─⑥─⑦─⑧─⑨─⑩  결선
       ↑ current
```
Round circles: completed (filled accent), current (ring + glow), future (empty)

**Current Round Card**:
```
┌─────────────────────────────────┐
│ 3차 예선           D-3 종료     │
│ 실시간 순위                      │
│ ① 아이돌A     ██████████  4.2만 │
│ ② 아이돌B     ████████    3.8만 │
│ ③ 아이돌C     ███████     3.1만 │
│ ... (top 5)                     │
│ [전체 순위 보기]  [투표하기]    │
└─────────────────────────────────┘
```

**My Voting Summary**:
```
내 투표권: 3매  |  투표한 아이돌: 아이돌A (2표)
```

---

### SCR-012 — Round Detail & Vote

**Purpose**: Full ranking + vote cast  
**Header**: "3차 예선 투표" + countdown timer

**Ranking List** (full list, scrollable):
```
[순위] [아이돌 썸네일 40pt] [이름]   [득표수]      [▲/▼ delta]
  1    [photo]             아이돌A   42,183표  ▲ 1,204
  2    [photo]             아이돌B   38,921표  ▼ 280
  ...
```
Row height: 64pt; separator: 0.5pt `color.border.default`  
Tap row → idol detail bottom sheet with "이 아이돌에게 투표" CTA

**Vote Bottom Sheet** (slides up on "투표하기"):
```
┌─────────────────────────────────┐
│ ── (drag handle) ──             │
│                                  │
│ 아이돌A에게 투표                 │
│ [아이돌 프로필 photo 64pt]       │
│                                  │
│ 투표할 표 수                     │
│ [   -   ]   [ 3 ]   [   +   ]   │
│                                  │
│ 보유 투표권: 5매                 │
│ 투표 후 잔여: 2매                │
│                                  │
│ [투표권 더 구매]  [투표하기]     │
└─────────────────────────────────┘
```

**Post-Vote Screen** (full overlay animation):
```
[Confetti animation]
✨ 투표 완료!
아이돌A에게 3표를 투표했습니다
현재 순위: 1위
[확인]
```

---

### SCR-017 — Photocard Pull (Gacha)

**Purpose**: Reveal gacha animation after purchase

**Pre-pull Screen**:
```
┌─────────────────────────────────┐
│ [세트 이름] 포토카드 뽑기        │
│                                  │
│   [12장 카드 뒤집혀진 애니]      │  ← cards fanned, face-down
│                                  │
│ 1회 뽑기 ₩1,500                 │
│ (랜덤으로 1장이 선택됩니다)       │
│                                  │
│ 내 잔여 카드: 5/12 보유          │
│ [구매 후 뽑기]                  │
└─────────────────────────────────┘
```

**Reveal Animation Sequence** (after IAP complete):
1. Cards fan out (300ms)
2. One card floats to center, grows (500ms)
3. Glow pulse (300ms)
4. Card flips — front revealed (400ms)
5. Rarity badge appears with particle effect

**Result Screen**:
```
[Rarity banner: RARE — amber glow]
[Photocard full-screen display]
[아이돌 이름 + 카드 이름]
[이미 보유: X장]
[내 컬렉션 보기]  [한 번 더 뽑기]
```

---

### SCR-019 — My Page

**Purpose**: User profile hub; navigation to sub-features

**Header**:
```
[프로필 이미지 72pt]
[닉네임] text.title2
[가입일: 2026.04.15]  text.caption
[설정 ⚙]  — top right
```

**Stats Row**:
```
[좋아요 12]  [팔로우 3]  [팬클럽 5]  [포토카드 28장]
```

**Menu List** (grouped):

그룹 1: 내 활동
- 좋아하는 아이돌 → SCR-020
- 내 팬클럽 → SCR-008
- 투표 내역 → SCR-014
- 내 포토카드 컬렉션 → SCR-018

그룹 2: 구매
- 채팅 쿠폰: ○○개 보유 → SCR-010
- 구매 내역 → SCR-021

그룹 3: 앱 설정
- 알림 설정
- 언어 설정
- 이용약관 / 개인정보처리방침
- 로그아웃
- 계정 삭제

**Menu Row Spec**: 52pt height; chevron right; label text.body1; value text.body2 secondary (for counts)

---

## 4. Navigation Flow (내비게이션 흐름)

```
[Splash SCR-001]
    ↓ (has token)          ↓ (no token)
[Home SCR-005]         [Onboarding SCR-002]
                               ↓
                         [Login SCR-003]
                               ↓
                   (new user) [Profile Setup SCR-004]
                               ↓
                         [Home SCR-005]

Bottom Tab Navigation:
  Tab 1 (홈):      SCR-005 → SCR-006 → SCR-007
                              ↓
                           SCR-009 (chat, push over tab bar)
                              ↓
                           SCR-010 (coupon shop modal)
  Tab 2 (오디션):  SCR-011 → SCR-012 → SCR-013 (ticket shop modal)
                              ↓
                           SCR-014
  Tab 3 (포토카드): SCR-015 → SCR-016 → SCR-017 → SCR-018
  Tab 4 (팬클럽):  SCR-008 → SCR-009 (chat)
  Tab 5 (MY):      SCR-019 → SCR-020, SCR-021, SCR-022
                           → SCR-010 (coupon)
```

---

## 5. Common UI Patterns (공통 UI 패턴)

### Bottom Sheets
- Handle bar: 4×36pt, `color.border.default`, centered, margin-top 8pt
- Background: `color.bg.surface`; top corners radius.xl
- Backdrop: `rgba(0,0,0,0.6)`, tap to dismiss (except blocking sheets)
- Safe area: respect bottom inset

### Toast Notifications
- Position: 80pt from bottom (above tab bar)
- Duration: 2.5s auto-dismiss
- Variants: success (green left border), error (red left border), info (accent left border)
- Text: text.body2; max 2 lines

### Loading States
- Skeleton screens for list items (shimmer animation)
- Spinner overlay (semi-transparent backdrop) for blocking operations (IAP, vote cast)
- Pull-to-refresh on all list screens

### Empty States
- Centered illustration + title (text.title2) + description (text.body2) + optional CTA button
- Each screen has unique illustration (not generic placeholder)

### Error States
- Network error → "연결을 확인해주세요" + retry button
- Server error → "잠시 후 다시 시도해주세요" + retry button
- 404 → "찾을 수 없는 콘텐츠입니다" + go back button

---

## 6. Accessibility (접근성)

| Requirement | Implementation |
|-------------|----------------|
| Minimum touch target | 44×44pt for all interactive elements |
| Color contrast | Text on backgrounds ≥ 4.5:1 (WCAG AA) |
| Screen reader | All images have `accessibilityLabel`; buttons have descriptive labels |
| Dynamic type | App respects iOS Dynamic Type and Android font scale for body text |
| Reduced motion | Gacha reveal + confetti animations disabled under "Reduce Motion" system setting |

---

## 7. Gestures & Interactions

| Screen | Gesture | Action |
|--------|---------|--------|
| SCR-005 | Long press idol card | Quick preview sheet |
| SCR-006 | Swipe photo | Navigate photo gallery |
| SCR-009 | Swipe right | Go back (chat exit confirmation if in progress) |
| SCR-017 | Tap anywhere | Advance reveal animation |
| SCR-012 | Tap ranking row | Vote bottom sheet for that idol |
| All lists | Pull down | Refresh |
| All stacks | Swipe right edge | Pop back |
