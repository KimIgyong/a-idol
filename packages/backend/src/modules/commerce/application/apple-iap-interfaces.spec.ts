import { ErrorCodes } from '@a-idol/shared';
import {
  StubAppleReceiptVerifier,
  type AppleReceiptVerifier,
} from './apple-iap-interfaces';

describe('AppleReceiptVerifier — port contract', () => {
  it('TC-IAP-001 — stub throws INVALID_RECEIPT unconditionally (preserves current APPLE_IAP reject behavior)', async () => {
    const verifier: AppleReceiptVerifier = new StubAppleReceiptVerifier();
    await expect(verifier.verify('any-jws-string')).rejects.toMatchObject({
      code: ErrorCodes.INVALID_RECEIPT,
    });
  });

  it('TC-IAP-002 — stub rejects even an empty string (no accidental pass-through)', async () => {
    const verifier: AppleReceiptVerifier = new StubAppleReceiptVerifier();
    await expect(verifier.verify('')).rejects.toMatchObject({
      code: ErrorCodes.INVALID_RECEIPT,
    });
  });

  // TC-IAP-003..006 reserved for JoseAppleReceiptVerifier (ADR-019 Phase 1
  // week 2 — requires `jose` install + Apple root CA bundling):
  //  - valid JWS from sandbox env → parsed AppleTransactionInfo
  //  - expired JWS → INVALID_RECEIPT
  //  - cross-env JWS (Sandbox in Production deployment) → INVALID_RECEIPT
  //  - tampered payload → INVALID_RECEIPT (signature mismatch)
});
