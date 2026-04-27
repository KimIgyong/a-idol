---
document_id: A-IDOL-FUNC-2.0.0
version: 2.0.0
status: Draft
created: 2026-04-15
updated: 2026-04-17
author: Project Owner
reviewers: []
convention: Amoeba Code Convention v2
change_log:
  - version: 2.0.0
    date: 2026-04-17
    author: Project Owner
    description: "코드 컨벤션 v2 전면 적용: API 경로 kebab-case, DTO snake_case/camelCase, Entity 프로퍼티 camelCase, 에러코드 E-코드 체계, 파일명 kebab-case"
  - version: 1.0.0
    date: 2026-04-15
    author: Project Owner
    description: Initial draft
---

# A-idol — 기능 정의서 v2.0.0

> **목적**: 각 기능의 구현 방식 — 비즈니스 로직, 데이터 흐름, 에러 코드, 개발자 레벨 상세를 명세한다.
> Backend + Frontend 개발의 1차 계약 문서.
>
> **Convention 기준**: Amoeba Code Convention v2
> - API: `/api/v1/{resource}` — resource는 **kebab-case**
> - Request DTO: **snake_case**
> - Response DTO: **camelCase**
> - Entity property: **camelCase** (DB column → camelCase 매핑)
> - Error Code: **E{category}{seq}** 체계

---

## 파일 구조 규약

```
apps/api/src/
├── auth/
│   ├── auth.controller.ts       ← kebab-case
│   ├── auth.service.ts
│   ├── auth.repository.ts
│   ├── auth.module.ts
│   ├── dto/
│   │   ├── social-login.request.ts    ← {action}-{domain}.request.ts
│   │   └── auth.response.ts           ← {domain}.response.ts
│   └── entities/
│       └── refresh-token.entity.ts
├── idol/
│   ├── idol.controller.ts
│   ├── idol.service.ts
│   ├── idol.mapper.ts           ← Mapper static 패턴
│   └── dto/
│       ├── create-idol.request.ts
│       └── idol.response.ts
├── fan-club/
│   ├── fan-club.controller.ts
│   ├── fan-club-membership.controller.ts
│   └── ...
├── chat/
├── audition/
├── photo-card/
│   ├── photo-card.controller.ts
│   └── ...
└── purchase/
    ├── purchase.controller.ts
    └── ...
```

---

## FN-001 — 소셜 로그인 & JWT 발급

**파일**: `auth.controller.ts` / `auth.service.ts`

### API

```
POST /api/v1/auth/{provider}
```

- `provider`: `kakao` | `apple` | `google` | `email`

### Request DTO (`social-login.request.ts`)

```typescript
export class SocialLoginRequest {
  @IsString() @IsNotEmpty()
  code: string;           // OAuth 인가 코드 (snake_case)
}
```

### Response DTO (`auth.response.ts`)

```typescript
export class AuthResponse {
  accessToken: string;    // camelCase
  refreshToken: string;
  user: {
    userId: string;
    nickname: string;
    isNewUser: boolean;
  };
}
```

### JWT Payload

```typescript
interface JwtPayload {
  sub: string;            // usr_id (UUID)
  role: 'USER' | 'ADMIN' | 'AGENCY_MANAGER';
  iat: number;
  exp: number;
}
```

### 처리 흐름

```
1. POST /api/v1/auth/{provider}  Body: { code }
2. provider OAuth 서버에서 access_token 교환 (server-to-server)
3. provider에서 유저 프로필 조회 (email, provider_id, profile_image_url)
4. aidol_users 테이블 UPSERT
   WHERE usr_provider = $1 AND usr_provider_id = $2
5. access_token 발급 (JWT, 1h TTL)
6. refresh_token 발급 (opaque, 30d TTL)
   → aidol_refresh_tokens 에 rtk_token_hash 저장
7. Response: AuthResponse
```

### Token Refresh

```
POST /api/v1/auth/refresh
Body: { refresh_token: string }

→ rtk_token_hash 검증 → 신규 access_token 발급
```

### 에러 코드

| 코드 | HTTP | 조건 |
|------|------|------|
| E1001 | 400 | OAuth code 무효 또는 만료 |
| E1002 | 401 | refresh_token 없음 또는 만료 |
| E1003 | 403 | 계정 정지(SUSPENDED) |
| E1004 | 409 | 닉네임 중복 (프로필 설정) |

---

## FN-002 — 아이돌 목록 & 상세

**파일**: `idol.controller.ts` / `idol.service.ts` / `idol.mapper.ts`

### API

```
GET  /api/v1/idols                  ← 목록
GET  /api/v1/idols/:idolId          ← 상세
POST /api/v1/idols/:idolId/likes    ← 좋아요 토글
POST /api/v1/idols/:idolId/follows  ← 팔로우 토글
```

