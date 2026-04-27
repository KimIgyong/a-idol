# 고객지원 워크플로우 (T-087)

> 지원팀이 유저 요청을 처리하는 표준 절차. RPT-260426-D Phase D T-087.
>
> 다루는 시나리오: 환불, 계정 탈퇴, 계정 복구, 신고/분쟁, 결제 이상,
> 채팅 차단/해제. **각 절차는 GA 전 PO + 법무 확인 필수**.
>
> Owner: Gray Kim · Last updated: 2026-04-27

---

## 0. 공통 원칙

### 0.1 연락 채널 + SLA

| 채널 | 첫 응답 SLA | 해결 SLA | 비고 |
|---|---|---|---|
| In-app 문의 (예정) | 1 영업일 | 3 영업일 | Phase 2에서 도입. 현 단계는 이메일만 |
| 이메일 (`support@a-idol.app`) | 1 영업일 | 3 영업일 | GA 전 메일함 + 자동 회신 설정 필요 |
| App Store / Play 리뷰 응답 | 2 영업일 | — | 별도 PO 검토 |
| 법적 통지 (등기우편 / 공문) | 즉시 | 7 영업일 | 법무 즉시 인계 |

### 0.2 Slack 채널 (내부)

GA 직후 생성:
- `#cs-tier1` — 일반 문의 (지원팀 처리)
- `#cs-tier2` — 환불 / 계정 탈퇴 / 신고 (PO + 엔지니어링 합류)
- `#cs-tier3` — 법무 / 규제 / 미디어 (PO + CTO + 법무 즉시)
- `#incident-live` — Sev-1/2 발생 시 (runbook §2.3)

### 0.3 유저 식별

- 모든 응대 시 **요청 ID(reqId)** 또는 **userId** 또는 **이메일** 중
  하나는 확인 (백엔드 로그 grep용 — runbook §1.3).
- 스크린샷의 right-bottom corner에 reqId가 출력되도록 클라이언트 표시
  (ADR-017). 첫 응답에서 "스크린샷 + 요청 ID"를 같이 받자.

---

## 1. 환불 요청 (refund)

### 1.1 분류

| 케이스 | 처리 권한 | SLA |
|---|---|---|
| Apple/Google IAP — 14일 이내 미사용 | **플랫폼 자동 처리** (App Store / Play 자체 환불). 자체 환불 불가 | 즉시 |
| Apple/Google IAP — 14일 초과 또는 일부 사용 | 사례별 PO 재량. 결제 검증 + 사용 이력 확인 후 결정 | 5 영업일 |
| 청소년 결제 한도 초과 (법정대리인 동의 미수령) | **무조건 환불** (법무 정책) | 3 영업일 |
| 결제 후 fulfillment 실패 (FAILED 트랜잭션) | **자동 환불** (system retry → 24시간 후 admin 수동) | 24h |

### 1.2 절차 (Apple / Google 14일 초과)

1. **첫 응답** — 환불 요청 접수 + 거래 ID, 요청 일시, 사유 수집.
2. **검증**:
   - `SELECT * FROM purchase_transactions WHERE id = $1 OR provider_tx_id = $2`
   - 사용 이력: `SELECT count(*) FROM photocard_drops WHERE transaction_id = $1`
   - VOTE_TICKET / CHAT_COUPON: ledger에서 잔액·사용량 확인
3. **PO 결정** — refund 승인 / 부분 환불 / 거절. Slack `#cs-tier2`에 결정 게시.
4. **승인 시** — Apple App Store Connect / Play Console 에서 수동 환불 처리.
   IAP 트랜잭션은 webhook으로 우리 DB가 `REFUNDED` 로 업데이트되면
   `RefundFulfiller` 가 잔액/카드 회수 (R-04, ADR-019 §6).
5. **거절 시** — 사유 명시 (예: "구매 후 사용 내역 확인됨"). 분쟁 시
   `#cs-tier3` 으로 escalate.

### 1.3 청소년 결제 (법정대리인 미동의)

법무 브리프 [`docs/legal/youth-payment-limit-ko.md`](../legal/youth-payment-limit-ko.md)
참조. **표시된 한도 초과 결제는 무조건 환불 + 계정 마케팅 동의 false 처리**.

---

## 2. 계정 탈퇴 (account deletion)

### 2.1 사용자 self-service (Phase 2 예정)

