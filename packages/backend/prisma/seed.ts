/**
 * Minimal seed for local development.
 * Registers the first idol (HYUN — Lee Hyun-woo) from `seeds/hyun-profile.json`
 * and a few supporting idols. Run with `pnpm seed`.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { hash } from 'bcrypt';
import { PrismaClient } from '@prisma/client';

/** seed의 idempotency 보장 — 같은 key 입력 시 항상 같은 UUID v4-style. */
function stableUuidFor(key: string): string {
  const h = createHash('sha256').update(key).digest('hex');
  // RFC 4122 v4 형식 (xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    '4' + h.slice(13, 16),
    '8' + h.slice(17, 20),
    h.slice(20, 32),
  ].join('-');
}
import { generatePlaceholders } from '../src/shared/media/placeholder-generator';
import type { IdolProfileJson } from '../src/shared/media/idol-profile.types';

const prisma = new PrismaClient();

type HyunProfile = IdolProfileJson & {
  deepProfile: IdolProfileJson['deepProfile'] & {
    skills: { vocal: { range: string; style: string } };
    favorites: { music: { genres: string[] } };
  };
};

function buildHyunBio(p: HyunProfile): string {
  const genres = p.deepProfile.favorites.music.genres.slice(0, 3).join(' · ');
  return [
    `${p.coreIdentity.name.korean} · ${p.coreIdentity.birth.birthplace}`,
    `컨셉 《${p.conceptSeed.concept_name}》 — ${p.conceptSeed.vibe_description}`,
    `Vocal(${p.deepProfile.skills.vocal.range}) / 자작곡 · 프로듀싱 · ${genres}`,
    p.conceptSeed.emotional_hook,
  ].join('\n');
}