### Request DTO (`get-idols.request.ts`)

```typescript
export class GetIdolsRequest {
  @IsOptional() @IsString()
  search_keyword?: string;      // 검색어

  @IsOptional() @IsUUID()
  agency_id?: string;           // 소속사 필터

  @IsOptional() @IsInt() @Min(1)
  page?: number;

  @IsOptional() @IsInt() @Min(1) @Max(50)
  page_size?: number;
}
```

### Response DTO (`idol.response.ts`)

```typescript
export class IdolResponse {
  idolId: string;           // idl_id → camelCase
  agencyId: string;         // agc_id
  stageName: string;        // idl_stage_name
  realName: string | null;
  birthday: string | null;
  debutDate: string | null;
  conceptTags: string[];
  bioKr: string | null;
  displayOrder: number;
  likeCount: number;
  followCount: number;
  status: string;
  isLikedByMe: boolean;     // 현재 유저 좋아요 여부
  isFollowedByMe: boolean;  // 현재 유저 팔로우 여부
  createdAt: string;
}
```

### Mapper (`idol.mapper.ts`)

```typescript
export class IdolMapper {
  static toResponse(entity: IdolEntity, likedByMe = false, followedByMe = false): IdolResponse {
    return {
      idolId:        entity.idlId,
      agencyId:      entity.agcId,
      stageName:     entity.idlStageName,
      realName:      entity.idlRealName,
      birthday:      entity.idlBirthday,
      debutDate:     entity.idlDebutDate,
      conceptTags:   entity.idlConceptTags,
      bioKr:         entity.idlBioKr,
      displayOrder:  entity.idlDisplayOrder,
      likeCount:     entity.idlLikeCount,
      followCount:   entity.idlFollowCount,
      status:        entity.idlStatus,
      isLikedByMe:   likedByMe,
      isFollowedByMe: followedByMe,
      createdAt:     entity.idlCreatedAt.toISOString(),
    };
  }
}
```

### 좋아요 토글 로직

```
BEGIN TRANSACTION
  SELECT uil_id FROM aidol_user_idol_likes
  WHERE usr_id = $1 AND idl_id = $2 FOR UPDATE

  IF exists:
    DELETE FROM aidol_user_idol_likes WHERE usr_id=$1 AND idl_id=$2
    UPDATE aidol_idols SET idl_like_count = idl_like_count - 1 WHERE idl_id=$2
    liked = false
  ELSE:
    INSERT INTO aidol_user_idol_likes (usr_id, idl_id)
    UPDATE aidol_idols SET idl_like_count = idl_like_count + 1 WHERE idl_id=$2
    liked = true
COMMIT

RETURN { liked, likeCount }
```

### 팔로우 부수 효과

```typescript
// 팔로우 시
FCMService.subscribeToTopic(udtDeviceToken, `aidol:idol:${idlId}`);

// 언팔로우 시
FCMService.unsubscribeFromTopic(udtDeviceToken, `aidol:idol:${idlId}`);
// aidol_user_device_tokens 에서 udt_device_token 조회
```

### 에러 코드

| 코드 | HTTP | 조건 |
|------|------|------|
| E5001 | 404 | 아이돌 없음 또는 비활성 |

---

## FN-003 — 팬클럽 게이트 & 멤버십

**파일**: `fan-club.controller.ts` / `fan-club-membership.controller.ts`

### API

```
GET  /api/v1/fan-clubs              ← 목록 (내가 가입한)
POST /api/v1/fan-clubs/:fanClubId/join   ← 가입
DELETE /api/v1/fan-clubs/:fanClubId/join ← 탈퇴 (soft delete)
```

### Request DTO

```typescript
// join-fan-club.request.ts
export class JoinFanClubRequest {
  // 추가 파라미터 없음 — fanClubId는 path parameter
}
```

### Response DTO

```typescript
// fan-club.response.ts
export class FanClubResponse {
  fanClubId: string;       // fcl_id
  idolId: string;          // idl_id
  name: string;            // fcl_name
  description: string | null;
  thumbnailUrl: string | null;
  memberCount: number;
  status: string;
  isMember: boolean;       // 현재 유저 가입 여부
}
```

### WebSocket 연결 게이트 체크

```typescript
// chat.gateway.ts
async handleConnection(socket: Socket): Promise<void> {
  const token    = socket.handshake.auth.token;
  const user     = this.jwtService.verify<JwtPayload>(token);
  const fcClId   = socket.handshake.query.fan_club_id as string;  // query: snake_case

  const membership = await this.db.query(
    `SELECT fcm_id FROM aidol_fan_club_memberships
     WHERE usr_id = $1 AND fcl_id = $2 AND fcm_deleted_at IS NULL`,
    [user.sub, fanClubId]
  );

  if (!membership) {
    socket.emit('error', { code: 'E3001', message: '팬클럽 멤버만 이용 가능합니다' });
    socket.disconnect();
    return;
  }

  await socket.join(`aidol:fanclub:${fanClubId}:user:${user.sub}`);
}
```

