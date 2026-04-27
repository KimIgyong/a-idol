---
document_id: A-IDOL-LEVEL-1.0.0
version: 1.0.0
status: Draft
created: 2026-04-15
updated: 2026-04-15
author: Project Owner (Claude)
reviewers: []
---

# A-idol — Fan User Level Policy (팬 유저 레벨 정책)

---

## 1. Research Summary — Reference Systems (레퍼런스 시스템 조사)

### 1-1. Game Level Systems (게임 레벨 시스템)

| 게임/서비스 | 레벨 방식 | XP 획득 방법 | 레벨업 혜택 | 특징 |
|-------------|-----------|-------------|------------|------|
| **D&D / RPG Classic** | 지수형(Exponential) 누적 XP | 전투 승리, 퀘스트 완료, 이벤트 참여 | 스탯 상승, 스킬 언락 | 레벨이 높을수록 XP 요구량 급격 증가 |
| **Pokémon** | 완만한 지수 곡선 | 배틀, 이벤트 | 능력치 성장 | 수많은 캐릭터 운용 → 완만한 곡선 채택 |
| **World of Warcraft** | 지수형 + 확장팩 리셋 | 퀘스트, 던전, 전투 | 장비 해금, 콘텐츠 접근 | 레벨 cap 주기적 상향; 스탯 스쿼시 |
| **Disgaea** | 단계별 상승 (아이템도 레벨 보유) | 다양한 행동 | 아이템·스킬 강화 | 레벨 객체가 캐릭터 외에도 다수 존재 |

**핵심 원칙:** 레벨업은 ① 성취감 보상, ② 도전의 정당성 제공, ③ 콘텐츠 잠금 해제의 3가지 기능을 동시에 수행해야 한다.

---

### 1-2. Community / Platform Level Systems (커뮤니티/플랫폼 레벨)

| 플랫폼 | 레벨 방식 | XP 획득 방법 | 혜택 | 특징 |
|--------|-----------|-------------|------|------|
| **Discord (MEE6 Bot)** | XP 누적 → 자동 역할 부여 | 채팅 메시지, 음성 채널 참여 (스팸 방지 쿨다운 적용) | 전용 역할(뱃지), 채널 접근권 | 1분 쿨다운으로 스팸 방지 |
| **Reddit** | 카르마(Karma) 점수 | 게시글/댓글 추천 | 전용 플레어, 서브레딧 접근 | 레벨 없이 점수 기반; 하락 가능 |
| **DMarket Discord** | 8단계 랭크 | 메시지 당 7~12 XP 랜덤 | 거래 보너스, 전용 채널, 이벤트 접근 | 랭크별 혜택 차등화 명확 |
| **YouTube** | 구독자 기반 배지 (New/Bronze/Silver/Gold/Diamond) | 구독, 멤버십 기간 | 전용 이모지, 배지 | 멤버십 유지 기간 = 레벨 |

---

### 1-3. K-pop Fan Platform Level Systems (K-pop 팬 플랫폼 레벨)

| 플랫폼 | 레벨 방식 | XP 획득 | 혜택 | 특징 |
|--------|-----------|---------|------|------|
| **Bubble (SM Entertainment)** | 구독 일수 카운터 (하트 아이콘) | 구독 유지 일수 | 팬 신뢰도·친밀감 표현 | 구독 취소 시 카운터 정지; 복귀 시 재시작 |
| **Weverse (HYBE)** | 멤버십 등급 (일반/Premium) | 구독료 지불 | 독점 콘텐츠, DM 접근 | 유료 구독 기반; 수익화 비판 있음 |
| **Universe** | 포인트 + 멤버십 | 활동, 유료 구독 | 채팅, 콘텐츠 열람 | 게임화 요소 강조 |

---

### 1-4. Gamification Research Insights (게임화 연구 인사이트)