- 모바일 설정 → "계정 탈퇴" → 비밀번호 재인증 → 30일 grace period 시작.
- 30일 내 재로그인 시 자동 복구 (현재 미구현 — `User.status='withdrawn'`
  엔티티는 있으나 self-service flow 미연결).

### 2.2 GA 시점 운영 (수동)

이메일 요청 시 절차:

1. 본인 확인 — 등록 이메일에서 보낸 메일인지 확인 + reqId 또는 nickname 일치 확인.
2. **법무 확인** (개인정보 보호법): 필수 보유 의무 데이터 (결제 이력
   5년) 외 즉시 삭제 가능 항목 식별.
3. SQL 작업 (admin 계정으로):
   ```sql
   -- soft-delete (status withdrawn) — 회복 불가능 hard-delete 는 30일 후
   UPDATE users SET status = 'withdrawn', deleted_at = now() WHERE id = $1;
   -- 채팅/투표/하트/팔로우는 유지 (다른 유저의 leaderboard 영향 방지),
   -- 닉네임만 익명화
   UPDATE users SET nickname = '탈퇴한 회원', email = concat('deleted-', id, '@a-idol.app')
     WHERE id = $1;
   ```
4. **30일 grace 후 hard-delete** — 별도 cron 또는 admin 수동 처리. 결제
   이력은 5년 보유 (법정 의무).
5. 사용자에게 처리 완료 메일 + grace period 안내.

### 2.3 자동화 백로그

- self-service flow (UI + endpoint)
- 30일 grace cron (`scheduled-deletion.processor.ts` 신설)
- 결제 이력 5년 보유 + 그 외 PII 30일 후 삭제 분리

---

## 3. 계정 복구 (account recovery)

### 3.1 비밀번호 재설정

- **현 단계 미지원** — Phase 2 백로그. 비밀번호 분실 시 **수동**:
  1. 이메일 본인 확인
  2. admin이 임시 비번 발급 (`bcrypt` 해시 생성):
     ```bash
     pnpm --filter @a-idol/backend exec ts-node -e "
       const { hash } = require('bcrypt');
       hash('temp-password-' + Date.now(), 10).then(console.log);"
     ```
  3. SQL `UPDATE users SET password_hash = $hash WHERE email = $email`
  4. 사용자에게 임시 비번 안내 + 즉시 변경 권유 (변경 endpoint도 미구현
     상태 — Phase 2)

### 3.2 OAuth 계정 복구

- Kakao/Apple/Google — Phase 2 백로그.

---

## 4. 신고 / 분쟁

### 4.1 채팅 메시지 신고

- **Phase 2 백로그** — `Cheer.hidden`, `ChatMessage.hidden` 컬럼 추가
  (CLAUDE.md 모더레이션 정책 ADR 참조).
- **GA 시점**: 이메일로 신고 접수 → admin SQL 로 해당 row `hidden=true`
  업데이트.

### 4.2 응원댓글 신고

동일 — admin 수동 처리. 반복 신고 사용자는 `User.status='suspended'`.

---

## 5. 결제 이상

### 5.1 결제했는데 카드/티켓 미지급

1. `purchase_transactions.status` 확인:
   - `PENDING` → 24h 안에 fulfiller retry. PO 통지 후 대기.
   - `FAILED` → 자동 환불 (R-03/04). 사용자에게 환불 처리됨 안내.
   - `FULFILLED` 인데 본인 계정에 미반영 → 엔지니어링 즉시 escalate
     (Sev-2 가능성 — runbook §4.5).
2. Webhook 미도달 의심 → runbook §4.2 IAP webhook 플레이북 적용.

### 5.2 중복 청구

`provider_tx_id` 가 unique 라 중복 row 자체는 막힘 (R-03). Apple/Play
플랫폼에서 중복 차지가 발생한 경우만 가능 — 플랫폼 환불 권유.

---

## 6. 채팅 차단 / 해제

### 6.1 차단 (사용자 요청)

- "다른 유저를 차단하고 싶어요" — Phase 2 기능 미구현. **이메일 안내**:
  현재 미지원, 우회로 신고 → admin 차단 처리.

### 6.2 정지 해제

- `User.status='suspended'` 상태에서 항의 시 PO 검토 후 admin SQL `UPDATE
  users SET status = 'active'`.

### 6.3 계정 잠금 해제 (ACCOUNT_LOCKED 423)

