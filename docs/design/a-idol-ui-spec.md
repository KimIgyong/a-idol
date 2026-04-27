---
document_id: A-IDOL-UI-SPEC-1.0.0
version: 1.0.0
status: Draft
created: 2026-04-18
updated: 2026-04-18
author: Gray Kim
---

# A-idol — UI Specification (A-아이돌 화면 기획서)

## Screen Inventory (화면 목록)

### Mobile (React Native)

| ID | Screen | Route | Auth | Note |
|----|--------|-------|------|------|
| SCR-MOB-001 | Splash / Onboarding | `/splash` | Public | 최초 실행 가이드 3p |
| SCR-MOB-002 | Sign-in | `/auth/sign-in` | Public | 소셜 + 이메일 |
| SCR-MOB-003 | Sign-up Extra | `/auth/profile-setup` | Auth | 닉네임, 생년월일, 약관 |
| SCR-MOB-010 | Home (Discover) | `/tabs/home` | Auth | 피드 + 오디션 배너 |
| SCR-MOB-011 | Idol List | `/tabs/idols` | Auth | 99명 그리드 |
| SCR-MOB-012 | Idol Detail | `/idols/:id` | Auth | 하트/팔로우/팬클럽 가입 |
| SCR-MOB-020 | My Fan Clubs | `/tabs/my-clubs` | Auth | 가입 팬클럽 목록 |
| SCR-MOB-030 | Chat Room | `/chat/:roomId` | Auth+Member | 1:1 채팅 |
| SCR-MOB-031 | Coupon Purchase Modal | overlay | Auth | 쿠폰 패키지 |
| SCR-MOB-040 | Photo Card Shop | `/shop/cards` | Auth | 세트 리스트 |
| SCR-MOB-041 | Photo Card Draw Result | overlay | Auth | 랜덤 결과 연출 |
| SCR-MOB-042 | My Collection | `/me/cards` | Auth | 보유 카드 갤러리 |
| SCR-MOB-050 | Audition Overview | `/tabs/audition` | Auth | 회차 상태 |
| SCR-MOB-051 | Round Vote | `/audition/:roundId` | Auth | 투표 화면 |
| SCR-MOB-052 | Vote Ticket Shop | `/shop/tickets` | Auth | 패키지 |
| SCR-MOB-053 | Rankings | `/audition/:roundId/rankings` | Auth | 상위 10위 |
| SCR-MOB-060 | Profile / Settings | `/tabs/me` | Auth | 알림/인스타/탈퇴 |

### Web CMS (React)

| ID | Screen | Route | Role |
|----|--------|-------|------|
| SCR-CMS-001 | Admin Login | `/login` | Public |
| SCR-CMS-002 | Dashboard | `/` | any admin |
| SCR-CMS-010 | Idol Manager | `/idols` | content_admin |
| SCR-CMS-011 | Idol Detail/Edit | `/idols/:id` | content_admin |
| SCR-CMS-012 | Agency Manager | `/agencies` | content_admin |
| SCR-CMS-013 | Auto Message Templates | `/chat/templates` | content_admin |
| SCR-CMS-020 | Audition Manager | `/auditions` | audition_admin |
| SCR-CMS-021 | Vote Rule Editor | `/auditions/:id/rules` | audition_admin |
| SCR-CMS-022 | Round Monitor | `/auditions/:id/rounds/:rid` | audition_admin |
| SCR-CMS-030 | Analytics | `/analytics` | super_admin |
| SCR-CMS-031 | Photo Card Sets | `/cards` | content_admin |
| SCR-CMS-040 | User CS Console | `/users` | cs_admin |
| SCR-CMS-041 | Report Queue | `/reports` | cs_admin |

---

## SCR-MOB-012: Idol Detail (예시 상세 기획)

### Layout (wireframe)

```
┌───────────────────────────┐
│ ◂  [ Idol Name ]     ⋮    │  ← 상단 AppBar (뒤로, 공유)
├───────────────────────────┤
│ [ Hero Image / Carousel ] │  ← 16:9, 페이지 인디케이터
│                           │
├───────────────────────────┤
│ 이름 (age · MBTI · 캐릭터)│
│ ♥ 12,480     👥 8,420    │
│ [ 하트 ]  [ 팔로우 ]     │  ← toggle 버튼
│ [  팬클럽 가입하기  ]    │  ← primary CTA
├───────────────────────────┤
│ Tabs: 소개 | 스케줄 | 미디어│
│                           │
│ (탭 컨텐츠)                │
└───────────────────────────┘
```

