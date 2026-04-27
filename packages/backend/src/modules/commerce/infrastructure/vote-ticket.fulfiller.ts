import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { ProductKind } from '@a-idol/shared';
import type { VoteTicketRepository } from '../../vote/application/ticket-interfaces';
import { VOTE_TICKET_REPOSITORY } from '../../vote/application/ticket-interfaces';
import type { PurchaseFulfiller } from '../application/interfaces';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Delivers VOTE_TICKET products. Two variants share this fulfiller:
 *
 *   - `{ ticketAmount: N }`              → global bucket (any round)
 *   - `{ ticketAmount: N, roundId: ... }`→ round-scoped bucket (T-062b)
 *
 * Round-scoped packs are typically used for event promos (×2 weight, only
 * valid for round R1). When the round closes the vote flow rejects it
 * anyway, so explicit expiration isn't required.
 */
@Injectable()
export class VoteTicketFulfiller implements PurchaseFulfiller {
  constructor(
    @Inject(VOTE_TICKET_REPOSITORY) private readonly tickets: VoteTicketRepository,
  ) {}

  canHandle(kind: ProductKind): boolean {
    return kind === 'VOTE_TICKET';
  }

  async fulfill(input: {
    userId: string;
    transactionId: string;
    deliveryPayload: Record<string, unknown>;
  }): Promise<void> {
    const amount = Number(input.deliveryPayload.ticketAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new DomainError(
        ErrorCodes.INVALID_DELIVERY_PAYLOAD,
        'VOTE_TICKET delivery payload must include positive integer `ticketAmount`',
      );
    }

    const rawRound = input.deliveryPayload.roundId;
    if (rawRound !== undefined && rawRound !== null && rawRound !== '') {
      const roundId = String(rawRound);
      if (!UUID_REGEX.test(roundId)) {
        throw new DomainError(
          ErrorCodes.INVALID_DELIVERY_PAYLOAD,
          'VOTE_TICKET `roundId` must be a UUID when present',
        );
      }
      await this.tickets.grantRound({
        userId: input.userId,
        roundId,
        amount,
        reason: 'PURCHASE',
        memo: `purchase:${input.transactionId}`,
      });
      return;
    }

    await this.tickets.grant({
      userId: input.userId,
      amount,
      reason: 'PURCHASE',
      memo: `purchase:${input.transactionId}`,
    });
  }
}
