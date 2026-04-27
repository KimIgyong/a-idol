// Cross-package DTO contracts. These are the wire shapes returned by the backend
// and consumed by the mobile app / CMS / tests.

export interface UserDto {
  id: string;
  email: string | null;
  nickname: string;
  avatarUrl: string | null;
  provider: 'email' | 'apple' | 'google' | 'kakao';
  status: 'active' | 'suspended' | 'withdrawn';
  /** PIPA/PDPA 마케팅 수신 동의. SCR-004 / 설정 화면에서 사용자 토글. */
  marketingOptIn: boolean;
  /** 푸시 알림 수신 동의. */
  pushOptIn: boolean;
  createdAt: string; // ISO timestamp
}

/**
 * `PATCH /api/v1/me` 본문. 사용자 자기 자신의 프로필/동의 필드만 업데이트.
 * 닉네임/생년월일/이메일은 회원가입 시 fix되며 본 endpoint로 변경 불가
 * (관리자 도구로만). SCR-004(가입 직후 추가 정보 수집) + 설정 화면에서 사용.
 *
 * ADR-023 — Request body 는 snake_case (amb-starter-kit v2.0 표준).
 */
export interface UpdateUserMeDto {
  avatar_url?: string | null;
  marketing_opt_in?: boolean;
  push_opt_in?: boolean;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponseDto extends AuthTokensDto {
  user: UserDto;
}

// -- Admin (CMS) -----------------------------------------------------------

export type AdminRole = 'admin' | 'operator' | 'viewer';

export type AdminStatus = 'active' | 'suspended';

export interface AdminUserDto {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  status: AdminStatus;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminAuthResponseDto extends AuthTokensDto {
  user: AdminUserDto;
}

export interface IdolCardDto {
  id: string;
  name: string;
  stageName: string | null;
  heroImageUrl: string | null;
  heartCount: number;
  followCount: number;
  publishedAt: string | null;
}

export type IdolImageType =
  | 'hero'
  | 'portrait'
  | 'editorial'
  | 'lifestyle'
  | 'emotional'
  | 'concept'
  | 'headshot'
  | 'character_sheet'
  | (string & {});

/**
 * 응원댓글 (RPT-260426-C P2 SCR-006). Author hydrated server-side.
 */
export interface CheerDto {
  id: string;
  idolId: string;
  message: string;
  createdAt: string; // ISO timestamp
  author: {
    userId: string;
    nickname: string;
    avatarUrl: string | null;
  };
}

export interface CreateCheerDto {
  /** 200자 이하 텍스트. backend는 trim 후 1자 이상 검증. */
  message: string;
}

export interface IdolImageDto {
  id: string;
  imageType: IdolImageType;
  imageUrl: string;
  sortOrder: number;
  isApproved: boolean;
}

/**
 * Full idol detail. `profile` mirrors the seed JSON under
 * packages/backend/prisma/seeds/*-profile.json (conceptSeed, coreIdentity,
 * deepProfile, narrative, faceVector). Its shape is deliberately typed as
 * `unknown` here so clients validate with a schema they own instead of
 * inheriting an unstable contract.
 */
export interface IdolDetailDto {
  id: string;
  agencyId: string;
  name: string;
  stageName: string | null;
  birthdate: string | null; // ISO date
  mbti: string | null;
  bio: string | null;
  heroImageUrl: string | null;
  heartCount: number;
  followCount: number;
  publishedAt: string | null;
  profile: unknown | null;
  images: IdolImageDto[];
}

export interface PaginatedResponseDto<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

export interface HealthResponseDto {
  status: 'ok' | 'degraded';
  version: string;
  uptimeSeconds: number;
  timestamp: string;
  db: 'up' | 'down';
  redis: 'up' | 'down';
}

// -- Fandom (hearts / follows) -------------------------------------------

export interface HeartToggleResponseDto {
  idolId: string;
  hearted: boolean;
  heartCount: number;
}

export interface FollowToggleResponseDto {
  idolId: string;
  following: boolean;
  followCount: number;
}

// -- Fan Club / Membership -----------------------------------------------

export interface FanClubDto {
  id: string;
  idolId: string;
  tier: string;
  price: number; // KRW; 0 = free for MVP
  memberCount: number;
  createdAt: string;
}

export interface FanClubStatusDto {
  fanClub: FanClubDto;
  isMember: boolean;
  joinedAt: string | null;
}

export interface MembershipDto {
  id: string;
  fanClubId: string;
  idolId: string;
  tier: string;
  joinedAt: string;
  leftAt: string | null;
}

// -- Admin Catalog --------------------------------------------------------

export interface AgencyDto {
  id: string;
  name: string;
  description: string | null;
  idolCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgencyDto {
  name: string;
  description?: string | null;
}

export interface UpdateAgencyDto {
  name?: string;
  description?: string | null;
}

/**
 * Full idol record for CMS. Unlike the public `IdolDetailDto` this exposes
 * soft-deleted / unpublished idols and always includes the agency name.
 */
export interface AdminIdolDto {
  id: string;
  agencyId: string;
  agencyName: string;
  name: string;
  stageName: string | null;
  birthdate: string | null;
  mbti: string | null;
  bio: string | null;
  heroImageUrl: string | null;
  heartCount: number;
  followCount: number;
  publishedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ADR-023 — Request body 는 snake_case (amb-starter-kit v2.0).
export interface UpdateIdolDto {
  name?: string;
  stage_name?: string | null;
  mbti?: string | null;
  bio?: string | null;
  hero_image_url?: string | null;
  birthdate?: string | null; // ISO date (YYYY-MM-DD)
  agency_id?: string;
}

export interface CreateIdolDto {
  agency_id: string;
  name: string;
  stage_name?: string | null;
  mbti?: string | null;
  bio?: string | null;
  hero_image_url?: string | null;
  birthdate?: string | null; // ISO date
  publish_immediately?: boolean;
}

export type IdolScheduleType =
  | 'BROADCAST'
  | 'CONCERT'
  | 'FANMEETING'
  | 'STREAMING'
  | 'OTHER';

export interface IdolScheduleDto {
  id: string;
  idolId: string;
  type: IdolScheduleType;
  title: string;
  location: string | null;
  startAt: string; // ISO
  endAt: string | null; // ISO
  notes: string | null;
  createdAt: string;
}

export interface CreateScheduleDto {
  type?: IdolScheduleType;
  title: string;
  location?: string | null;
  start_at: string;
  end_at?: string | null;
  notes?: string | null;
}

// -- Chat ----------------------------------------------------------------

export type ChatSenderType = 'user' | 'idol';

export interface ChatRoomDto {
  id: string;
  idolId: string;
  userId: string;
  createdAt: string;
  lastMessageAt: string | null;
}

export interface ChatMessageDto {
  id: string;
  roomId: string;
  senderType: ChatSenderType;
  content: string;
  createdAt: string;
}

export interface SendChatMessageDto {
  content: string;
}

// -- Chat Quota & Coupons ------------------------------------------------

export type CouponReason =
  | 'ADMIN_GRANT'
  | 'PURCHASE'
  | 'MESSAGE_CONSUME'
  | 'REFUND'
  | 'DAILY_GIFT';

export interface ChatBalanceDto {
  dailyLimit: number;
  messagesToday: number;
  remainingFreeMessages: number;
  couponBalance: number;
  /** Next lazy-reset moment (midnight KST) as ISO timestamp. */
  nextResetAt: string;
}

export interface ChatCouponLedgerEntryDto {
  delta: number;
  reason: CouponReason;
  balanceAfter: number;
  memo: string | null;
  createdAt: string;
}

export interface GrantCouponDto {
  delta: number;
  reason?: CouponReason;
  memo?: string;
}

// -- Auto-message templates (admin-authored broadcasts) -----------------

export type AutoMessageStatus = 'SCHEDULED' | 'DISPATCHED' | 'CANCELED' | 'FAILED';

export interface AutoMessageTemplateDto {
  id: string;
  idolId: string;
  idolName: string;
  title: string;
  content: string;
  scheduledAt: string;
  dispatchedAt: string | null;
  status: AutoMessageStatus;
  recipients: number;
  failedReason: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CreateAutoMessageDto {
  idolId: string;
  title: string;
  content: string;
  scheduledAt: string;
}

// -- Audition / Round ---------------------------------------------------

export type AuditionStatus = 'DRAFT' | 'ACTIVE' | 'FINISHED' | 'CANCELED';
export type RoundStatus = 'SCHEDULED' | 'ACTIVE' | 'CLOSED';

export interface AuditionEntryDto {
  id: string;
  idolId: string;
  idolName: string;
  stageName: string | null;
  heroImageUrl: string | null;
  eliminatedAt: string | null;
  eliminatedAtRoundId: string | null;
}

export interface RoundDto {
  id: string;
  auditionId: string;
  name: string;
  orderIndex: number;
  status: RoundStatus;
  startAt: string;
  endAt: string;
  maxAdvancers: number | null;
}

export interface AuditionDto {
  id: string;
  name: string;
  description: string | null;
  status: AuditionStatus;
  startAt: string;
  endAt: string;
  createdAt: string;
  rounds: RoundDto[];
  entries: AuditionEntryDto[];
}

export interface AuditionListItemDto {
  id: string;
  name: string;
  status: AuditionStatus;
  startAt: string;
  endAt: string;
  rounds: number;
  entries: number;
}

export interface CreateAuditionDto {
  name: string;
  description?: string | null;
  startAt: string;
  endAt: string;
  idolIds?: string[];
}

export interface UpdateAuditionDto {
  name?: string;
  description?: string | null;
  startAt?: string;
  endAt?: string;
}

export interface CreateRoundDto {
  name: string;
  orderIndex: number;
  startAt: string;
  endAt: string;
  maxAdvancers?: number | null;
}

export interface UpdateRoundDto {
  name?: string;
  orderIndex?: number;
  startAt?: string;
  endAt?: string;
  maxAdvancers?: number | null;
}

// -- Vote Rule -----------------------------------------------------------

export type VoteMethod = 'HEART' | 'SMS' | 'TICKET';

export interface VoteRuleDto {
  roundId: string;
  heartWeight: number;
  smsWeight: number;
  ticketWeight: number;
  dailyHeartLimit: number;
  updatedAt: string;
}

export interface UpsertVoteRuleDto {
  heartWeight: number;
  smsWeight: number;
  ticketWeight: number;
  dailyHeartLimit?: number;
}

// -- Cast Vote / Leaderboard ---------------------------------------------

export interface CastVoteDto {
  idolId: string;
  method: VoteMethod;
}

export interface CastVoteResultDto {
  roundId: string;
  idolId: string;
  method: VoteMethod;
  weightApplied: number;
  dailyUsed: number;
  dailyLimit: number;
  /** Running leaderboard score for this idol after the vote. */
  scoreAfter: number;
}

export interface LeaderboardEntryDto {
  rank: number;
  idolId: string;
  idolName: string;
  stageName: string | null;
  heroImageUrl: string | null;
  score: number;
}

export interface RoundLeaderboardDto {
  roundId: string;
  status: RoundStatus;
  entries: LeaderboardEntryDto[];
}

export interface MyVoteStatusDto {
  roundId: string;
  method: VoteMethod;
  dailyUsed: number;
  dailyLimit: number;
  resetAt: string;
}

export interface MyVoteTicketsDto {
  /** Global bucket — any round accepts. */
  balance: number;
  updatedAt: string;
  /**
   * Round-scoped buckets (T-062b). Only rounds with a non-zero balance
   * appear here. On cast, the matching round balance drains before global.
   */
  roundBalances: Array<{
    roundId: string;
    balance: number;
    updatedAt: string;
  }>;
}

/**
 * SCR-023 — 내 투표 이력 한 row.
 *
 * idol/round/audition 이름은 backend에서 batch-hydrate (vote 테이블에 Prisma
 * 관계가 없어서 explicit join). 삭제된 항목은 `'— 삭제된 …'` 자리표시자.
 */
export interface MyVoteEntryDto {
  id: string;
  roundId: string;
  roundName: string;
  auditionId: string;
  auditionName: string;
  idolId: string;
  idolName: string;
  idolStageName: string | null;
  idolHeroImageUrl: string | null;
  method: VoteMethod;
  weight: number;
  createdAt: string;
}

// -- T-085 Design Assets (App Store / Play 제출 자료 관리) -------------------

export type DesignAssetType =
  | 'APP_ICON'
  | 'SCREENSHOT'
  | 'FEATURE_GRAPHIC'
  | 'SPLASH'
  | 'PREVIEW_VIDEO'
  | 'PERSONA_IMAGE'
  | 'PHOTOCARD_ART'
  | 'OTHER';

export type DesignAssetPlatform = 'IOS' | 'ANDROID' | 'WEB' | 'ALL';

export type DesignAssetStatus =
  | 'PLACEHOLDER'
  | 'DRAFT'
  | 'APPROVED'
  | 'LEGAL_REVIEWED'
  | 'SHIPPED';

export interface DesignAssetDto {
  id: string;
  name: string;
  type: DesignAssetType;
  platform: DesignAssetPlatform;
  status: DesignAssetStatus;
  fileUrl: string | null;
  spec: string | null;
  orderIndex: number;
  caption: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDesignAssetDto {
  name: string;
  type: DesignAssetType;
  platform?: DesignAssetPlatform;
  status?: DesignAssetStatus;
  fileUrl?: string | null;
  spec?: string | null;
  orderIndex?: number;
  caption?: string | null;
  notes?: string | null;
}

export interface UpdateDesignAssetDto {
  name?: string;
  type?: DesignAssetType;
  platform?: DesignAssetPlatform;
  status?: DesignAssetStatus;
  fileUrl?: string | null;
  spec?: string | null;
  orderIndex?: number;
  caption?: string | null;
  notes?: string | null;
}

// -- Project Documents (ADR / Design / WBS / Deliverables) ----------------

export type ProjectDocCategory =
  | 'ADR'
  | 'DESIGN'
  | 'IMPLEMENTATION'
  | 'DELIVERABLE'
  | 'REPORT'
  | 'OPS'
  | 'OTHER';

export type ProjectDocStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'ARCHIVED';

export type ProjectDocSourceType = 'FILE' | 'INLINE';

export interface ProjectDocSummaryDto {
  id: string;
  slug: string;
  title: string;
  category: ProjectDocCategory;
  status: ProjectDocStatus;
  sourceType: ProjectDocSourceType;
  sourcePath: string | null;
  summary: string | null;
  tags: string | null;
  orderIndex: number;
  version: number;
  updatedAt: string;
}

export interface ProjectDocDto extends ProjectDocSummaryDto {
  content: string;
  createdAt: string;
}

export interface CreateProjectDocDto {
  slug: string;
  title: string;
  category: ProjectDocCategory;
  status?: ProjectDocStatus;
  sourceType?: ProjectDocSourceType;
  sourcePath?: string | null;
  summary?: string | null;
  content: string;
  tags?: string | null;
  orderIndex?: number;
}

export interface UpdateProjectDocDto {
  slug?: string;
  title?: string;
  category?: ProjectDocCategory;
  status?: ProjectDocStatus;
  sourceType?: ProjectDocSourceType;
  sourcePath?: string | null;
  summary?: string | null;
  content?: string;
  tags?: string | null;
  orderIndex?: number;
}

// -- Admin analytics (dashboard) -----------------------------------------

export interface AdminAnalyticsOverviewDto {
  users: {
    total: number;
    active: number;
    new7d: number;
  };
  catalog: {
    totalIdols: number;
    published: number;
    draft: number;
    agencies: number;
  };
  fandom: {
    totalHearts: number;
    totalFollows: number;
    activeMemberships: number;
  };
  chat: {
    roomsCreated: number;
    messagesToday: number;
    couponBalanceSum: number;
  };
  auditions: {
    active: number;
    activeRounds: number;
    totalVotesToday: number;
  };
  /** Top 3 per currently-active round (empty array when no active round). */
  activeRoundLeaders: Array<{
    roundId: string;
    roundName: string;
    auditionName: string;
    top: Array<{ rank: number; idolName: string; score: number }>;
  }>;
  generatedAt: string;
}

// -- Commerce -----------------------------------------------------------

export type ProductKind =
  | 'CHAT_COUPON'
  | 'VOTE_TICKET'
  | 'FAN_CLUB_SUBSCRIPTION'
  | 'PHOTOCARD_PACK';

export type PaymentProvider =
  | 'DEV_SANDBOX'
  | 'APPLE_IAP'
  | 'GOOGLE_IAP'
  | 'STRIPE';

export type TransactionStatus = 'PENDING' | 'FULFILLED' | 'FAILED' | 'REFUNDED';

export interface PurchaseProductDto {
  id: string;
  sku: string;
  kind: ProductKind;
  title: string;
  description: string | null;
  priceKrw: number;
  deliveryPayload: Record<string, unknown>;
  isActive: boolean;
}

export interface CreateProductDto {
  sku: string;
  kind: ProductKind;
  title: string;
  description?: string | null;
  priceKrw: number;
  deliveryPayload: Record<string, unknown>;
}

export interface UpdateProductDto {
  title?: string;
  description?: string | null;
  priceKrw?: number;
  deliveryPayload?: Record<string, unknown>;
  isActive?: boolean;
}

export interface PurchaseTransactionDto {
  id: string;
  productId: string;
  sku: string;
  title: string;
  kind: ProductKind;
  provider: PaymentProvider;
  providerTxId: string | null;
  status: TransactionStatus;
  priceKrw: number;
  deliverySnapshot: Record<string, unknown>;
  fulfilledAt: string | null;
  failedReason: string | null;
  createdAt: string;
}

// ADR-023 — Request body 는 snake_case (amb-starter-kit v2.0).
export interface CreatePurchaseDto {
  product_id: string;
  provider?: PaymentProvider;
  provider_tx_id?: string;
  /**
   * StoreKit v2 compact JWS (ADR-019). Required when `provider === 'APPLE_IAP'`
   * once the Apple adapter ships; ignored for DEV_SANDBOX. Max 8 KB —
   * Apple tokens are ~2-3 KB but pad for future receipt types.
   */
  receipt_jws?: string;
}

// -- Photocard ----------------------------------------------------------

export type PhotocardRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type PhotocardSource = 'PURCHASE' | 'ADMIN_GRANT';

export interface PhotocardTemplateDto {
  id: string;
  setId: string;
  name: string;
  imageUrl: string | null;
  rarity: PhotocardRarity;
  /** Raw draw weight — source of truth for the weighted roll. */
  dropWeight: number;
  /**
   * Server-computed pull probability for this template in its set
   * (% across active templates, 2dp). Sum across active templates ≈ 100.
   * Required by Korean 게임산업법 2024 + Apple §3.1.1 / Play policy.
   * See ADR-016.
   */
  dropPercent: number;
  isActive: boolean;
}

export interface PhotocardSetDto {
  id: string;
  name: string;
  description: string | null;
  idolId: string | null;
  idolName: string | null;
  isActive: boolean;
  templateCount: number;
  templates: PhotocardTemplateDto[];
}

export interface PhotocardSetListItemDto {
  id: string;
  name: string;
  description: string | null;
  idolId: string | null;
  idolName: string | null;
  isActive: boolean;
  templateCount: number;
}

/**
 * A row in the user's collection, grouped by template. Duplicates are
 * aggregated into `count` (e.g. the same `Stage A` card pulled 3 times
 * shows as `count: 3`, not three separate entries). See T-046b.
 * The individual acquisition timeline lives in VoteTicketLedger /
 * PurchaseTransaction — this endpoint is for the collection view only.
 */
export interface UserPhotocardDto {
  templateId: string;
  name: string;
  imageUrl: string | null;
  rarity: PhotocardRarity;
  setId: string;
  setName: string;
  count: number;
  firstObtainedAt: string;
  lastObtainedAt: string;
}

export interface CreatePhotocardSetDto {
  name: string;
  description?: string | null;
  idolId?: string | null;
}

export interface UpdatePhotocardSetDto {
  name?: string;
  description?: string | null;
  idolId?: string | null;
  isActive?: boolean;
}

export interface CreatePhotocardTemplateDto {
  name: string;
  imageUrl?: string | null;
  rarity?: PhotocardRarity;
  dropWeight?: number;
}
