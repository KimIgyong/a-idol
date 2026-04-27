import { Inject, Injectable, Logger } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { ProductKind } from '@a-idol/shared';
import type { PhotocardRepository } from '../../photocard/application/interfaces';
import { PHOTOCARD_REPOSITORY } from '../../photocard/application/interfaces';
import type { PurchaseFulfiller } from '../application/interfaces';

/**
 * Delivers PHOTOCARD_PACK products by rolling `count` cards from the target
 * set, weighted by each template's `dropWeight`. Inventory inserts happen
 * in the repository's $transaction so the grant is atomic.
 */
@Injectable()
export class PhotocardPackFulfiller implements PurchaseFulfiller {
  private readonly log = new Logger(PhotocardPackFulfiller.name);

  constructor(
    @Inject(PHOTOCARD_REPOSITORY) private readonly photocards: PhotocardRepository,
  ) {}

  canHandle(kind: ProductKind): boolean {
    return kind === 'PHOTOCARD_PACK';
  }

  async fulfill(input: {
    userId: string;
    transactionId: string;
    deliveryPayload: Record<string, unknown>;
  }): Promise<void> {
    const setId = String(input.deliveryPayload.setId ?? '');
    const count = Number(input.deliveryPayload.count);
    if (!setId) {
      throw new DomainError(
        ErrorCodes.INVALID_DELIVERY_PAYLOAD,
        'PHOTOCARD_PACK delivery payload must include `setId`',
      );
    }
    if (!Number.isInteger(count) || count <= 0 || count > 50) {
      throw new DomainError(
        ErrorCodes.INVALID_DELIVERY_PAYLOAD,
        'PHOTOCARD_PACK delivery payload must include positive integer `count` (1-50)',
      );
    }
    const result = await this.photocards.grantFromSet({
      userId: input.userId,
      setId,
      count,
      source: 'PURCHASE',
      sourceRef: `purchase:${input.transactionId}`,
    });
    this.log.debug(
      `photocard grant user=${input.userId} tx=${input.transactionId}: ${result.granted
        .map((g) => `${g.rarity}:${g.templateName}`)
        .join(', ')}`,
    );
  }
}
