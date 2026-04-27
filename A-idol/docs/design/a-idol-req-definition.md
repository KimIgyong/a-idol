---
document_id: A-IDOL-REQ-DEF-1.0.0
version: 1.0.0
status: Draft
created: 2026-04-18
updated: 2026-04-18
author: Gray Kim
---

# A-idol — Requirements Definition (A-아이돌 요구사항 정의서)

각 요구사항(FR)의 입력/출력/비즈니스 룰/인수 조건을 명시한다. 분석서의 요약과 달리 이 문서는 "구현 가능한 수준"의 상세 명세다.

---

## FR-001: Email & Social Sign-up/Login (회원가입·로그인)

- **설명**: 신규 사용자는 이메일 또는 Apple / Google / Kakao 계정으로 가입·로그인한다.
- **Input**: `{ provider: 'email'|'apple'|'google'|'kakao', token?|email/password }`, 약관동의 스냅샷
- **Output**: `{ accessToken, refreshToken, user: { id, nickname, avatarUrl } }`
- **Business Rules**:
  - 만 14세 미만은 가입 불가 (POL-006)
  - 동일 provider + providerId 중복 불가
  - 이메일 계정은 인증 메일 발송 후 6h 유효
  - 탈퇴 후 30일 내 재가입 시 기존 ID 복원 선택 가능
- **Acceptance Criteria**:
  - [ ] 정상 가입 → 이후 로그인 성공 (토큰 유효)
  - [ ] 중복 이메일 → 409 Conflict
  - [ ] 만 14세 미만 생년월일 → 422 UnderAge
  - [ ] 소셜 취소 → 400 OAuthCancelled
- **Related**: NFR-006, NFR-008, POL-006

---

## FR-003 / FR-004: Idol Profile List & Heart (아이돌 프로필 + 좋아요)

- **설명**: 로그인 사용자는 99명 아이돌 목록/상세를 열람하고, 아이돌에 좋아요를 등록/해제한다.
- **Input**: 목록 `{ page, size, sort }`, 상세 `{ idolId }`, 좋아요 `{ idolId }`
- **Output**: 페이지네이션 목록(이미지, 이름, 하트 수 등), 상세(프로필, 미디어, 팔로우 여부, 좋아요 여부)
- **Business Rules**:
  - 좋아요는 유저당 아이돌 1회만 유효 (unique(user_id, idol_id))
  - 좋아요 집계는 비정형 카운터 컬럼 + 주기 재계산 (배치)
- **Acceptance**:
  - [ ] 1000 RPS 목록 조회 시 p95 < 300ms (NFR-001)
  - [ ] 중복 좋아요 시 멱등 응답
- **Related**: FR-005, NFR-001

---

## FR-005: Follow Idol (팔로우)

- **설명**: 사용자는 아이돌을 팔로우·언팔로우한다. 팔로우한 아이돌의 업데이트는 홈 피드에 노출된다.
- **Input**: `{ idolId, op: 'follow'|'unfollow' }`
- **Output**: `{ followingIdolIds: [...] }`
- **Rules**: 팔로우 수 제한 없음. 피드는 최근 30일 이내 포스트를 시간순.
- **Acceptance**:
  - [ ] 팔로우 → 피드에 해당 아이돌 포스트 등장
  - [ ] 언팔로우 → 피드에서 사라짐

---

## FR-006: Join Fan Club (팬클럽 가입)

- **설명**: 아이돌 1인당 공식 팬클럽 1개에 가입/탈퇴한다. 팬클럽 가입이 1:1 채팅의 전제 조건.
- **Input**: `{ fanClubId }`
- **Output**: `{ membershipId, joinedAt }`
- **Rules**:
  - 유저는 여러 팬클럽 동시 가입 가능
  - 무료/유료 여부는 POL-003 (MVP: 무료)
  - 탈퇴 시 진행 중 채팅 쿠폰은 유지 (기간 만료일까지)
- **Acceptance**:
  - [ ] 팬클럽 가입 후 채팅 탭에서 아이돌 채팅방 노출
  - [ ] 탈퇴 후 재가입은 제한 없음

---

## FR-007 / FR-008 / FR-009: 1:1 Idol Chat (채팅)

- **설명**: 팬클럽 가입자는 아이돌과 1:1 채팅한다. 1일 기본 5회 대화 쿠폰 + 자동 메시지 3회(무차감).
- **Input (Send)**: `{ roomId, text }` → WebSocket `chat:send`
- **Output**: `{ messageId, sentAt, remainingCoupons }`
- **Rules**:
  - 자동 메시지 템플릿(굿모닝/굿나잇/뭐해요?)은 CMS에서 스케줄된 발송, 쿠폰 차감 X
  - 유저 발송 1건 = 쿠폰 1매 차감. 아이돌 응답은 AI 응답 생성기(Phase 2)에 따라 다름, MVP에서는 사전 정의된 응답 풀에서 매칭
  - 부적절 어휘(비속어 사전) 필터링, 위반 시 거절 + 신고 플래그
  - 쿠폰 소진 시 추가 구매 안내 모달
- **Acceptance**:
  - [ ] WebSocket 메시지 배달 지연 < 1s (NFR-002)
  - [ ] 쿠폰 0개 상태에서 발송 시 402 Paywall
  - [ ] 자동 메시지는 쿠폰에 영향 X

---

## FR-010 / FR-011 / FR-012: Photo Card (포토카드)