T-082 NIST §5.2.2 lockout 정책으로 사용자가 정상 비밀번호를 잘못 쳐서 잠긴
경우 (10회/15분 카운터). 정상 운영 우회 절차:

**`POST /api/v1/admin/operators/unlock-account`** (admin role 전용):

```bash
# 본인 확인 후 admin이 호출
curl -X POST https://api.a-idol.app/api/v1/admin/operators/unlock-account \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"locked-user@x.com"}'
# → {"unlocked":true}
```

- audit log에 `actor=<admin-id> target=<email>` 자동 기록 (pino info)
- Redis `login:fail:{email}` 카운터 즉시 삭제 → 다음 로그인 정상 처리
- 사용자에게 처리 완료 알림 + 비밀번호 재설정 안내 (현재 self-service 미지원
  → §3.1 임시 비번 발급 절차)

---

## 7. Escalation 트리

```
유저 문의 (이메일/in-app)
  ├─ 환불 (자명한 정책)        → Tier 1 (지원팀 단독)
  ├─ 환불 (재량 / 14일 초과)   → Tier 2 (PO 합류)
  ├─ 결제 이상 (FAILED 등)     → Tier 2 (PO + 엔지)
  ├─ 결제 이상 (FULFILLED 미반영) → Tier 2 + Sev-2 incident (runbook §4.5)
  ├─ 계정 탈퇴 / PII             → Tier 2 (PO + 법무 cc)
  ├─ 신고 / 분쟁 (개별)         → Tier 1 (admin 수동 hide)
  ├─ 신고 / 분쟁 (대량)         → Tier 2 (PO + 모더레이션 정책 검토)
  ├─ 청소년 결제 / 법정대리인  → Tier 3 (법무 즉시)
  ├─ 언론 / 규제 질의           → Tier 3 (법무 + CTO + PO)
  └─ Sev-1 incident (계정 탈취 등) → runbook §2.2
```

---

## 8. 응대 템플릿 (한국어)

### 8.1 첫 응답 (환불)

> 안녕하세요, A-idol 지원팀입니다.
>
> 환불 요청을 받았습니다. 정확한 처리를 위해 다음 정보를 회신해주시면
> 감사하겠습니다:
>
> 1. 결제 일시 (대략적으로도 OK)
> 2. 결제하신 상품명
> 3. App Store 또는 Google Play 결제 영수증 (이메일 영수증 화면 캡쳐)
> 4. 환불 요청 사유
>
> 영업일 기준 5일 이내 결과를 안내드리겠습니다.
>
> ※ 결제 후 14일이 지나지 않았다면, 각 스토어(App Store / Google Play)의
> 자체 환불 절차가 가장 빠릅니다. 도움이 필요하시면 회신해주세요.

### 8.2 첫 응답 (계정 탈퇴)

> 안녕하세요, A-idol 지원팀입니다.
>
> 계정 탈퇴 요청을 받았습니다. 처리 전 다음을 확인해주세요:
>
> 1. 이 이메일 주소가 A-idol 가입 이메일과 동일하신가요? (보안 확인용)
> 2. 30일 grace period 안내: 탈퇴 처리 후 30일 안에 같은 이메일로 다시
>    로그인하시면 자동 복구됩니다.
> 3. 결제 이력은 법정 의무로 5년 보유됩니다 (개인정보 보호법). 그 외
>    개인정보는 30일 후 영구 삭제됩니다.
>
> 회신 주시면 처리 진행하겠습니다. 처리 완료 후 알림 메일 보내드립니다.

### 8.3 첫 응답 (결제했는데 미반영)

> 안녕하세요, A-idol 지원팀입니다.
>
> 결제 후 상품이 미반영된 건으로 확인 도와드리겠습니다. 다음 정보를
> 회신 주세요:
>
> 1. 결제 일시 + 상품명
> 2. App Store / Play 영수증 캡쳐
> 3. 앱에서 받은 거래 ID (있는 경우, 또는 화면 캡쳐의 우측 하단 요청 ID)
>
> 일반적으로 결제 후 1~2분 내 반영되며, 24시간 이상 지연되는 경우가
> 거의 없습니다. 즉시 확인 후 안내드리겠습니다.

---

## 9. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-27 | 초안 작성 (T-087 stub). 환불 / 탈퇴 / 복구 / 결제 이상 / 신고 / 채팅 차단 6 카테고리 + escalation 트리 + 3 응대 템플릿. **GA 전 PO + 법무 검수 필수**. |