- <cite>앱에 게임화를 적용하면 평균 20~30% 높은 사용자 참여도</cite>를 기록 (Statista 2024)
- 리더보드·레벨 등 소셜 요소가 있는 앱은 세션 지속률이 최대 60% 향상
- **핵심 원칙**: 게임화는 "유저가 이미 하고 싶은 행동"을 증폭시킬 때 효과적. 억지로 새 행동을 유도하면 역효과
- 일일 스트릭(연속 출석)은 장기 습관 형성에 가장 강력한 동기 부여 메커니즘
- 레벨에 의미가 있으려면 **달성 난이도(XP 요구량)와 보상이 비례**해야 함

---

## 2. A-idol Fan Level Policy Proposal (에이아이돌 팬 레벨 정책 제안)

### 2-1. Design Principles (설계 원칙)

1. **K-pop 팬 문화 반영**: 레벨명을 팬덤 용어로 명명 → 정체성·소속감 강화
2. **다중 XP 소스**: 단일 행동(구매)에만 의존하지 않고 다양한 활동에서 XP 획득
3. **지수형 XP 곡선**: 초반은 빠른 성취감, 후반은 진성 팬만 도달하는 희소성
4. **실질적 혜택**: 레벨업 시 실제 기능이 열리는 Tangible 혜택 설계
5. **스팸 방지**: 일일 XP 획득 상한선으로 과도한 어뷰징 차단

---

### 2-2. Level Table (레벨 테이블)

| 레벨 | 명칭 | 별칭 | 누적 XP | 전 레벨 대비 필요 XP | 예상 도달 기간 |
|------|------|------|---------|-------------------|--------------|
| Lv. 1 | 뉴팬 (New Fan) | 🌱 | 0 | — | 가입 즉시 |
| Lv. 2 | 팬 (Fan) | ⭐ | 500 | 500 | 약 2주 |
| Lv. 3 | 진성팬 (True Fan) | ⭐⭐ | 1,500 | 1,000 | 약 1개월 |
| Lv. 4 | 팬클러버 (Fan Clubber) | 💜 | 3,500 | 2,000 | 약 2개월 |
| Lv. 5 | 서포터 (Supporter) | 💜💜 | 7,000 | 3,500 | 약 3.5개월 |
| Lv. 6 | 코어팬 (Core Fan) | 💎 | 13,000 | 6,000 | 약 6개월 |
| Lv. 7 | 마스터팬 (Master Fan) | 💎💎 | 22,000 | 9,000 | 약 9개월 |
| Lv. 8 | 레전드팬 (Legend Fan) | 👑 | 36,000 | 14,000 | 약 1년 |
| Lv. 9 | 다이아팬 (Diamond Fan) | 👑👑 | 56,000 | 20,000 | 약 1.5년 |
| Lv.10 | 아이돌메이커 (Idol Maker) | 🌟 | 84,000 | 28,000 | 약 2년 |

**XP 곡선 수식**: `required_xp(n) = 500 × (n-1) × 1.35^(n-2)` (n = 목표 레벨)

---

### 2-3. XP Earning Activities (XP 획득 활동)

| 활동 | XP | 일 최대 한도 | 비고 |
|------|----|------------|------|
| 일일 로그인 | 10 XP | 10 XP | 매일 최초 로그인 시 |
| 연속 로그인 보너스 (스트릭) | +5 XP/일 | +50 XP | 7일, 30일 스트릭 시 추가 보너스 |
| 채팅 메시지 발송 | 5 XP/회 | 50 XP | AI 아이돌 채팅; 5분 쿨다운 스팸 방지 |
| 투표권 구매 | 20 XP | 100 XP | 구매 건당 부여 |
| 투표 행사 | 10 XP/표 | 100 XP | 라운드당 최대 한도 |
| 포토카드 구매 (가챠) | 30 XP | 150 XP | 1회 뽑기 당 |
| 팬클럽 가입 | 50 XP | — | 아이돌 1명당 최초 가입 시 1회 |
| 프로필 완성 | 100 XP | — | 닉네임+이미지 모두 설정 시 1회 |
| 좋아요 | 2 XP | 20 XP | 아이돌 좋아요 |
| 팔로우 | 5 XP | 25 XP | 아이돌 팔로우 |
| **일일 최대 XP** | — | **~505 XP** | 이론 최대치; 현실적 평균 약 100~200 XP |

