---
document_id: A-IDOL-POLICY-1.0.0
version: 1.0.0
status: Draft
created: 2026-04-18
updated: 2026-04-18
author: Gray Kim
---

# A-idol — Policy Definition (A-아이돌 정책 정의서)

## POL-001: Chat Coupon Policy (채팅 쿠폰 정책)

- **Purpose**: 대화 쿠폰 기반 수익 구조 + 남용 방지.
- **Scope**: FR-007, FR-009, FN-041, FN-043
- **Rules**:
  1. 팬클럽 가입 시 당일 자정까지 유효한 기본 쿠폰 5매를 자동 지급 (source='daily')
  2. 매일 00:00 KST 기준 리셋 (이전일 잔량 소멸)
  3. 추가 구매 쿠폰(source='purchased')은 유효기간 30일
  4. 발송 시 'purchased' → 'daily' 순서로 차감 (유통기한 짧은 것부터)
  5. 환불된 주문의 쿠폰은 역차감. 잔여 부족 시 마이너스 허용하지 않고 이월 차감 로그만 남김.
- **Exceptions**: 운영 이슈 보상 시 CMS "쿠폰 수동 지급"(audit log 필수).

## POL-002: Vote Ticket Policy (투표권 정책)

- **Purpose**: 오디션 공정성 + 매출 극대화 균형.
- **Rules**:
  1. 투표권은 구매 패키지별 수량이 다르며 CMS에서 상품 등록
  2. 1건의 투표는 최소 1표, 최대 보유량까지
  3. 회차별 개인 상한은 기본 없음 (Phase 2에서 설정 가능)
  4. 마감 시각 이후 투표 차단, 트랜잭션 실패 시 투표권은 즉시 복구
  5. 문자/인기도 투표는 외부 연동으로 별도 기록, 가중치는 POL-004

## POL-003: Fan Club Membership Policy (팬클럽 가입 정책)

- **MVP**: 무료 가입. 탈퇴 자유.
- **Phase 2**: 유료 팬클럽(월간 구독) + 특별 굿즈 혜택.
- **제약**: 아이돌당 팬클럽 1개 공식. 비공식 팬클럽 생성 불가.

## POL-004: Vote Weighting Policy (투표 가중치 정책)

- **Default** (예선): online 1.0 / sms 0.0 / popularity 0.0
- **Default** (결선): online 0.6 / sms 0.3 / popularity 0.1
- **가중치는 CMS `VoteRule`에서 round마다 version bump. 회차 시작 후 수정 불가.
- **sum(weights) == 1.0 ± 0.001` 강제 검증.

## POL-005: Chat Content Moderation Policy (대화 모더레이션)

- 금칙어 사전(비속어/혐오/성적 표현)과 정규식 기반 1차 필터.
- 3회 위반 시 채팅 차단 24시간, 5회 위반 시 계정 정지 후 운영 검토.
- AI 아이돌 응답도 출력 검증(필터 통과 후 전송).

## POL-006: Age Policy (연령 정책)

- 만 14세 미만 가입 불가 (법정대리인 동의 요구 회피).
- 만 14세 이상 19세 미만 결제는 월 7만원 상한(문화비 제도 반영).

## POL-007: Push Notification Policy (푸시 정책)

- 필수 알림(결제, 팬클럽 자동 메시지, 오디션 마감 임박)은 수신 동의와 무관하게 발송.
- 마케팅 알림은 야간(21:00–09:00 KST) 발송 금지. 수신 동의 OFF 시 미발송.
- 푸시 템플릿 변경은 CMS 승인 워크플로우(2인 승인).

## POL-008: Data Retention Policy (데이터 보존)

- 주문/영수증: 5년
- 채팅 메시지: 2년 (이후 마스킹)
- 투표 이벤트: 영구 (집계 스냅샷만 유지, PII 제거)
- 탈퇴 유저 개인정보: 30일 후 파기 (법정 보관 항목 제외)

## POL-009: Refund Policy (환불 정책)

- 포토카드: 디지털 상품 특성상 구매 확정 후 환불 불가(스토어 정책 준수). 예외는 CMS → 승인 플로우.
- 투표권: 사용 전 환불 가능, 사용 후 불가.
- 쿠폰: 미사용분 환불 가능.

## POL-010: Admin Access Policy (관리자 접근)

- 모든 관리자 계정 MFA 필수.
- `super_admin` 수는 3명 이하 유지.
- 관리자 로그인 실패 5회 → 30분 잠금.
- 모든 쓰기 동작은 `audit_logs`에 기록.