### 에러 코드

| 코드 | HTTP | 조건 |
|------|------|------|
| E3001 | 403 | 팬클럽 미가입 (채팅 접근) |
| E5010 | 404 | 팬클럽 없음 |
| E5011 | 409 | 이미 가입된 팬클럽 |

---

## FN-004 — 채팅 쿼터 & 쿠폰

**파일**: `chat.service.ts` / `chat.gateway.ts`

### 쿼터 차감 로직

```typescript
// chat.service.ts
async checkAndDeductQuota(usrId: string, idlId: string): Promise<QuotaResult> {
  const today  = formatKST(new Date(), 'YYYY-MM-DD');
  const key    = `aidol:quota:${usrId}:${idlId}:${today}`;

  const config = await this.db.findOne(IdolChatConfigEntity, {
    where: { idlId },                            // Entity property: camelCase
  });

  const current = parseInt(await this.redis.get(key) ?? '0');

  if (current >= config.iccDailyQuota) {         // icc_daily_quota → iccDailyQuota
    // 쿠폰 차감 시도
    const result = await this.db.transaction(async (em) => {
      const updated = await em
        .createQueryBuilder()
        .update(UserEntity)
        .set({ usrCouponBalance: () => 'usr_coupon_balance - 1' })
        .where('usr_id = :id AND usr_coupon_balance > 0', { id: usrId })
        .returning('usr_coupon_balance')
        .execute();

      if (updated.affected === 0) throw new QuotaExhaustedError();
      return updated.raw[0];
    });

    return { deducted: 'COUPON', remainingCoupons: result.usr_coupon_balance };
  }

  // Redis 쿼터 차감
  const pipeline = this.redis.multi();
  pipeline.incr(key);
  pipeline.expireat(key, getMidnightKSTUnix());
  await pipeline.exec();

  return {
    deducted: 'QUOTA',
    remaining: config.iccDailyQuota - current - 1,
  };
}
```

### 자동 메시지 스케줄러

```typescript
// chat-scheduler.service.ts

@Cron('50 7,14,21 * * *', { timeZone: 'Asia/Seoul' })
async sendAutoMessages(): Promise<void> {
  const slot = detectSlot();   // 'MORNING' | 'AFTERNOON' | 'NIGHT'
  const configs = await this.idolChatConfigRepo.findWithAutoMessage(slot);

  for (const config of configs) {
    await this.queue.add('auto-message', {
      idlId:  config.idlId,
      fcClId: config.idol.fanClub.fclId,
      slot,
      message: config.iccAutoMessages[slot],
    });
  }
}

// Worker: insert + Socket.io broadcast
// msg_message_type = 'AUTO', msg_is_excluded_quota = TRUE
```

### 에러 코드

| 코드 | HTTP | 조건 |
|------|------|------|
| E3002 | 429 | 일일 쿼터 + 쿠폰 모두 소진 |
| E3003 | 409 | 쿠폰 차감 동시성 충돌 |

---

## FN-005 — IAP 검증 & 크레딧 지급

**파일**: `purchase.controller.ts` / `purchase.service.ts`

### API

```
POST /api/v1/purchases/verify-iap
```

### Request DTO (`verify-iap.request.ts`)

```typescript
export class VerifyIapRequest {
  @IsIn(['IOS', 'ANDROID'])
  platform: 'IOS' | 'ANDROID';               // snake_case value OK

  @IsString() @IsNotEmpty()
  signed_transaction: string;                // iOS StoreKit 2

  @IsString() @IsNotEmpty()
  sku: string;

  @IsIn(['CHAT_COUPON', 'VOTE_TICKET', 'PHOTOCARD_PULL'])
  product_type: string;

  @IsOptional() @IsObject()
  context?: {
    round_id?: string;                       // 투표권 구매 시 필수
    set_id?: string;                         // 포토카드 구매 시 필수
  };
}
```

### Response DTO (`purchase.response.ts`)

```typescript
export class PurchaseResponse {
  success: boolean;
  productType: string;         // camelCase
  creditedAmount: number;
  newBalance: number;
  transactionId: string;
}
```

### 처리 흐름