---

### 2-4. Level Benefits (레벨별 혜택)

| 레벨 | 혜택 |
|------|------|
| **Lv. 1 뉴팬** | 기본 기능 전체 이용 |
| **Lv. 2 팬** | 레벨 뱃지 표시 / 채팅 쿼터 +1회/일 (기본 5 → 6) |
| **Lv. 3 진성팬** | 포토카드 뽑기 5% 할인 쿠폰 (월 1회) |
| **Lv. 4 팬클러버** | 전용 프로필 프레임 / 채팅 쿼터 +1회 (→ 7) |
| **Lv. 5 서포터** | 오디션 투표권 5% 할인 / 전용 채팅 이모티콘 해금 |
| **Lv. 6 코어팬** | 포토카드 신규 세트 출시 24시간 얼리 액세스 / 채팅 쿼터 +2회 (→ 9) |
| **Lv. 7 마스터팬** | 전용 골드 프레임 / 오디션 결과 발표 5분 선공개 알림 |
| **Lv. 8 레전드팬** | 1:1 고객지원 우선 응대 / 채팅 쿠폰 월 2개 무료 지급 |
| **Lv. 9 다이아팬** | 오디션 결선 특별 관람 이벤트 응모권 / 채팅 쿼터 +3회 (→ 12) |
| **Lv.10 아이돌메이커** | 아이돌 메이커 전용 뱃지 / 연간 오프라인 팬 이벤트 초대권 우선 배정 / 한정판 포토카드 세트 선구매권 |

---

### 2-5. Special Mechanic — Fan Streak (팬 스트릭)

연속 로그인 일수를 별도로 추적하여 XP 보너스 외 시각적 표시 제공:

| 연속 일수 | 스트릭 이름 | 추가 혜택 |
|-----------|------------|----------|
| 7일 | 일주일 팬 | 🔥 스트릭 아이콘 + 채팅 쿠폰 1개 |
| 30일 | 한 달 팬 | 🔥🔥 + 포토카드 뽑기 1회 무료 |
| 100일 | 100일 팬 | 🏆 특별 배지 + 투표권 3매 |
| 365일 | 연간 팬 | 👑 전설 배지 + 레벨업 XP 2배 (1주일) |

---

### 2-6. Level Badge Display (레벨 뱃지 노출 위치)

- 채팅 화면: AI 아이돌과의 채팅창 상단 유저 닉네임 옆
- 프로필 화면: MY Page 프로필 이미지 우측 하단 오버레이
- 팬클럽 멤버 목록: 닉네임 옆 소형 뱃지
- 투표 참여 시: 투표 완료 화면의 "나의 레벨" 표시

---

### 2-7. Anti-Abuse Rules (어뷰징 방지 규칙)

| 규칙 | 내용 |
|------|------|
| 채팅 XP 쿨다운 | 동일 유저, 동일 아이돌 채팅방에서 5분 내 재발송 XP 미지급 |
| 일일 활동 XP 상한 | 활동별 일일 최대 한도 적용 (위 표 참조) |
| 부정 행위 탐지 | 비정상적인 XP 급등 탐지 시 24h 정지 및 관리자 검토 |
| 레벨 하락 없음 | 한번 달성한 레벨은 강등 없음 (팬 충성도 존중) |
| 계정 공유 금지 | 동일 IP 다중 계정 적발 시 XP 초기화 |

---

## 3. DB Schema Addition (DB 스키마 추가)

