---
id: ADR-016
title: Photocard packs disclose per-template drop rates; pity is deferred
status: Accepted
date: 2026-04-23
author: Gray Kim
related_tasks: [T-045]
related_context: Photocard, Commerce
related_decisions: [ADR-015, ADR-018]
---

## Context

`PhotocardPackFulfiller` (shipped in T-045, ADR-015 lineage) rolls N
templates from a set weighted by each template's `dropWeight` and inserts
them into `UserPhotocard`. This is a textbook **확률형 아이템 (probability-item)**:
a paid pack whose contents are determined by a random draw the user can't
see.

Korea — the platform's primary market — treats probability items under
(a) 게임산업법 2024 개정 (mandatory probability disclosure for game items
sold for money, enforced 2024-03-22) and (b) the Korea Fair Trade
Commission's 전자상거래법 표시·광고 guidance for digital goods more
broadly. Both regimes require the operator to publish the drop rate
before purchase in a form the user can read on the same screen.

Separately, Apple App Store Review Guideline 3.1.1 and Google Play's
policy on randomized digital content both require disclosure of the
odds before purchase. Missing or misleading odds is an approved-launch
blocker.

Our shop today shows price and pack size (5 / 10 cards) but not the
per-card probability. Shipping commerce without this would:

1. Fail legal review in Korea.
2. Get rejected by Apple / Google when the IAP adapter (ADR-015
   follow-up) lands.
3. Give the "gacha is a black box" vibe to fans who — unlike casual
   mobile-game audiences — scrutinize collectibles carefully.

## Decision

For every photocard set that backs a `PHOTOCARD_PACK` product:

1. **Publish the per-template drop rate** on the public set-detail
   endpoint and on the product card in the shop. The rate is computed
   server-side as `dropWeight / Σ(dropWeight of active templates) × 100`,
   rounded to two decimal places, so clients can never drift from the
   source.
2. **Sum-of-rates must display as 100.00%** on each set. If rounding
   makes it 99.99 or 100.01, we accept it on the wire but the client
   shows "합계 100%" as a verbal assurance (not the raw sum).
3. **No pity / ceiling / guarantee system** in MVP. The 1% `LEGENDARY`
   weight means a 5-pack has a 4.9% chance of at least one legendary —
   disclose that fact; don't dampen it with a "guaranteed after N pulls"
   mechanic. This is deferred until we have real purchase data.
4. **Rate changes are versioned.** Any edit to `dropWeight` on a live set
   gets a "rates updated at YYYY-MM-DD" line so audit / legal can replay
   what was published when a user purchased. For MVP we log rate edits
   with a plain console log + `updatedAt` on `PhotocardTemplate`; a
   formal `PhotocardRateHistory` table is a T-046 follow-up.

### Shape

- `PhotocardTemplateDto.dropPercent: number` — already-computed
  percentage (2 decimal places). Added alongside the existing
  `dropWeight` (raw weight, kept for admins + future rate editors).
- `GET /api/v1/photocards/sets/:id` — public endpoint includes the rates; no
  auth required. Appears as 확률 리스트 on the shop.
- Mobile: the shop's photocard row gets a tappable "확률 공개" badge that
  expands a rarity-sorted percentage list. No navigation needed.

## Consequences

**Positive**

- Legal review on Korean launch doesn't block on probability disclosure.
- Apple/Google review path is clear when the IAP adapter lands.
- Sets reads become the single source of truth — clients cannot show
  a divergent number because `dropPercent` is computed, not stored.

**Negative**

- `dropWeight` is now user-visible-adjacent (anyone can compute it from
  percents). This means if we ever want to buff a low-rarity card, the
  change is a visible rate edit, not a silent tuning knob. Acceptable —
  that's exactly what the regulation requires.
- We're not shipping a pity system in MVP, so users who get unlucky
  three packs in a row will notice. We'll monitor support tickets and
  revisit in Phase D if refund volume rises.

## Rejected alternatives

1. **Rates in ToS only.** Rejected — 게임산업법 requires the rate be on
   the same screen as the purchase button. A deep link to a separate doc
   doesn't satisfy "구매 화면에서 확률을 즉시 확인할 수 있어야 한다".

2. **Hand-tune `dropPercent` per template (store both weight + percent).**
   Rejected — two fields, two invariants. Percentages must sum to 100,
   and if an admin adds a new template the stored percents become wrong
   until someone rebalances. Computing at read time eliminates the
   failure mode entirely.

3. **Ship a full pity (guaranteed legendary every N pulls) system now.**
   Rejected — pity requires a per-user progress table, pull history,
   and policy decisions we haven't tested. Launch lean, iterate with
   data.

## Related

- **ADR-018** — photocard trade/gift/burn is out of scope for MVP. The
  gacha is compliant under 게임산업법 §22 probability disclosure; §32.1.7
  environment (환전) is a separate axis that no transfer mechanic can
  safely touch yet.

## Activation / follow-ups

- Shop UI exposure (T-066 follow-up): "확률 공개" badge on photocard
  product rows, expanding to a sorted percentage list by rarity.
- `PhotocardRateHistory` table + a `rate-changed-at` column on
  `PhotocardSet` (T-046 follow-up): every dropWeight edit appends a
  frozen snapshot. Enables "show rates as of the time of purchase" for
  refund disputes.
- Audit log / CMS surface: the admin photocard controller should
  require a short `reason` string when editing `dropWeight` (defer).
- Regulatory re-review before Korean launch: once the marketing copy
  for photocards is locked, have compliance review the 확률 표기 wording.

## Status of implementation

- `PhotocardTemplateDto.dropPercent` computed in the controller view
  layer (`toSetDto`) using `Σ(dropWeight of active templates)`; not
  persisted.
- Mobile shop surface for the 확률 공개 badge: planned for T-066b
  (follow-up to the existing shop screen).