```typescript
// purchase.service.ts
async verifyIap(usrId: string, req: VerifyIapRequest): Promise<PurchaseResponse> {
  // 1. 멱등성 체크
  const idempotencyKey = sha256(req.signed_transaction);
  const existing = await this.purchaseRepo.findByIdempotencyKey(idempotencyKey);
  if (existing) return PurchaseMapper.toResponse(existing);   // 200 OK 재반환

  // 2. 영수증 검증 (iOS / Android 분기)
  const verified = await this.iapService.verify(req.platform, req.signed_transaction, req.sku);
  if (!verified) throw new AppException('E5020');

  // 3. 크레딧 지급 (트랜잭션)
  return this.db.transaction(async (em) => {
    // aidol_purchase_transactions INSERT
    await em.save(PurchaseTransactionEntity, {
      usrId,
      ptrPlatform:        req.platform,
      ptrTransactionId:   verified.transactionId,
      ptrIdempotencyKey:  idempotencyKey,
      ptrSku:             req.sku,
      ptrProductType:     req.product_type,
      ptrAmountKrw:       verified.amountKrw,
      ptrIsConsumed:      false,
      ptrStatus:          'COMPLETED',
      ptrContext:         req.context ?? {},
    });

    // 상품 타입별 크레딧 처리
    switch (req.product_type) {
      case 'CHAT_COUPON':
        await em.increment(UserEntity, { usrId }, 'usrCouponBalance', verified.qty);
        break;
      case 'VOTE_TICKET':
        await em.upsert(VotingTicketBalanceEntity,
          { usrId, rndId: req.context?.round_id, vtbQty: verified.qty },
          ['usrId', 'rndId']);
        break;
      case 'PHOTOCARD_PULL':
        // 트랜잭션 기록만 — 실제 가챠는 FN-007에서 처리
        break;
    }
  });
}
```

### 에러 코드

| 코드 | HTTP | 조건 |
|------|------|------|
| E5020 | 502 | IAP 영수증 검증 실패 |
| E5021 | 200 | 멱등성 — 이미 처리된 영수증 (정상 재반환) |

---

## FN-006 — 투표 & 가중치 점수 계산

**파일**: `audition.controller.ts` / `vote.service.ts`

### API

```
POST /api/v1/auditions/rounds/:roundId/votes   ← 투표 캐스팅
GET  /api/v1/auditions/rounds/:roundId/ranks   ← 실시간 순위
```

### Request DTO (`cast-vote.request.ts`)

```typescript
export class CastVoteRequest {
  @IsUUID()
  idol_id: string;               // snake_case

  @IsInt() @Min(1)
  vote_count: number;

  @IsIn(['ONLINE', 'SMS', 'POPULARITY'])
  vote_type: string;
}
```

### Response DTO (`vote.response.ts`)

```typescript
export class VoteResponse {
  success: boolean;
  remainingTickets: number;      // camelCase
  idolCurrentRank: number;
}
```

### 투표 처리 로직

```typescript
// vote.service.ts
async castVote(usrId: string, rndId: string, req: CastVoteRequest): Promise<VoteResponse> {
  // 1. 검증
  const round = await this.roundRepo.findActiveOrFail(rndId);
  if (round.rndStatus !== 'ACTIVE') throw new AppException('E5030');

  const voteTypeConf = await this.voteTypeConfigRepo.findOrFail(rndId, req.vote_type);
  if (!voteTypeConf) throw new AppException('E5031');

  // 투표권 잔고 확인
  const balance = await this.ticketBalanceRepo.findBalance(usrId, rndId);
  if ((balance?.vtbQty ?? 0) < req.vote_count) throw new AppException('E5032');

  // 2. DB Write (트랜잭션)
  await this.db.transaction(async (em) => {
    await em.save(VoteEntity, {
      usrId,
      idlId:       req.idol_id,
      rndId,
      votCount:    req.vote_count,
      votVoteType: req.vote_type,
    });

    const affected = await em
      .createQueryBuilder()
      .update(VotingTicketBalanceEntity)
      .set({ vtbQty: () => `vtb_qty - ${req.vote_count}` })
      .where('usr_id = :usrId AND rnd_id = :rndId AND vtb_qty >= :count',
             { usrId, rndId, count: req.vote_count })
      .execute();

    if (affected.affected === 0) throw new AppException('E5033');  // concurrent conflict
  });

  // 3. Redis 비동기 업데이트
  await this.redis.zincrby(
    `aidol:idol_rank:${rndId}:${req.vote_type}`,
    req.vote_count,
    req.idol_id,
  );

  const newBalance = await this.ticketBalanceRepo.findBalance(usrId, rndId);
  const rank = await this.redis.zrevrank(`aidol:idol_rank:${rndId}`, req.idol_id);

  return { success: true, remainingTickets: newBalance?.vtbQty ?? 0, idolCurrentRank: (rank ?? 0) + 1 };
}
```

### 가중치 점수 계산 (라운드 종료 시)

