/**
 * Domain events emitted by the Audition context. Consumers subscribe via
 * NestJS EventEmitter2 (`@OnEvent(EVENT_NAME)`).
 *
 * The Audition module must NOT depend on the listener's module directly
 * (that would introduce a circular import). Keep these events stable;
 * listeners in other bounded contexts treat them as contract.
 */
export const AUDITION_EVENTS = {
  ROUND_CLOSED: 'round.closed',
} as const;

export interface RoundClosedEvent {
  roundId: string;
  auditionId: string;
  closedAt: Date;
}