- **설명**: 사용자는 아이돌 포토카드 세트(12종)에서 1종 랜덤 구매한다. 중복 포함 가능.
- **Input**: `{ setId }` + 결제 영수증
- **Output**: `{ ownedCardId, rarity, duplicateCount }`
- **Rules**:
  - 1 세트 = 12장 중 1장 랜덤 (균등 랜덤, 추후 가중치 — POL-004)
  - 중복 시 "컬렉션 포인트" 적립 (Phase 2)
  - 인스타그램 공유는 OS Share API, 워터마크 포함 이미지 생성
- **Acceptance**:
  - [ ] 결제 영수증 검증 통과 → 카드 발급 트랜잭션 원자성 보장
  - [ ] 공유 시 아이돌 이름 + A-idol 로고 워터마크 포함

---

## FR-013 / FR-014 / FR-015 / FR-016: Audition Voting (오디션/투표)

- **설명**: 10차 예선 + 결선 오디션에 회차별 투표한다. 투표권은 패키지 구매로 복수 획득 가능.
- **Input (Cast)**: `{ roundId, idolId, amount }`
- **Output**: `{ remaining, rankSnapshot }`
- **Rules**:
  - 예선: 온라인 투표만 (가중치 1.0)
  - 결선: 온라인 + 문자 + 인기도 가중 합산 — 가중치는 CMS(FR-105)에서 설정
  - 투표권은 ISO 단위로 표현, 1인 최대 투표량은 보유량 내 무제한
  - 회차별 시작/종료 시각 엄수 (서버 시계 기준)
  - 집계 지연 허용: 실시간 근사치(Redis counter) + 5분 주기 정합성 집계(배치)
- **Acceptance**:
  - [ ] 마감 1초 전 투표는 수용, 마감 후는 409 Closed
  - [ ] 순위는 상위 10위 + 사용자 지지 아이돌 표시

---

## FR-017: Push Notification (푸시)

- **설명**: 필수(결제/채팅/투표)와 마케팅(공지) 푸시 구분. 옵트인 상태 관리.
- **Input**: 토큰 등록 `{ token, platform }`
- **Output**: N/A
- **Rules**:
  - 마케팅 푸시는 야간 9pm–9am 금지 (POL-007)
  - 토큰 갱신 시 이전 토큰 비활성화
- **Acceptance**:
  - [ ] 수신 동의 OFF → 마케팅 푸시 미발송, 결제 푸시는 발송

---

## FR-018: Purchase History (결제 이력)

- **Input**: `{ range }` (기간)
- **Output**: 주문 목록 `{ orderId, item, amount, status, receiptUrl }`
- **Rules**: 개인정보보호법 — 5년 보관, 영수증 스토어 링크 병기.

---

## CMS Functional Requirements (FR-101 ~ FR-110)

### FR-102: Idol Profile Management (CMS)
- **Input**: 이미지 업로드(Pre-signed S3), 프로필 필드, 캐릭터 설정(JSON)
- **Output**: `Idol` 엔티티 생성/수정
- **Rules**: 비공개 → 공개 전환은 `publish_at` 예약 가능. 생성 후 모바일 반영 TTL 60s (cache).
- **Acceptance**: 편집 후 60초 이내 앱에 반영.

### FR-104: Audition Round Design (CMS)
- **Input**: 회차별 `{ startAt, endAt, quotaPass, ruleSetId }`, 진출자 결정 조건
- **Output**: `Audition`, `Round` 엔티티
- **Rules**: 회차는 순차적이며, 다음 회차 시작 전 이전 회차 종료 필수. 진출자는 상위 N 또는 수동 지정.

### FR-105: Vote Rule & Weight (CMS)
- **Input**: 투표 종류(online/sms/popularity) 각각의 가중치, 적용 회차
- **Output**: `VoteRule` 엔티티
- **Rules**: 가중치 합 = 1.0 검증. 회차 시작 이후 변경 금지(수정 시 새 버전 생성).

### FR-107: Dashboard (CMS)
- **Input**: 기간, 대상 아이돌, 지표
- **Output**: 투표·매출·유저 통계, CSV 내보내기
- **Rules**: 집계는 5분 지연 허용. 대시보드 접근은 RBAC로 제한.

---

## Traceability Matrix (추적성)

| FR | FN | Screen | Sequence | Tables | TC |
|----|----|--------|----------|--------|-----|
| FR-001 | FN-011 | SCR-MOB-001 | SEQ-001 | users, auth_sessions | TC-001..004 |
| FR-003 | FN-021 | SCR-MOB-010 | SEQ-002 | idols, idol_media | TC-010..012 |
| FR-004 | FN-022 | SCR-MOB-011 | SEQ-003 | hearts | TC-015 |
| FR-005 | FN-023 | SCR-MOB-012 | SEQ-003 | follows | TC-016 |
| FR-006 | FN-031 | SCR-MOB-020 | SEQ-004 | fan_clubs, memberships | TC-020 |
| FR-007..009 | FN-041..043 | SCR-MOB-030 | SEQ-005 | chat_rooms, chat_messages, chat_coupons | TC-030..035 |
| FR-010..012 | FN-051..053 | SCR-MOB-040 | SEQ-006 | photo_card_sets, user_cards, orders | TC-040..043 |
| FR-013..016 | FN-061..064 | SCR-MOB-050 | SEQ-007 | auditions, rounds, votes, vote_rules | TC-050..055 |
| FR-017 | FN-071 | — | SEQ-008 | push_tokens, notifications | TC-060 |
| FR-102 | FN-102 | SCR-CMS-010 | — | idols | TC-101 |
| FR-104 | FN-104 | SCR-CMS-020 | — | auditions, rounds | TC-104 |
| FR-105 | FN-105 | SCR-CMS-021 | — | vote_rules | TC-105 |
| FR-107 | FN-107 | SCR-CMS-030 | — | (views) | TC-107 |
