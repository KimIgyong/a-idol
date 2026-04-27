/**
 * Apple IAP receipt verification port (ADR-019 §1).
 *
 * MVP uses StoreKit v2 JWS — a compact JWS signed with Apple's current
 * IAP key, carrying the transaction info in its payload. Verification is
 * offline against Apple's root CA + the `x5c` chain embedded in the JWS
 * header (no `/verifyReceipt` REST call).
 *
 * This file defines the port only. The concrete `JoseAppleReceiptVerifier`
 * lives in `infrastructure/` and depends on the `jose` library (not yet
 * installed — see ADR-019 §Activation Plan Phase 1). Until jose is
 * installed + wired, `StubAppleReceiptVerifier` is the DI-registered
 * implementation and unconditionally throws `INVALID_RECEIPT`; this
 * preserves the current runtime contract (`APPLE_IAP` rejected) while
 * letting Phase 1 scaffolding land behind a frozen port.
 */

import { DomainError, ErrorCodes } from '@a-idol/shared';

/**
 * Structured transaction info extracted from a verified StoreKit v2 JWS.
 * Field names match Apple's `transactionInfo` payload spec (camelCase).
 * We intentionally expose only the fields the commerce flow needs — adding
 * new fields is a forward-compatible change.
 */
export interface AppleTransactionInfo {
  /** Apple's unique id for this specific purchase instance. 1:1 with our
   *  `purchase_transactions.providerTxId` under `provider = 'APPLE_IAP'`. */
  transactionId: string;
  /** Apple id for the first purchase in a subscription / family-share
   *  chain; for MVP consumables this equals `transactionId`. */
  originalTransactionId: string;
  /** Apple SKU registered in App Store Connect. Must match our
   *  `purchase_products.sku` — verifier doesn't enforce this; the commerce
   *  usecase does. */
  productId: string;
  /** Number of items purchased in this transaction (consumables can be >1
   *  if the user buys a multipack in one tap). */
  quantity: number;
  /** When Apple recorded the purchase. Used for audit / anti-replay. */
  purchaseDate: Date;
  /** `Sandbox` for test builds, `Production` for App Store. We reject
   *  cross-env receipts (ADR-019 §6). */
  environment: 'Sandbox' | 'Production';
  /** Populated when Apple has revoked the purchase (refund, family-share
   *  removal). Fulfiller runs its compensating path. */
  revocationDate?: Date;
  /** Apple-defined reason code for revocation (0 = other issue,
   *  1 = perceived issue). Kept for audit, no branching on value. */
  revocationReason?: number;
}

/**
 * Verifies an Apple StoreKit v2 JWS and returns the structured transaction
 * info, or throws a `DomainError(INVALID_RECEIPT)` on any failure
 * (signature, chain, expiry, environment mismatch, malformed payload).
 *
 * The verifier MUST be pure — no network (beyond a one-time key fetch at
 * cold start), no DB. Commerce use cases combine the verifier output with
 * the product catalog to decide whether the purchase is acceptable.
 */
export interface AppleReceiptVerifier {
  verify(jws: string): Promise<AppleTransactionInfo>;
}

export const APPLE_RECEIPT_VERIFIER = 'AppleReceiptVerifier';

/**
 * Default DI binding until `JoseAppleReceiptVerifier` lands (ADR-019
 * Phase 1 week 2). Throws `INVALID_RECEIPT` unconditionally so the
 * current runtime behavior for `APPLE_IAP` purchases is unchanged —
 * `CreatePurchaseUseCase` still rejects Apple paths via the
 * `PROVIDER_NOT_SUPPORTED` branch.
 *
 * Flipping the stub for the real impl is a single `useClass` change in
 * CommerceModule.
 */
export class StubAppleReceiptVerifier implements AppleReceiptVerifier {
  async verify(_jws: string): Promise<AppleTransactionInfo> {
    throw new DomainError(
      ErrorCodes.INVALID_RECEIPT,
      'Apple IAP verifier not yet implemented — pending jose library install (ADR-019 Phase 1)',
    );
  }
}