async function main() {
  console.log('🌱  seeding…');

  const agency = await prisma.agency.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'A-idol Agency',
      description: 'House agency that manages all 99 idols (MVP).',
    },
  });

  // ── 1st idol — HYUN (from docs/reference/hyun-profile.json) ──────
  const hyun = JSON.parse(
    readFileSync(join(__dirname, 'seeds', 'hyun-profile.json'), 'utf-8'),
  ) as HyunProfile;

  const hyunId = hyun.id; // from profile.id

  // Generate SVG placeholders for all 11 images. Returns the local
  // `/api/uploads/...svg` URL that replaces the original `/api/uploads/...jpg`.
  const uploadsRoot = join(__dirname, '..', 'uploads');
  const assets = await generatePlaceholders(hyun, uploadsRoot, '/api/uploads');
  const heroAsset = assets.find((a) => a.imageType === 'hero');
  console.log(`   · ${assets.length} placeholders written to ${uploadsRoot}/members/${hyunId}/`);

  await prisma.idol.upsert({
    where: { id: hyunId },
    update: {
      name: hyun.coreIdentity.name.english,
      stageName: hyun.coreIdentity.name.stage_name,
      birthdate: new Date(hyun.coreIdentity.birth.date),
      mbti: hyun.coreIdentity.personal.mbti,
      bio: buildHyunBio(hyun),
      publishedAt: new Date(),
      // Nominal head-start so HYUN sorts first in the default
      // `heartCount desc` listing (MVP — replace with real metrics).
      heartCount: 100,
      heroImageUrl: heroAsset?.publicUrl ?? null,
      profileJson: hyun as unknown as object,
    },
    create: {
      id: hyunId,
      agencyId: agency.id,
      name: hyun.coreIdentity.name.english,
      stageName: hyun.coreIdentity.name.stage_name,
      birthdate: new Date(hyun.coreIdentity.birth.date),
      mbti: hyun.coreIdentity.personal.mbti,
      bio: buildHyunBio(hyun),
      publishedAt: new Date(),
      heartCount: 100,
      heroImageUrl: heroAsset?.publicUrl ?? null,
      profileJson: hyun as unknown as object,
      fanClub: { create: { tier: 'official', price: 0 } },
    },
  });

  // Replace image set for HYUN so reruns don't accumulate duplicates.
  await prisma.idolImage.deleteMany({ where: { idolId: hyunId } });
  await prisma.idolImage.createMany({
    data: assets.map((a) => ({
      id: a.imageId,
      idolId: hyunId,
      imageType: a.imageType,
      imageUrl: a.publicUrl,
      sortOrder: a.sortOrder,
      isApproved: a.isApproved,
    })),
  });

  // ── Bulk idol seed — 98 additional idols so the MVP dataset matches ─
  //    the "99 idols" requirement (HYUN counts as #1).
  //
  // Names and personas are synthesized deterministically from a seeded RNG;
  // swap in real persona JSON blobs later (T-028 content pass).
  const BULK_TARGET = 99;
  const KO_SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권'];
  const KO_GIVEN = [
    '하린', '서연', '민지', '지아', '유나', '수빈', '예린', '다은', '채원', '지우',
    '리아', '비나', '예나', '소미', '주연', '시현', '재민', '도현', '지훈', '서준',
  ];
  const STAGE_NAMES = [
    'LUNA', 'SORA', 'KIRA', 'RINA', 'MINA', 'YENA', 'VIVI', 'NOVA', 'ELLA', 'IRIS',
    'ZARA', 'JUNA', 'AYA', 'EVE', 'SKYE', 'WREN', 'BELLA', 'DARA', 'FIA', 'GEM',
  ];
  const MBTIS = ['INFJ', 'INFP', 'ENFP', 'ENFJ', 'INTJ', 'INTP', 'ENTP', 'ENTJ', 'ISFJ', 'ISFP', 'ESFJ', 'ESFP', 'ISTJ', 'ISTP', 'ESTJ', 'ESTP'];
  const VIBES = [
    'bright stage energy', 'velvety R&B vocals', 'electric rap flow', 'dreamy vocal tone',
    'fierce main dancer', 'playful charisma', 'introspective songwriter', 'charismatic leader',
  ];

  function rng(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
  }
  const rand = rng(42);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;

  // Existing idols (HYUN + any lingering supporting) take up slot #1..N;
  // fill the rest up to BULK_TARGET.
  const existing = await prisma.idol.count({ where: { deletedAt: null } });
  const toCreate = Math.max(0, BULK_TARGET - existing);
  console.log(`   · existing idols: ${existing}; bulk-creating ${toCreate} more`);

  for (let i = 0; i < toCreate; i++) {
    const surname = pick(KO_SURNAMES);
    const given = pick(KO_GIVEN);
    const koreanName = `${surname}${given}`;
    const stageName = pick(STAGE_NAMES);
    const mbti = pick(MBTIS);
    const vibe = pick(VIBES);
    // Birthdates spread across 1998-01-01 .. 2008-12-31
    const year = 1998 + Math.floor(rand() * 11);
    const month = 1 + Math.floor(rand() * 12);
    const day = 1 + Math.floor(rand() * 28);
    await prisma.idol.create({
      data: {
        agencyId: agency.id,
        name: koreanName,
        stageName,
        mbti,
        bio: `${koreanName} · ${stageName} — ${vibe}.`,
        birthdate: new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`),
        publishedAt: new Date(),
        heartCount: Math.floor(rand() * 5000),
        followCount: Math.floor(rand() * 2000),
        fanClub: { create: { tier: 'official', price: 0 } },
      },
    });
  }

  // ── Demo user coupons (dev convenience so chat smoke runs past free quota) ──
  const demoUser = await prisma.user.findUnique({ where: { email: 'demo@a-idol.dev' } });
  if (demoUser) {
    const wallet = await prisma.chatCouponWallet.upsert({
      where: { userId: demoUser.id },
      update: { balance: 10 },
      create: { userId: demoUser.id, balance: 10 },
    });
    await prisma.chatCouponLedger.create({
      data: {
        userId: demoUser.id,
        delta: 10,
        reason: 'ADMIN_GRANT',
        balanceAfter: wallet.balance,
        memo: 'dev seed',
      },
    });
    console.log(`   · demo user wallet seeded with 10 coupons`);
  }

  // ── Commerce products (dev-sandbox fulfillable) ──
  // `appleProductId`는 App Store Connect에 등록할 IAP 식별자의 내부
  // 매핑 (ADR-019 + Apple Developer Program 체크리스트 §4). Bundle ID
  // `group.amoeba.aidol` prefix는 출시 시 Apple Developer team에 맞춰
  // 조정 필요 (현재 placeholder).
  const chatCouponProducts = [
    { sku: 'chat-coupon-10', title: '채팅 쿠폰 10매', priceKrw: 1100, payload: { couponAmount: 10 }, appleId: 'group.amoeba.aidol.chat_coupon_10' },
    { sku: 'chat-coupon-30', title: '채팅 쿠폰 30매', priceKrw: 3000, payload: { couponAmount: 30 }, appleId: 'group.amoeba.aidol.chat_coupon_30' },
    { sku: 'chat-coupon-100', title: '채팅 쿠폰 100매', priceKrw: 8900, payload: { couponAmount: 100 }, appleId: 'group.amoeba.aidol.chat_coupon_100' },
  ] as const;
  for (const p of chatCouponProducts) {
    await prisma.purchaseProduct.upsert({
      where: { sku: p.sku },
      update: {
        title: p.title,
        priceKrw: p.priceKrw,
        deliveryPayload: p.payload,
        isActive: true,
        appleProductId: p.appleId,
      },
      create: {
        sku: p.sku,
        kind: 'CHAT_COUPON',
        title: p.title,
        priceKrw: p.priceKrw,
        deliveryPayload: p.payload,
        appleProductId: p.appleId,
      },
    });
  }
  console.log(`   · seeded ${chatCouponProducts.length} chat coupon products`);

  const voteTicketProducts = [
    { sku: 'vote-ticket-10', title: '투표권 10매', priceKrw: 1100, payload: { ticketAmount: 10 }, appleId: 'group.amoeba.aidol.vote_ticket_10' },
    { sku: 'vote-ticket-50', title: '투표권 50매', priceKrw: 4900, payload: { ticketAmount: 50 }, appleId: 'group.amoeba.aidol.vote_ticket_50' },
  ] as const;
  for (const p of voteTicketProducts) {
    await prisma.purchaseProduct.upsert({
      where: { sku: p.sku },
      update: {
        title: p.title,
        priceKrw: p.priceKrw,
        deliveryPayload: p.payload,
        isActive: true,
        appleProductId: p.appleId,
      },
      create: {
        sku: p.sku,
        kind: 'VOTE_TICKET',
        title: p.title,
        priceKrw: p.priceKrw,
        deliveryPayload: p.payload,
        appleProductId: p.appleId,
      },
    });
  }
  console.log(`   · seeded ${voteTicketProducts.length} vote ticket products`);

  // ── Photocard set + templates for HYUN + pack products ─────────
  const hyunSet = await prisma.photocardSet.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000ca' },
    update: { name: 'HYUN 1st Photocard Set', isActive: true, idolId: hyunId },
    create: {
      id: '00000000-0000-0000-0000-0000000000ca',
      name: 'HYUN 1st Photocard Set',
      description: 'HYUN 데뷔 기념 포토카드 세트',
      idolId: hyunId,
    },
  });
  // Idempotent: re-create template set so rarity/weights always match the seed.
  // UserPhotocard has FK `onDelete: Restrict` → must clean the inventory
  // rows first so seed can re-run against a DB that's been used by smokes.
  await prisma.userPhotocard.deleteMany({
    where: { template: { setId: hyunSet.id } },
  });
  await prisma.photocardTemplate.deleteMany({ where: { setId: hyunSet.id } });
  const templates = [
    { name: 'Stage A', rarity: 'COMMON' as const, dropWeight: 40 },
    { name: 'Stage B', rarity: 'COMMON' as const, dropWeight: 40 },
    { name: 'Backstage', rarity: 'COMMON' as const, dropWeight: 30 },
    { name: 'Selfie', rarity: 'COMMON' as const, dropWeight: 30 },
    { name: 'MV Still', rarity: 'RARE' as const, dropWeight: 15 },
    { name: 'Fan-Meeting', rarity: 'RARE' as const, dropWeight: 15 },
    { name: 'Studio Portrait', rarity: 'EPIC' as const, dropWeight: 6 },
    { name: 'Debut Night', rarity: 'LEGENDARY' as const, dropWeight: 1 },
  ];
  for (const t of templates) {
    await prisma.photocardTemplate.create({
      data: { setId: hyunSet.id, ...t },
    });
  }
  console.log(`   · seeded photocard set "HYUN 1st" with ${templates.length} templates`);

  const photocardProducts = [
    { sku: 'photocard-pack-5', title: 'HYUN 포토카드 5장팩', priceKrw: 2500, payload: { setId: hyunSet.id, count: 5 }, appleId: 'group.amoeba.aidol.photocard_pack_5' },
    { sku: 'photocard-pack-10', title: 'HYUN 포토카드 10장팩', priceKrw: 4500, payload: { setId: hyunSet.id, count: 10 }, appleId: 'group.amoeba.aidol.photocard_pack_10' },
  ] as const;
  for (const p of photocardProducts) {
    await prisma.purchaseProduct.upsert({
      where: { sku: p.sku },
      update: {
        title: p.title,
        priceKrw: p.priceKrw,
        deliveryPayload: p.payload,
        isActive: true,
        appleProductId: p.appleId,
      },
      create: {
        sku: p.sku,
        kind: 'PHOTOCARD_PACK',
        title: p.title,
        priceKrw: p.priceKrw,
        deliveryPayload: p.payload,
        appleProductId: p.appleId,
      },
    });
  }
  console.log(`   · seeded ${photocardProducts.length} photocard pack products`);

  // ── Default admin user (CMS login, dev only) ────────────────────
  // Credentials are intentionally weak so local contributors can sign in.
  // T-082 (RPT-260426-D Phase D) — staging/prod 에서 실수로 약한 비번이
  // 들어가지 않도록 fail-fast 가드. 우회 필요 시 `ALLOW_DEV_ADMIN_SEED=1` 명시.
  const env = process.env.NODE_ENV ?? 'development';
  const allowDevAdmin = process.env.ALLOW_DEV_ADMIN_SEED === '1';
  if (env !== 'development' && env !== 'test' && !allowDevAdmin) {
    throw new Error(
      `[seed] NODE_ENV=${env} 에서는 default admin (admin-dev-0000) seed 거부. ` +
        `infra-level 프로비저닝으로 admin 계정을 생성하거나, 실수로 dev seed 를 ` +
        `실행 중이라면 NODE_ENV=development 로 다시 실행하세요. 의도적 우회는 ` +
        `ALLOW_DEV_ADMIN_SEED=1 (배포 직후 즉시 password rotation 필수).`,
    );
  }
  const adminEmail = 'admin@a-idol.dev';
  const adminPassword = 'admin-dev-0000';
  const adminHash = await hash(adminPassword, 10);
  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminHash, displayName: 'Root Admin', role: 'admin', status: 'active' },
    create: {
      id: '00000000-0000-0000-0000-0000000000ad',
      email: adminEmail,
      passwordHash: adminHash,
      displayName: 'Root Admin',
      role: 'admin',
      status: 'active',
    },
  });

  // ── T-085 디자인 자산 placeholder 시드 (CMS UI에 표시할 초기 행) ────
  // 외부 storage(S3/Drive)에 자산이 들어오면 status를 PLACEHOLDER → DRAFT
  // → APPROVED → SHIPPED 로 진행하며 fileUrl 업데이트.
  const adminId = '00000000-0000-0000-0000-0000000000ad';
  const designAssetSeed = [
    { name: '앱 아이콘', type: 'APP_ICON' as const, platform: 'ALL' as const, spec: '1024x1024 PNG (no alpha)', orderIndex: 0, caption: null },
    { name: 'Splash screen', type: 'SPLASH' as const, platform: 'ALL' as const, spec: '1242x2688 + Storyboard', orderIndex: 0, caption: null },
    { name: 'Play feature graphic', type: 'FEATURE_GRAPHIC' as const, platform: 'ANDROID' as const, spec: '1024x500 PNG', orderIndex: 0, caption: null },
    { name: '홈 피드 (grid2)', type: 'SCREENSHOT' as const, platform: 'ALL' as const, spec: '1290x2796 PNG', orderIndex: 1, caption: '최애 아이돌을 만나세요' },
    { name: '아이돌 상세 + 응원댓글', type: 'SCREENSHOT' as const, platform: 'ALL' as const, spec: '1290x2796 PNG', orderIndex: 2, caption: '응원하고 채팅으로 이어집니다' },
    { name: '채팅 화면', type: 'SCREENSHOT' as const, platform: 'ALL' as const, spec: '1290x2796 PNG', orderIndex: 3, caption: 'AI 아이돌과 진짜 대화' },
    { name: '오디션 dashboard', type: 'SCREENSHOT' as const, platform: 'ALL' as const, spec: '1290x2796 PNG', orderIndex: 4, caption: '주간 오디션 + 실시간 leaderboard' },
    { name: '가챠 카드 reveal', type: 'SCREENSHOT' as const, platform: 'ALL' as const, spec: '1290x2796 PNG', orderIndex: 5, caption: '포토카드 컬렉션을 시작하세요' },
    { name: '마이페이지', type: 'SCREENSHOT' as const, platform: 'ALL' as const, spec: '1290x2796 PNG', orderIndex: 6, caption: '나만의 팬덤 활동 한눈에' },
    { name: 'App Preview Video (선택)', type: 'PREVIEW_VIDEO' as const, platform: 'IOS' as const, spec: '15~30s, 1920x1080, mp4', orderIndex: 0, caption: null, notes: 'MVP에서는 skip 가능, post-GA 추가' },
  ];
  for (const a of designAssetSeed) {
    await prisma.designAsset.upsert({
      where: { id: stableUuidFor(`design-asset-${a.type}-${a.platform}-${a.orderIndex}-${a.name}`) },
      update: {},
      create: {
        id: stableUuidFor(`design-asset-${a.type}-${a.platform}-${a.orderIndex}-${a.name}`),
        name: a.name,
        type: a.type,
        platform: a.platform,
        status: 'PLACEHOLDER',
        spec: a.spec,
        orderIndex: a.orderIndex,
        caption: a.caption,
        notes: 'notes' in a ? (a as { notes?: string }).notes ?? null : null,
        createdBy: adminId,
        updatedBy: adminId,
      },
    });
  }
  const totalAssets = await prisma.designAsset.count();

  // ---- Project Documents (ADR / 설계 / WBS / 산출물) ---------------------
  // RPT-260506 — FILE 기반 동기화 로직은 src/lib/project-doc-sync.ts 로 추출.
  // INLINE placeholder (사용자가 CMS 에서 직접 작성하는 산출물 템플릿) 은
  // 아래에서 별도로 upsert.
  const { syncProjectDocs } = await import('../src/lib/project-doc-sync');
  const repoRoot = join(__dirname, '..', '..', '..');
  const docSyncResult = await syncProjectDocs({ prisma, repoRoot, adminId });
  console.log(
    `   📄 project-docs sync — created=${docSyncResult.created} updated=${docSyncResult.updated} unchanged=${docSyncResult.unchanged} archived=${docSyncResult.archived} (${docSyncResult.durationMs}ms)`,
  );

  // INLINE 산출물 placeholder — 사용자가 CMS 에서 직접 작성 가능.
  // 이미 같은 slug 의 FILE 산출물이 있으면 skip (충돌 방지).
  const inlineDeliverables: Array<{
    slug: string;
    title: string;
    summary: string;
    content: string;
    tags: string;
    orderIndex: number;
  }> = [
    {
      slug: 'deliverable-project-execution-plan',
      title: '프로젝트 수행계획서 (placeholder)',
      summary: 'A-idol MVP 수행 일정 / 자원 / 리스크 / 마일스톤. CMS 에서 작성.',
      tags: 'deliverable,plan',
      orderIndex: 0,
      content: [
        '# 프로젝트 수행계획서',
        '',
        '> 본 문서는 CMS 에서 직접 작성/편집 가능한 INLINE 산출물의 시드 placeholder 입니다.',
        '',
        '## 1. 프로젝트 개요',
        '- 프로젝트명: A-idol',
        '- GA target: 2026-08-01 (4주 단축, 2026-04-27 통지)',
        '- Owner: Gray Kim',
        '',
        '## 2. 일정 / 마일스톤',
        '- M1 Setup ~ M5 GA — 상세는 [`docs/implementation/a-idol-dev-plan.md`](docs/implementation/a-idol-dev-plan.md) 참조',
        '',
        '## 3. 자원 (인력 / 예산)',
        '- TBD',
        '',
        '## 4. 리스크',
        '- TBD',
      ].join('\n'),
    },
    {
      slug: 'deliverable-mid-progress-report',
      title: '중간보고서 (placeholder, Phase C 시점 갱신용)',
      summary: 'WBS 진행률 / 주요 성과 / 이슈 / 후속 계획. RPT_260425_phase-c-mid-progress 참조.',
      tags: 'deliverable,report,phase-c',
      orderIndex: 1,
      content: [
        '# 중간보고서',
        '',
        '> 진행 시점별로 갱신. Phase C 첫 보고는 [`docs/report/RPT_260425_phase-c-mid-progress.md`](docs/report/RPT_260425_phase-c-mid-progress.md) 참조.',
        '',
        '## 1. 진행 요약',
        '- 백엔드: 10 모듈 완료 (Phase 0/A/B/C ~70%)',
        '- CMS: scaffolded + 디자인자산/프로젝트관리 메뉴 신설',
        '- Mobile: scaffolded only (post-mid 작업)',
        '',
        '## 2. 주요 성과',
        '- TBD',
        '',
        '## 3. 이슈 / 리스크',
        '- TBD',
        '',
        '## 4. 후속 계획',
        '- TBD',
      ].join('\n'),
    },
  ];

  for (const d of inlineDeliverables) {
    const id = stableUuidFor(`project-doc-${d.slug}`);
    await prisma.projectDocument.upsert({
      where: { slug: d.slug },
      update: {}, // 이미 존재하면 사용자가 편집했을 수 있으므로 본문 보존
      create: {
        id,
        slug: d.slug,
        title: d.title,
        category: 'DELIVERABLE',
        status: 'DRAFT',
        sourceType: 'INLINE',
        sourcePath: null,
        summary: d.summary,
        content: d.content,
        tags: d.tags,
        orderIndex: d.orderIndex,
        version: 1,
        createdBy: adminId,
        updatedBy: adminId,
      },
    });
  }
  const totalProjectDocs = await prisma.projectDocument.count();

  const totalIdols = await prisma.idol.count();
  const activeIdols = await prisma.idol.count({ where: { deletedAt: null } });
  const totalClubs = await prisma.fanClub.count();
  const hyunImageCount = await prisma.idolImage.count({ where: { idolId: hyunId } });
  console.log(
    `✅ seeded: ${activeIdols} active / ${totalIdols} total idols, ${totalClubs} fan clubs, HYUN #1 with ${hyunImageCount} images, ${totalAssets} design assets, ${totalProjectDocs} project documents`,
  );
  console.log(`   · admin: ${adminEmail} / ${adminPassword} (dev only)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