### Components

| Element | Type | Behavior |
|---------|------|----------|
| Hero Carousel | Image pager | Swipe 가능, 3s auto-play |
| Heart Button | Toggle | optimistic update, rollback on error |
| Follow Button | Toggle | 동일 |
| Join FanClub CTA | Primary Button | 미가입 시 노출, 가입 후 "채팅 열기"로 변경 |
| Tabs | Segmented | 소개/스케줄/미디어 |

### States

- Loading: 스켈레톤
- Empty (no media): placeholder illustration
- Error: 재시도 버튼

### Responsive

- 모바일 세로 전용. iPad/태블릿도 세로 1컬럼.

### Telemetry

- `view_idol_detail` (idolId, source)
- `tap_heart`, `tap_follow`, `tap_join_fanclub`

---

## SCR-MOB-030: Chat Room (예시)

### Layout

```
┌───────────────────────────┐
│ ◂ [아이돌 이름]    ⚙      │
│ 쿠폰: 5/5    자동 메시지 ON│
├───────────────────────────┤
│                           │
│  [아이돌]  안녕하세요! 😊 │
│                           │
│                 [나] 반가워요 →│
│                           │
│     (타이핑 중...)         │
├───────────────────────────┤
│ [ 입력 ... ]       [전송] │
└───────────────────────────┘
```

### 상태

- **쿠폰 0 상태**: 전송 버튼 비활성 + "쿠폰 구매" 유도 배너
- **WS 연결 끊김**: 상단 토스트 "재연결 중…"
- **필터 거부**: 비속어 감지 시 말풍선 옆 경고 아이콘

### Interaction

- Long press on message → 복사, 신고
- Swipe down → 과거 메시지 페이지네이션

---

## SCR-MOB-051: Round Vote (예시)

### Layout

```
┌─────────────────────────────┐
│ ◂ 예선 3차 (D-2 12:34:56)  │
├─────────────────────────────┤
│ 보유 투표권: 32             │
│ [ + 투표권 구매 ]           │
├─────────────────────────────┤
│  [아이돌 카드 ─ 순위 노출]  │
│    현재 순위 #5  12,432표    │
│    [ -  5  + ]  [ 투표 ]   │
│ ...                         │
│                             │
├─────────────────────────────┤
│ [ 상위 10위 보기 → ]        │
└─────────────────────────────┘
```

### Rules (UI)

- 보유 투표권 0 → 투표 버튼 disabled + "투표권 구매" CTA
- 마감 D-day 00:00 이후 → 안내 모달 "종료되었습니다"

---

## SCR-CMS-021: Vote Rule Editor (CMS 예시)

### Layout (데스크톱 1280+)

```
| Left Nav |  Form Panel                     | Preview |
|          |  Round: [예선 3차 ▼]             |         |
|          |  Rules                           |  합계   |
|          |  ─ online weight [0.6]           |  1.00   |
|          |  ─ sms weight    [0.3]           |         |
|          |  ─ popularity    [0.1]           |         |
|          |  [ Save & Publish ]              |         |
```

### 검증

- 가중치 합 = 1.0 (±0.001) → 미만/초과 시 Save 비활성
- 회차 시작 이후 수정 금지(드래프트만 저장 가능)

---

## Design Tokens (디자인 토큰 — 초안)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| color.primary | #6D28D9 | #A78BFA | 브랜드 보라 |
| color.accent | #F59E0B | #FBBF24 | 하트/오디션 강조 |
| color.bg | #FFFFFF | #0B0B11 | 배경 |
| color.fg | #111827 | #E5E7EB | 본문 |
| color.danger | #EF4444 | #F87171 | 오류/경고 |
| radius.card | 16px | 16px | 카드 |
| spacing.base | 8px | | 4px 배수 |

## Accessibility (접근성)

- 터치 타겟 최소 44×44
- VoiceOver / TalkBack 레이블 필수 (버튼, 이미지)
- Dynamic Type 100–160% 지원
- 명도 대비 AA (4.5:1)