```typescript
async calculateFinalScores(rndId: string): Promise<void> {
  const weightConfigs = await this.voteTypeConfigRepo.findByRound(rndId);
  const voteTotals = await this.db.query(`
    SELECT idl_id, vot_vote_type, SUM(vot_count) AS total
    FROM aidol_votes
    WHERE rnd_id = $1
    GROUP BY idl_id, vot_vote_type
  `, [rndId]);

  const scores: Record<string, number> = {};
  for (const row of voteTotals) {
    const conf   = weightConfigs.find(c => c.vtcVoteType === row.vot_vote_type);
    const weight = conf?.vtcWeight ?? 0;
    scores[row.idl_id] = (scores[row.idl_id] ?? 0) + row.total * weight;
  }

  const ranked = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const threshold = await this.auditionRepo.getAdvanceThreshold(rndId);

  for (const [i, [idlId, score]] of ranked.entries()) {
    await this.entryRepo.updateScoreAndRank(idlId, rndId, score, i + 1,
      i < threshold ? 'ADVANCED' : 'ELIMINATED');
  }
}
```

### 에러 코드

| 코드 | HTTP | 조건 |
|------|------|------|
| E5030 | 400 | 라운드가 ACTIVE 아님 |
| E5031 | 400 | 해당 round에 vote_type 미설정 |
| E5032 | 400 | 투표권 부족 |
| E5033 | 409 | 동시성 충돌 (투표권 차감 실패) |
| E5034 | 400 | 가중치 합계 ≠ 1.0 (±0.001 허용) |

---

## FN-007 — 포토카드 가챠

**파일**: `photo-card.controller.ts` / `photo-card.service.ts`

### API

```
POST /api/v1/photo-cards/pull        ← 가챠 실행
GET  /api/v1/photo-cards/sets        ← 세트 목록
GET  /api/v1/photo-cards/my          ← 내 컬렉션
```

### Request DTO (`pull-photo-card.request.ts`)

```typescript
export class PullPhotoCardRequest {
  @IsUUID()
  set_id: string;                         // pcs_id

  @IsUUID()
  purchase_transaction_id: string;        // ptr_id
}
```

### Response DTO (`photo-card.response.ts`)

```typescript
export class PhotoCardResponse {
  photoCardId: string;   // pcd_id → camelCase
  cardName: string;
  imageUrl: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC';
  setName: string;
  idolName: string;
  slotIndex: number;
}
```

### 가챠 처리 로직

```typescript
// photo-card.service.ts
async pullPhotoCard(usrId: string, req: PullPhotoCardRequest): Promise<PhotoCardResponse> {
  // 1. 구매 트랜잭션 검증
  const purchase = await this.purchaseRepo.findByIdOrFail(req.purchase_transaction_id);
  if (purchase.usrId !== usrId) throw new AppException('E1010');
  if (purchase.ptrProductType !== 'PHOTOCARD_PULL') throw new AppException('E5040');
  if (purchase.ptrIsConsumed) throw new AppException('E5041');

  // 2. 포토카드 세트 로드 (12장 확인)
  const cards = await this.photoCardRepo.findBySet(req.set_id);  // pcs_id
  if (cards.length !== 12) throw new AppException('E9001');

  // 3. 서버사이드 CSPRNG (Node.js crypto)
  const selectedIndex = crypto.randomInt(0, 12);
  const selected = cards[selectedIndex];

  // 4. 지급 트랜잭션
  await this.db.transaction(async (em) => {
    // aidol_user_photocards UPSERT
    await em
      .createQueryBuilder()
      .insert()
      .into(UserPhotocardEntity)
      .values({
        usrId,
        pcdId: selected.pcdId,
        upcCountOwned: 1,
      })
      .onConflict('(usr_id, pcd_id) DO UPDATE SET upc_count_owned = upc_count_owned + 1, upc_last_acquired_at = NOW()')
      .execute();

    // ptr_is_consumed = TRUE
    await em.update(PurchaseTransactionEntity,
      { ptrId: req.purchase_transaction_id },
      { ptrIsConsumed: true });
  });

  return PhotoCardMapper.toResponse(selected);
}
```

### 에러 코드

| 코드 | HTTP | 조건 |
|------|------|------|
| E5040 | 400 | 구매 타입 불일치 |
| E5041 | 400 | 이미 소비된 구매 트랜잭션 |
| E9001 | 500 | 포토카드 세트 구성 오류 (12장 아님) |

---

## FN-008 — 실시간 채팅 (WebSocket)

**파일**: `chat.gateway.ts` / `chat.service.ts`

### WS 이벤트 명세

| 방향 | Event | Payload | 설명 |
|------|-------|---------|------|
| Client → Server | `send_message` | `{ fan_club_id, content }` | snake_case query param |
| Server → Client | `message_received` | `{ id, sender, content, timestamp, quotaRemaining }` | camelCase |
| Server → Client | `quota_exhausted` | `{ couponBalance }` | camelCase |
| Server → Client | `auto_message` | `{ id, sender, content, timestamp, isAuto: true }` | camelCase |
| Server → Client | `error` | `{ code: 'E3001', message }` | E-코드 체계 |