```sql
-- 레벨 기준 테이블
CREATE TABLE fan_levels (
  level         INTEGER PRIMARY KEY,    -- 1~10
  name_kr       VARCHAR(20) NOT NULL,   -- '뉴팬', '팬', ...
  name_en       VARCHAR(30) NOT NULL,   -- 'New Fan', 'Fan', ...
  required_xp   INTEGER NOT NULL,       -- 누적 XP 기준
  badge_image_url TEXT,
  description   TEXT,
  chat_quota_bonus INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 유저 레벨/XP 테이블
CREATE TABLE user_level_stats (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  current_level   INTEGER NOT NULL DEFAULT 1 REFERENCES fan_levels(level),
  total_xp        INTEGER NOT NULL DEFAULT 0,
  login_streak    INTEGER NOT NULL DEFAULT 0,
  max_streak      INTEGER NOT NULL DEFAULT 0,
  last_login_date DATE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- XP 이력 테이블 (감사 로그)
CREATE TABLE xp_transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  xp_amount   INTEGER NOT NULL,
  activity    VARCHAR(50) NOT NULL,  -- 'DAILY_LOGIN', 'CHAT', 'VOTE', 'PHOTOCARD_PULL', ...
  ref_id      UUID,                  -- 연관 엔티티 ID (선택적)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_user_level_stats_user ON user_level_stats(user_id);
CREATE INDEX idx_xp_transactions_user ON xp_transactions(user_id, created_at DESC);

-- XP 획득 설정 (관리자가 CMS에서 조정 가능)
CREATE TABLE xp_activity_configs (
  activity    VARCHAR(50) PRIMARY KEY,
  xp_per_action INTEGER NOT NULL,
  daily_limit INTEGER,                -- NULL = 무제한
  cooldown_seconds INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 데이터 삽입
INSERT INTO xp_activity_configs VALUES
  ('DAILY_LOGIN',      10,  10,   0,    true, NOW()),
  ('LOGIN_STREAK',      5,  50,   0,    true, NOW()),
  ('CHAT_MESSAGE',      5,  50,   300,  true, NOW()),  -- 5분 쿨다운
  ('VOTE_TICKET_BUY',  20, 100,   0,    true, NOW()),
  ('VOTE_CAST',        10, 100,   0,    true, NOW()),
  ('PHOTOCARD_PULL',   30, 150,   0,    true, NOW()),
  ('FANCLUB_JOIN',     50,  NULL, 0,    true, NOW()),
  ('PROFILE_COMPLETE',100,  NULL, 0,    true, NOW()),
  ('IDOL_LIKE',         2,  20,   0,    true, NOW()),
  ('IDOL_FOLLOW',       5,  25,   0,    true, NOW());

INSERT INTO fan_levels VALUES
  (1,  '뉴팬',      'New Fan',       0,      NULL, '가입한 모든 팬', 0),
  (2,  '팬',        'Fan',           500,    NULL, '활동을 시작한 팬', 1),
  (3,  '진성팬',    'True Fan',      1500,   NULL, '꾸준히 활동하는 팬', 1),
  (4,  '팬클러버',  'Fan Clubber',   3500,   NULL, '팬클럽의 핵심 멤버', 1),
  (5,  '서포터',    'Supporter',     7000,   NULL, '아이돌을 적극 응원하는 팬', 2),
  (6,  '코어팬',    'Core Fan',      13000,  NULL, '플랫폼의 중심 팬', 2),
  (7,  '마스터팬',  'Master Fan',    22000,  NULL, '오랜 팬 경력의 마스터', 2),
  (8,  '레전드팬',  'Legend Fan',    36000,  NULL, '전설적인 팬 활동 기록', 3),
  (9,  '다이아팬',  'Diamond Fan',   56000,  NULL, '다이아몬드급 충성도', 3),
  (10, '아이돌메이커','Idol Maker',  84000,  NULL, '아이돌을 만드는 최정상 팬', 3);
```

---

## 4. API Endpoints Addition (API 추가)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /users/me/level | 내 레벨·XP·스트릭 조회 |
| GET | /users/me/xp-history | XP 획득 이력 (페이지네이션) |
| GET | /fan-levels | 전체 레벨 기준 목록 조회 |
| POST | /xp/grant | XP 지급 (내부 서버 간 호출) |
| GET | /admin/stats/level-distribution | 레벨별 유저 분포 통계 (Admin) |
