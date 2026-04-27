import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AUDITION_EVENTS,
  type RoundClosedEvent,
} from '../../audition/application/events';
import { SnapshotRankingUseCase } from '../application/snapshot-ranking.usecase';

/**
 * Listens for `round.closed` and writes the final Redis → Postgres
 * snapshot. See ADR-014 "follow-ups" section.
 */
@Injectable()
export class RoundClosedListener {
  private readonly log = new Logger(RoundClosedListener.name);

  constructor(private readonly snapshot: SnapshotRankingUseCase) {}

  @OnEvent(AUDITION_EVENTS.ROUND_CLOSED)
  async onRoundClosed(evt: RoundClosedEvent): Promise<void> {
    try {
      const res = await this.snapshot.execute(evt.roundId);
      this.log.log(
        `final snapshot on close: round=${evt.roundId} rows=${res.rows} at=${evt.closedAt.toISOString()}`,
      );
    } catch (err) {
      this.log.error(
        `final snapshot failed for round=${evt.roundId}: ${(err as Error).message}`,
      );
    }
  }
}