### 연결 라이프사이클

```
CLIENT                          SERVER (chat.gateway.ts)
  │─── connect ──────────────────► FN-003 게이트 체크
  │                                socket.join(`aidol:fanclub:{fclId}:user:{usrId}`)
  │◄── chat_init ─────────────────  { history, quota, couponBalance }   ← camelCase
  │
  │─── send_message ─────────────► FN-004 쿼터 체크
  │      { fan_club_id, content }  INSERT aidol_chat_messages
  │◄── message_received ──────────  { id, sender:'USER', content, timestamp, quotaRemaining }
  │                                AI 답변 Job 큐잉 (BullMQ)
  │◄── message_received ──────────  { id, sender:'IDOL', content, timestamp }
  │
  │─── disconnect ───────────────► leave room (cleanup 불필요)
```

### AI 답변 생성 (OI-002 — Phase별 분기)

```typescript
// Phase 1: Rule-based
// icc_response_templates JSONB에서 키워드 매칭
const template = config.iccResponseTemplates.find(t => content.includes(t.keyword));

// Phase 2: Claude API
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  system: `You are ${idol.idlStageName}, a K-pop idol.
           Personality: ${traits.personality}.
           Speech style: ${traits.speechStyle}.
           Always reply in Korean. Max 80 chars.`,
  messages: [{ role: 'user', content }],
  max_tokens: 100,
});
```

---

## FN-009 — 관리자: 오디션 라운드 라이프사이클

**파일**: `audition.controller.ts` / `audition-round.service.ts`

### API (Admin)

```
POST /api/v1/admin/auditions                            ← 오디션 생성
POST /api/v1/admin/auditions/rounds/:roundId/activate   ← 라운드 활성화
POST /api/v1/admin/auditions/rounds/:roundId/finalize   ← 라운드 확정
GET  /api/v1/admin/auditions/rounds/:roundId/results    ← 라운드 결과
```

### 라운드 상태 머신

```
PENDING → ACTIVE → CLOSED → FINALIZED

PENDING:   생성; 투표 미시작
ACTIVE:    투표 창 오픈; 투표 수락
CLOSED:    투표 창 종료; 점수 계산 완료; 관리자 확정 대기
FINALIZED: 관리자 확정; 결과 발행; FCM 알림 발송
```

### Cron 스케줄러

```typescript
// audition-scheduler.service.ts
@Cron('*/5 * * * *')
async checkRoundExpiry(): Promise<void> {
  const expiredRounds = await this.db.query(`
    SELECT rnd_id, aud_id FROM aidol_audition_rounds
    WHERE rnd_status = 'ACTIVE' AND rnd_end_at <= NOW()
  `);

  for (const round of expiredRounds) {
    await this.voteService.calculateFinalScores(round.rnd_id);
    await this.roundRepo.updateStatus(round.rnd_id, 'CLOSED');
    this.adminWsGateway.notifyRoundClosed(round.aud_id, round.rnd_id);
  }
}
```

### Request DTO (Admin) (`activate-round.request.ts`)

```typescript
export class ActivateRoundRequest {
  @IsISO8601()
  start_at: string;     // snake_case

  @IsISO8601()
  end_at: string;
}
```

---

## FN-010 — 통계 집계

**파일**: `stats.controller.ts` / `stats.service.ts`

### API (Admin)

```
GET /api/v1/admin/stats/votes?round_id={id}
GET /api/v1/admin/stats/overview
GET /api/v1/admin/stats/photo-cards?idol_id={id}
```

### Response DTO (`vote-stats.response.ts`)

```typescript
export class VoteStatsResponse {
  idolId: string;
  stageName: string;
  voteType: string;
  voteTotal: number;
  weightedContribution: number;
  finalScore: number | null;
  rank: number | null;
}
```

### SQL

```sql
-- vote stats query
SELECT
  i.idl_id        AS idol_id,
  i.idl_stage_name AS stage_name,
  v.vot_vote_type  AS vote_type,
  SUM(v.vot_count) AS vote_total,
  SUM(v.vot_count) * vtc.vtc_weight AS weighted_contribution,
  iae.iae_final_score AS final_score,
  iae.iae_rank        AS rank
FROM aidol_votes v
JOIN aidol_idols i
  ON v.idl_id = i.idl_id
JOIN aidol_vote_type_configs vtc
  ON vtc.rnd_id = v.rnd_id AND vtc.vtc_vote_type = v.vot_vote_type
LEFT JOIN aidol_idol_audition_entries iae
  ON iae.idl_id = v.idl_id AND iae.rnd_id = v.rnd_id
WHERE v.rnd_id = $1
GROUP BY i.idl_id, v.vot_vote_type, vtc.vtc_weight, iae.iae_final_score, iae.iae_rank
ORDER BY iae.iae_rank ASC, v.vot_vote_type ASC;
```

