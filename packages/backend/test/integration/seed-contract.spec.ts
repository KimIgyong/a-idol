import { createIntegrationApp, type IntegrationApp } from './helpers/app-harness';

/**
 * Seed contract — every other integration spec implicitly assumes a
 * particular set of seed rows exist (demo user, admin, specific SKUs,
 * HYUN idol, HYUN 1st photocard set). When `prisma/seed.ts` drifts
 * without the downstream specs noticing, they fail with confusing
 * timeouts / "not found" errors at unrelated lines. This file fails
 * fast with a clear message pointing at the seed source.
 */
describe('ITC-SEED — required seed fixtures', () => {
  let env: IntegrationApp;

  beforeAll(async () => {
    env = await createIntegrationApp();
  });
  afterAll(async () => {
    await env.close();
  });

  it('TC-SEED-001 — at least 99 active idols (bulk-generated catalog)', async () => {
    const count = await env.prisma.idol.count({ where: { deletedAt: null } });
    expect(count).toBeGreaterThanOrEqual(99);
  });

  it('TC-SEED-002 — HYUN idol exists with the canonical id', async () => {
    // `name` is legal name ("Lee Hyun-woo"); `stageName` is the public
    // handle ("HYUN") referenced across docs + the photocard set title.
    const hyun = await env.prisma.idol.findUnique({
      where: { id: 'b51dea87-5bce-4959-b18f-22fd51ea9e11' },
    });
    expect(hyun).not.toBeNull();
    expect(hyun?.stageName).toBe('HYUN');
  });

  it('TC-SEED-003 — default admin + demo user rows exist', async () => {
    const admin = await env.prisma.adminUser.findUnique({
      where: { email: 'admin@a-idol.dev' },
    });
    expect(admin).not.toBeNull();
    expect(admin?.role).toBe('admin');
    expect(admin?.status).toBe('active');

    const demo = await env.prisma.user.findUnique({
      where: { email: 'demo@a-idol.dev' },
    });
    expect(demo).not.toBeNull();
  });

  it('TC-SEED-004 — commerce catalog has the SKUs other specs reference', async () => {
    const requiredSkus = [
      'chat-coupon-10',
      'chat-coupon-30',
      'chat-coupon-100',
      'vote-ticket-10',
      'vote-ticket-50',
      'photocard-pack-5',
      'photocard-pack-10',
    ];
    const products = await env.prisma.purchaseProduct.findMany({
      where: { sku: { in: requiredSkus }, isActive: true },
      select: { sku: true },
    });
    const found = new Set(products.map((p) => p.sku));
    const missing = requiredSkus.filter((s) => !found.has(s));
    expect(missing).toEqual([]);
  });

  it('TC-SEED-005 — every MVP SKU has a unique Apple Product ID mapping (ADR-019 + checklist §4)', async () => {
    // `apple_product_id` is populated in seed per the Apple Developer
    // Program checklist mapping table. Integration into JWS verification
    // (Phase 1 W2) relies on this 1:1 link being present + unique.
    const expected: Record<string, string> = {
      'chat-coupon-10': 'group.amoeba.aidol.chat_coupon_10',
      'chat-coupon-30': 'group.amoeba.aidol.chat_coupon_30',
      'chat-coupon-100': 'group.amoeba.aidol.chat_coupon_100',
      'vote-ticket-10': 'group.amoeba.aidol.vote_ticket_10',
      'vote-ticket-50': 'group.amoeba.aidol.vote_ticket_50',
      'photocard-pack-5': 'group.amoeba.aidol.photocard_pack_5',
      'photocard-pack-10': 'group.amoeba.aidol.photocard_pack_10',
    };
    const rows = await env.prisma.purchaseProduct.findMany({
      where: { sku: { in: Object.keys(expected) } },
      select: { sku: true, appleProductId: true },
    });
    const actual = Object.fromEntries(rows.map((r) => [r.sku, r.appleProductId]));
    expect(actual).toEqual(expected);
  });

  it('TC-SEED-006 — HYUN 1st Photocard Set has exactly 8 active templates', async () => {
    const set = await env.prisma.photocardSet.findUnique({
      where: { id: '00000000-0000-0000-0000-0000000000ca' },
      include: { templates: true },
    });
    expect(set).not.toBeNull();
    expect(set?.isActive).toBe(true);
    const activeTemplates = (set?.templates ?? []).filter((t) => t.isActive);
    expect(activeTemplates).toHaveLength(8);
    // Assert rarity spread (1 LEGENDARY baseline per ADR-016 seed example).
    const rarities = activeTemplates.map((t) => t.rarity);
    expect(rarities).toContain('LEGENDARY');
    expect(rarities).toContain('EPIC');
    expect(rarities).toContain('RARE');
    expect(rarities).toContain('COMMON');
  });
});
