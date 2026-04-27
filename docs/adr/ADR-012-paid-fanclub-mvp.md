---
id: ADR-012
title: Paid fan clubs deferred to Commerce (T-044); MVP free-only
status: Accepted
date: 2026-04-22
author: Gray Kim
related_tasks: [T-022, T-044]
related_context: Fandom, Commerce
---

## Context

`FanClub` has a `price Decimal(14,2)` column and `Membership` is the join row.
The schema is designed to eventually support paid subscriptions (POL-003 Phase
2), but the Commerce context (IAP verification, App Store / Google Play billing,
receipt storage) isn't built yet — that's T-044 in Phase B.

Before Commerce lands, joining a paid fan club has no way to:
- Collect money.
- Verify a store receipt.
- Cancel on refund / chargeback.
- Re-bill on subscription renewal.

## Decision

**MVP supports free fan clubs only.** Joining a fan club with `price > 0`
throws `DomainError(ErrorCodes.PAID_FAN_CLUB_NOT_SUPPORTED)` mapped to HTTP
**402 Payment Required** by `AppExceptionFilter`.

- `JoinFanClubUseCase` performs the `price > 0` check before calling the
  repository, so no membership row is created for paid clubs.
- Seed data and the auto-created fan club (on `CreateIdolUseCase`) use
  `tier: 'official'`, `price: 0`.
- CMS is free to set `price > 0` on a fan club, but client-side flows will
  surface the 402 until T-044 lands.

## Consequences

**Positive**
- Clear, typed failure mode (no silent "you joined but weren't charged").
- Schema doesn't need a migration when Commerce arrives — the `price` column
  already exists.
- The error code is part of the shared contract and surfaces a specific UI
  state the mobile app can render without guessing.

**Negative**
- Operators could configure a paid fan club in the CMS that users can see but
  never join — requires a UI disclaimer until Commerce ships. Out-of-scope for
  MVP.
- Consumer-facing language around "paid fan club" is deferred to T-044 spec.

## Alternatives considered

1. **Treat `price > 0` as if it were 0 for MVP.** Rejected: silent promotion of
   paid content to free would be harder to undo after launch than a hard error.
2. **Omit the `price` column entirely until T-044.** Rejected: creating schema
   churn on a feature already sketched in the requirements doc is pointless —
   the column is cheap to carry.

## Status of implementation

- Error code: `ErrorCodes.PAID_FAN_CLUB_NOT_SUPPORTED` in `@a-idol/shared`.
- Usecase gate: `JoinFanClubUseCase` in
  `packages/backend/src/modules/fandom/application/join-fan-club.usecase.ts`.
- HTTP mapping: `AppExceptionFilter` → `402 PAYMENT_REQUIRED`.
- Test: `join-fan-club.usecase.spec.ts` "TC-FC002" covers the rejection.

## Activation plan (T-044)

When Commerce lands:
1. Replace the hard reject with a "create pending membership → redirect to
   checkout → finalize on successful receipt verification" flow.
2. Add `purchase_transactions` FK to `Membership` for audit.
3. Keep the error code for deprecated clients that bypass checkout.