---

## FN-011 — 팬 레벨 & XP

**파일**: `user-level.service.ts` / `xp.service.ts`

### API

```
GET  /api/v1/users/me/level         ← 내 레벨·XP·스트릭 조회
GET  /api/v1/users/me/xp-history    ← XP 획득 이력
GET  /api/v1/fan-levels             ← 전체 레벨 기준 목록
POST /api/v1/internal/xp/grant      ← XP 지급 (서버 내부 호출)
```

### Response DTO (`user-level.response.ts`)

```typescript
export class UserLevelResponse {
  currentLevel: number;          // flv_level
  levelName: string;             // flv_name_kr
  totalXp: number;               // uls_total_xp
  nextLevelRequiredXp: number;   // 다음 레벨 flv_required_xp
  loginStreak: number;           // uls_login_streak
  maxStreak: number;
  lastLoginDate: string | null;
}
```

### XP 지급 로직

```typescript
// xp.service.ts
async grantXp(usrId: string, activity: XpActivityType, refId?: string): Promise<void> {
  const config = await this.xpConfigRepo.findByActivity(activity);
  if (!config || !config.xacIsActive) return;

  // 일일 한도 체크 (Redis)
  if (config.xacDailyLimit) {
    const today   = formatKST(new Date(), 'YYYY-MM-DD');
    const limitKey = `aidol:xp:daily:${usrId}:${activity}:${today}`;
    const current  = parseInt(await this.redis.get(limitKey) ?? '0');
    if (current >= config.xacDailyLimit) return;
    await this.redis.incr(limitKey);
    await this.redis.expireat(limitKey, getMidnightKSTUnix());
  }

  // 쿨다운 체크
  if (config.xacCooldownSeconds > 0) {
    const coolKey = `aidol:xp:cool:${usrId}:${activity}`;
    const onCooldown = await this.redis.exists(coolKey);
    if (onCooldown) return;
    await this.redis.setex(coolKey, config.xacCooldownSeconds, '1');
  }

  // XP 지급 + 레벨업 체크 (트랜잭션)
  await this.db.transaction(async (em) => {
    // xp_transactions INSERT
    await em.save(XpTransactionEntity, {
      usrId,
      xptXpAmount: config.xacXpPerAction,
      xptActivity: activity,
      xptRefId: refId ?? null,
    });

    // user_level_stats XP 누적
    await em
      .createQueryBuilder()
      .update(UserLevelStatEntity)
      .set({ ulsTotalXp: () => `uls_total_xp + ${config.xacXpPerAction}` })
      .where('usr_id = :usrId', { usrId })
      .execute();

    // 레벨업 판정
    await this.checkAndLevelUp(em, usrId);
  });
}
```

---

## 에러 코드 레지스트리 (Convention v2)

> **체계**: `E{category}{3자리 seq}`
> - E1xxx: 인증/인가 (Auth)
> - E2xxx: 유저 (User)
> - E3xxx: 채팅 (Chat)
> - E4xxx: AI/쿼터 (AI Quota)
> - E5xxx: 도메인 (Domain — Idol, FanClub, Audition, Photocard, Purchase)
> - E9xxx: 시스템 (System)

| 코드 | HTTP | 모듈 | 설명 |
|------|------|------|------|
| **E1001** | 400 | Auth | OAuth code 무효 또는 만료 |
| **E1002** | 401 | Auth | refresh_token 없음 또는 만료 |
| **E1003** | 403 | Auth | 계정 정지 (SUSPENDED) |
| **E1004** | 409 | Auth | 닉네임 중복 (프로필 설정) |
| **E1010** | 403 | Auth | 리소스 소유자 불일치 |
| **E2001** | 404 | User | 유저 없음 |
| **E2002** | 400 | User | 닉네임 형식 오류 (2~20자) |
| **E3001** | 403 | Chat | 팬클럽 미가입 (채팅 접근 불가) |
| **E3002** | 429 | Chat | 일일 쿼터 + 쿠폰 모두 소진 |
| **E3003** | 409 | Chat | 쿠폰 차감 동시성 충돌 |
| **E4010** | 429 | AI Quota | AI 일일 응답 횟수 초과 |
| **E4011** | 429 | AI Quota | AI 월간 응답 횟수 초과 |
| **E5001** | 404 | Idol | 아이돌 없음 또는 비활성 |
| **E5002** | 400 | Idol | 아이돌 수 상한 도달 (99명) |
| **E5010** | 404 | FanClub | 팬클럽 없음 |
| **E5011** | 409 | FanClub | 이미 가입된 팬클럽 |
| **E5020** | 502 | Purchase | IAP 영수증 검증 실패 |
| **E5021** | 200 | Purchase | 멱등성 — 이미 처리된 영수증 |
| **E5025** | 400 | Admin | 가중치 합계 ≠ 1.0 |
| **E5030** | 400 | Audition | 라운드가 ACTIVE 상태 아님 |
| **E5031** | 400 | Audition | vote_type 해당 라운드 미설정 |
| **E5032** | 400 | Audition | 투표권 부족 |
| **E5033** | 409 | Audition | 투표권 차감 동시성 충돌 |
| **E5034** | 400 | Audition | 가중치 합계 유효성 오류 |
| **E5040** | 400 | PhotoCard | 구매 타입 불일치 |
| **E5041** | 400 | PhotoCard | 이미 소비된 구매 트랜잭션 |
| **E9001** | 500 | System | 포토카드 세트 구성 오류 |
| **E9010** | 500 | System | 데이터베이스 오류 |
| **E9011** | 503 | System | 외부 서비스 연결 실패 |

