---
id: ADR-018
title: Photocards do not trade, gift, or transfer in MVP
status: Accepted
date: 2026-04-23
author: Gray Kim
related_tasks: [T-045, T-046b]
related_context: Photocard, Regulation
related_decisions: [ADR-015, ADR-016]
---

## Context

T-046b surfaced duplicate card counts on the collection screen (`Stage A
×9`). As soon as this ships the expected user demand is obvious:

> 친구랑 교환하면 안 돼요?
> 중복 카드 그냥 쓰레기에요?

Trade is a natural next feature and also the one most likely to blow up
in our face if we ship it without thinking. Five considerations converge:

### 1. Korean regulation (게임산업법 §32 ①.7)

> 누구든지 … 게임물의 이용을 통하여 획득한 유·무형의 결과물(… 점수, 경품, 게임 내에서 사용되는 가상의 화폐로서 대통령령이 정하는 것을 말한다)을 환전하거나 환전 알선하거나 재매입을 업으로 하는 행위를 하여서는 아니된다.

The law bans "environtonment" (환전) — operating a service that facilitates
turning randomized in-game content into cash or equivalent. Photocards
pulled from a gacha pack (ADR-016) are the paradigmatic 결과물. A trade
feature with *any* of:

- real-money pricing between users
- convertible tokens or resellable vouchers
- two-legged swaps that can be gamed into value transfers

is a direct §32.1.7 violation. Even pure card-for-card trade skirts the
line: the Korea Communications Standards Commission has historically
treated rarity-weighted swaps as implicit pricing.

### 2. Apple / Google IAP terms

Apple §3.1.1 and Google Play's IAP policy both require that virtual
items purchased with their billing stay within the app's ecosystem and
under the operator's control. A P2P marketplace — even an intra-app one
— needs additional review and typically operator-custody escrow.
Building that pre-IAP-launch is wasted work.

### 3. Product complexity

Trade implies, at minimum: listing, offer, counter-offer, accept, two-
sided commit, dispute resolution, refund on fraud, moderation, rate
limits. That's a quarter of engineering time for a feature that, by
our current economics, exists to paper over disappointing pulls. The
right fix for "disappointing pulls" is ADR-016's future pity system
(also deferred), not a secondary market.

### 4. Gifting is not a clean escape hatch

"One-way gift, no swap" looks like a safe middle ground. It isn't —
once gifts exist, users will pair them off-app ("너 나한테 A 주고
나는 너한테 B 줄게") and we've created an unregulated trade channel
with worse auditability than if we'd built trade openly.

### 5. Supply-side economics of a fresh gacha

Our MVP catalog is one 8-card set (HYUN 1st). The `LEGENDARY` Debut
Night is 0.56% pull rate — at that rarity, trade would instantly create
a market where legendary cards are the only currency that matters, and
the rest of the economy collapses. We want the market *not* to exist
until we have enough sets that collecting-by-theme is interesting.

## Decision

**MVP ships with no photocard transfer mechanic of any kind.** Concretely:

- No trade (two-sided swap).
- No gift (one-sided transfer).
- No sell / convert / burn-for-tokens.
- No admin-mediated relocation beyond existing dev tooling for bug
  recovery (an operator re-granting a lost card after a support ticket
  is fine; it's logged via `ADMIN_GRANT` in `UserPhotocardLedger` …
  once we build that ledger).

Cards accumulate as duplicates. The collection UI already groups them
(`Stage A ×9`), so storage / rendering doesn't suffer. Emotional
disappointment about duplicates is accepted MVP cost.

## Consequences

**Positive**

- Zero regulatory exposure under 게임산업법 §32.1.7 for the trade vector
  specifically. (The gacha itself is a separate compliance concern —
  see ADR-016.)
- Apple/Google IAP review path stays simple.
- No queuing / escrow / dispute systems to build.
- Cleanest possible "what users own" ledger — every row in
  `user_photocards` has exactly one `source: PURCHASE | ADMIN_GRANT`.
  No `TRADE_IN` / `GIFT_IN` rows to unify over later.

**Negative**

- Users with large duplicate piles will ask. Support will have to say
  no and point at this ADR. Script: "현재 환전 · 교환 기능은 제공하지
  않습니다. 게임산업법 32조 관련 검토가 끝난 뒤 도입 여부를 재검토할
  예정입니다."
- Missing a retention hook. Fandom trade communities (specifically the
  K-pop photocard segment this product targets) do form strong bonds
  around swap meets, and we're forgoing that entirely.
- Gifting pressure will leak to out-of-app channels (screenshots
  traded on Twitter / offline). We lose visibility into that
  secondary market; the only signal we'll have is indirect (e.g. two
  accounts with suspiciously complementary inventory).

## Rejected alternatives

1. **Intra-fan-club trade only** — restrict swaps to users who share a
   `Membership` on the same fan club. Still runs into §32.1.7 because
   the law doesn't care about the size of the swap pool, only that
   operator-mediated exchange exists.

2. **One-way gift, rate-limited (1/week, free)** — looks benign. The
   off-app pairing problem (Point 4 above) makes this worse than no
   transfer at all, because now we *have* audit rows that look legit
   but mask coordinated swaps.

3. **Burn-duplicates-for-currency** (`Stage A ×9` → 8 dust → upgrade to
   `Stage B`) — the dust is a virtual currency that's accumulated
   through randomized play. Same §32.1.7 category as trade proper,
   arguably worse because it's a more direct value path.

4. **Open marketplace with KRW pricing** — obviously rejected. This is
   the exact scenario §32.1.7 prohibits.

## Activation plan

Revisit when *all* of the following are true:

1. Legal counsel has reviewed a specific trade design against current
   interpretation of §32.1.7 and issued a written opinion.
2. Apple + Google IAP adapters (ADR-015 activation) have shipped and
   are running in production for at least one major release cycle.
3. The catalog has ≥ 3 photocard sets, so trade has interesting
   collection-completion dynamics instead of "trade A for legendary B".
4. Support workload on "can I trade?" justifies the feature spend —
   not a guess, a metric.

When those conditions are met, the design starting point is:

- **Card-for-card only**, same rarity tier, no currency leg.
- **Operator-custody escrow** (like Apple/Play's ToS): the platform
  holds both cards briefly between accept and commit.
- **Rate-limited**: one trade per account per day, hard cap 30 per
  month. Discourages velocity-based gaming.
- **Mandatory 24h cooldown** before a newly-pulled card can be
  offered — prevents "pull-and-flip" arbitrage.
- **Full audit trail**: new `PhotocardTradeLog` table, never deleted,
  queryable by legal.
- **Fraud controls**: friends-only (fan club membership overlap) for
  first launch, scaled to wider network later.

This is explicitly a sketch — not a commitment.

## Status of implementation

- **None.** This ADR documents the deliberate non-decision to not
  build the feature in MVP.
- `PhotocardSource` enum in Prisma lists `PURCHASE | ADMIN_GRANT` only
  — no `TRADE_IN / GIFT_IN` values. Adding them is the first code
  change the future trade feature would need, intentionally making
  the scope visible.
- Support FAQ entry: landed as Q2 in `docs/support/faq-ko.md` — the
  official script for trade/gift questions. "법적 검토 중 · 일정 미공개"
  framing; never "absolute never."