---

## API 경로 전체 목록

| Method | Path | 파일 | 설명 |
|--------|------|------|------|
| POST | `/api/v1/auth/{provider}` | `auth.controller.ts` | 소셜 로그인 |
| POST | `/api/v1/auth/refresh` | `auth.controller.ts` | 토큰 갱신 |
| DELETE | `/api/v1/auth/logout` | `auth.controller.ts` | 로그아웃 |
| GET | `/api/v1/idols` | `idol.controller.ts` | 아이돌 목록 |
| GET | `/api/v1/idols/:idolId` | `idol.controller.ts` | 아이돌 상세 |
| POST | `/api/v1/idols/:idolId/likes` | `idol.controller.ts` | 좋아요 토글 |
| POST | `/api/v1/idols/:idolId/follows` | `idol.controller.ts` | 팔로우 토글 |
| GET | `/api/v1/fan-clubs` | `fan-club.controller.ts` | 팬클럽 목록 |
| POST | `/api/v1/fan-clubs/:fanClubId/join` | `fan-club.controller.ts` | 팬클럽 가입 |
| DELETE | `/api/v1/fan-clubs/:fanClubId/join` | `fan-club.controller.ts` | 팬클럽 탈퇴 |
| WS | `/chat` | `chat.gateway.ts` | 채팅 WebSocket |
| POST | `/api/v1/purchases/verify-iap` | `purchase.controller.ts` | IAP 검증 & 크레딧 |
| GET | `/api/v1/auditions` | `audition.controller.ts` | 오디션 목록 |
| GET | `/api/v1/auditions/:auditionId/rounds` | `audition.controller.ts` | 라운드 목록 |
| POST | `/api/v1/auditions/rounds/:roundId/votes` | `audition.controller.ts` | 투표 캐스팅 |
| GET | `/api/v1/auditions/rounds/:roundId/ranks` | `audition.controller.ts` | 실시간 순위 |
| GET | `/api/v1/photo-cards/sets` | `photo-card.controller.ts` | 포토카드 세트 목록 |
| POST | `/api/v1/photo-cards/pull` | `photo-card.controller.ts` | 포토카드 가챠 |
| GET | `/api/v1/photo-cards/my` | `photo-card.controller.ts` | 내 컬렉션 |
| GET | `/api/v1/users/me/level` | `user-level.controller.ts` | 내 레벨·XP 조회 |
| GET | `/api/v1/users/me/xp-history` | `user-level.controller.ts` | XP 이력 |
| GET | `/api/v1/fan-levels` | `fan-level.controller.ts` | 레벨 기준 목록 |
| POST | `/api/v1/admin/agencies` | `agency.controller.ts` | 소속사 등록 |
| POST | `/api/v1/admin/idols` | `admin-idol.controller.ts` | 아이돌 등록 |
| PATCH | `/api/v1/admin/idols/:idolId` | `admin-idol.controller.ts` | 아이돌 수정 |
| POST | `/api/v1/admin/photo-card-sets` | `admin-photo-card.controller.ts` | 포토카드 세트 등록 |
| POST | `/api/v1/admin/auditions` | `admin-audition.controller.ts` | 오디션 생성 |
| POST | `/api/v1/admin/auditions/rounds/:roundId/activate` | `admin-audition.controller.ts` | 라운드 활성화 |
| POST | `/api/v1/admin/auditions/rounds/:roundId/finalize` | `admin-audition.controller.ts` | 라운드 확정 |
| GET | `/api/v1/admin/stats/votes` | `stats.controller.ts` | 투표 통계 |
| GET | `/api/v1/admin/stats/overview` | `stats.controller.ts` | 전체 통계 |
